// 云函数 remind 业务逻辑层（D14 F7 订阅消息提醒）—— 纯逻辑，db/send 注入式，可单测。
//
// 职责（ARCHITECTURE.md §4「remind/ 定时 + 订阅消息」）：
//   定时触发器调用 → 找出「有订阅额度」且「24h 未记账」的用户 → 下发一次性订阅消息 → 扣额度。
//   数据通道（client.call）不调用本函数 —— 订阅额度登记在 ledger 的 subscribe.register，
//   下发额度管理（subscribe_quota 集合）在两端共享：
//     ledger.subscribe.register  累加额度（用户授权一次 +1）
//     remind.handleTimerRun      消耗额度（每次成功下发或用户已拒绝 -1）
//
// db 需满足的接口（云数据库风格，与 ledger/memory-db 兼容）：
//   db.collection(name).where(cond).limit(n).get()  → { data: [...] }
//   db.collection(name).doc(id).update({ data })    → { stats: { updated } }
//   db.command → { neq }
// send 注入式：send({ touser, templateId, data }) → Promise<{ errCode: number }>
//   （真机为 cloud.openapi.subscribeMessage.send；errCode 0 成功，43101 用户已拒绝）

const ok = (data) => ({ ok: true, data });
const fail = (code, extra) => ({ ok: false, error: { code, ...extra } });

const ERR = {
  INVALID_PARAM: 'INVALID_PARAM',
  DB_ERROR: 'DB_ERROR',
};

/** 订阅额度集合（与 ledger.logic.js 保持一致） */
const SUBSCRIBE_QUOTA_COLLECTION = 'subscribe_quota';
/** 账单单据集合（与 ledger.logic.js 保持一致） */
const RECORDS_COLLECTION = 'ledger_records';

/** 提醒窗口：24h 未记账 */
const REMIND_WINDOW_MS = 24 * 60 * 60 * 1000;
/** 单轮最多扫描的额度用户数（防定时触发大循环拖垮函数） */
const MAX_SCAN_USERS = 100;

/**
 * 订阅模板 ID。
 * ⚠️ 需在小程序后台「订阅消息」申请「记账提醒」模板后替换（dry-run 指引见 spec_finish §20）。
 * 保持占位（非合法模板 ID）时，handleTimerRun 一律跳过发送，仅扫描统计 —— 部署安全。
 */
const TEMPLATE_ID = 'YOUR_TEMPLATE_ID';

/**
 * 订阅消息 data 字段（形如 `字段名: { value }`）。
 * ⚠️ 字段名必须与后台申请的模板字段一致；申请模板时建议选择：
 *    thing1（24h 未记账文案）/ time1（最近记账时间）
 */
const TEMPLATE_FIELDS = {
  thing1: '您已有 24 小时未记账，快回来记一笔吧',
};

/** 微信侧「用户已拒绝/未订阅」错误码：本地额度视为失效，应扣减避免反复打空 */
const ERR_USER_REFUSED = 43101;

/**
 * 单次运行的返回（供入口/测试断言）：
 *   { ok, scanned, sent, skipped, refused }
 *   scanned 扫描的额度用户数；sent 成功下发数；skipped 无额度/未到窗口跳过数；
 *   refused 用户已拒绝被扣额度数；templateMissing 模板未配置跳过数。
 */
function createRemindHandlers({ db, send, now = Date.now, templateId } = {}) {
  const _ = db.command;
  // 模板 ID 可注入（单测覆盖发送路径）；默认取模块常量（占位时安全跳过）
  const TEMPLATE = templateId || TEMPLATE_ID;

  /**
   * 读取指定用户最新一条未删除记账（无记录返回 null）。
   * _openid 强制过滤（红线 5）。
   */
  async function latestRecord(ownerId) {
    const res = await db
      .collection(RECORDS_COLLECTION)
      .where({ _openid: ownerId, deleted: _.neq(true) })
      .orderBy('happenedAt', 'desc')
      .limit(1)
      .get();
    return res.data.length > 0 ? res.data[0] : null;
  }

  /** 扣减一条订阅额度（count-1，降到 0 保留文档便于审计） */
  async function consumeQuota(quota) {
    await db
      .collection(SUBSCRIBE_QUOTA_COLLECTION)
      .doc(quota._id)
      .update({ data: { count: Math.max(0, (quota.count || 0) - 1), updatedAt: now() } });
  }

  /**
   * 定时触发主流程（D14 F7）：
   *   1. 扫 subscribe_quota 里 count>0 的用户（限量 MAX_SCAN_USERS）
   *   2. 逐用户查最新记账：无记录或超过 REMIND_WINDOW_MS → 下发订阅消息
   *   3. 下发成功 / 用户已拒绝 → 扣额度；其余错误保留额度（下轮重试）
   */
  async function handleTimerRun() {
    const quotaRes = await db.collection(SUBSCRIBE_QUOTA_COLLECTION).limit(MAX_SCAN_USERS).get();
    const quotas = (quotaRes.data || []).filter((q) => (q.count || 0) > 0 && typeof q._openid === 'string');
    const stat = { scanned: 0, sent: 0, skipped: 0, refused: 0, templateMissing: 0 };

    for (const quota of quotas) {
      stat.scanned += 1;
      if (TEMPLATE === 'YOUR_TEMPLATE_ID') {
        stat.templateMissing += 1;
        continue;
      }
      const last = await latestRecord(quota._openid);
      const idle = now() - (last ? last.happenedAt : 0);
      if (last && idle <= REMIND_WINDOW_MS) {
        stat.skipped += 1; // 24h 内记过账，还不需要提醒
        continue;
      }
      // 无记录（新用户）或超过 24h → 下发
      const data = {};
      for (const [k, v] of Object.entries(TEMPLATE_FIELDS)) data[k] = { value: v };
      const res = await send({ touser: quota._openid, templateId: TEMPLATE, page: 'pages/index/index', data });
      if (res && res.errCode === 0) {
        await consumeQuota(quota);
        stat.sent += 1;
      } else if (res && res.errCode === ERR_USER_REFUSED) {
        // 用户已取消授权：本地额度失效，扣减避免下轮重复打空
        await consumeQuota(quota);
        stat.refused += 1;
      }
      // 其他错误（模板未过审/网络/频率限制）：保留额度，下轮重试
    }

    return ok(stat);
  }

  return { ERR, REMIND_WINDOW_MS, TEMPLATE_ID, handleTimerRun, latestRecord, consumeQuota };
}

module.exports = {
  ERR,
  ok,
  fail,
  SUBSCRIBE_QUOTA_COLLECTION,
  RECORDS_COLLECTION,
  REMIND_WINDOW_MS,
  TEMPLATE_ID,
  createRemindHandlers,
};
