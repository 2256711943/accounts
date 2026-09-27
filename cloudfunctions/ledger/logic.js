// 云函数 ledger 业务逻辑层（纯逻辑，db 注入式）—— 可被单元测试直接驱动。
//
// 为什么单独抽一层：
//   云函数入口 index.js 在模块顶部 require('wx-server-sdk') 并初始化 db，
//   而 wx-server-sdk 依赖云上环境、非本地 node_modules 产物，无法直接 require 单测。
//   把「幂等 / 乐观并发 / 软删除 / 游标分页」这些简历级逻辑下沉到本层，
//   并通过 createLedgerHandlers({ db, now }) 注入 db，测试传一个内存 db 即可覆盖全部业务路径。
//
// db 需满足的接口（云数据库风格，见 __tests__/memory-db.js 的兼容实现）：
//   db.collection(name) → { where(cond), add({data}), doc(id) }
//   db.command            → { or, and, lt, lte, gt, gte, neq }
//   集合查询链：where(cond).limit(n).get()  /  where(cond).orderBy(f,dir).orderBy(f,dir).limit(n).get()
//               其 get() 返回 { data: [...] }；add 返回 { _id }；doc(id).update({ data }) 返回 { stats: { updated } }
//
// 与 ARCHITECTURE.md §6、src/types/api.ts 的语义保持一致。
// 归属隔离：所有 handler 都在调用链末端收到 ownerId，写显式落 `_openid`，读强制过滤 `_openid`（红线 5）。

const ERR = {
  INVALID_PARAM: 'INVALID_PARAM',
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATED: 'DUPLICATED',
  DB_ERROR: 'DB_ERROR',
};

// H5 端「单用户 demo」归属身份（ARCHITECTURE.md §1.2 决策 4）。
const H5_DEMO_OWNER_ID = 'h5-demo-single-user';

// 账单单据集合名（SPEC.md §5.1）。
const COLLECTION = 'ledger_records';

const ok = (data) => ({ ok: true, data });
const fail = (code, extra) => ({ ok: false, error: { code, ...extra } });

/** 是否合法对象（非 null、非数组、类型 object） */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** 金额校验：整数分，0 < amount ≤ 1e8（ARCHITECTURE.md §6 通用校验） */
function isValidAmount(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 100000000;
}

/**
 * 入参校验（ARCHITECTURE.md §6「通用校验」）。
 * 只校验跨 action 的公共约束；各 action 特有字段在各自 handler 内做。
 * 通过返回 null，失败返回 { code, message }。
 */
function validate(action, payload) {
  if (!isPlainObject(payload)) {
    return { code: ERR.INVALID_PARAM, message: 'payload 必须是对象' };
  }
  switch (action) {
    case 'record.upsert': {
      const { clientId, op, payload: body } = payload;
      if (typeof clientId !== 'string' || clientId.length === 0) {
        return { code: ERR.INVALID_PARAM, message: 'clientId 必填' };
      }
      if (!['create', 'update', 'delete'].includes(op)) {
        return { code: ERR.INVALID_PARAM, message: `op 必须是 create/update/delete，收到 ${op}` };
      }
      if (op !== 'delete' && !isPlainObject(body)) {
        return { code: ERR.INVALID_PARAM, message: 'upsert 的 payload 必须是对象' };
      }
      if (op === 'update' && typeof payload.baseVersion !== 'number') {
        return { code: ERR.INVALID_PARAM, message: 'update 必须携带 baseVersion' };
      }
      return null;
    }
    case 'record.list': {
      const { limit, since, cursor, categoryId } = payload;
      if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        return { code: ERR.INVALID_PARAM, message: 'limit 必须是 1–100 的整数' };
      }
      if (since !== undefined && (typeof since !== 'number' || !Number.isFinite(since))) {
        return { code: ERR.INVALID_PARAM, message: 'since 必须是时间戳(ms)' };
      }
      if (cursor !== undefined && typeof cursor !== 'string') {
        return { code: ERR.INVALID_PARAM, message: 'cursor 必须是字符串' };
      }
      if (categoryId !== undefined && typeof categoryId !== 'string') {
        return { code: ERR.INVALID_PARAM, message: 'categoryId 必须是字符串' };
      }
      return null;
    }
    case 'record.remove': {
      if (typeof payload.clientId !== 'string' || payload.clientId.length === 0) {
        return { code: ERR.INVALID_PARAM, message: 'clientId 必填' };
      }
      return null;
    }
    default:
      return null;
  }
}

/** upsert 允许客户端写入的字段白名单（防写穿 _openid / clientId / version / _id） */
const UPSERT_WRITABLE = [
  'type',
  'amount',
  'categoryId',
  'merchant',
  'remark',
  'happenedAt',
  'source',
  'recognizeMeta',
  'imageFileId',
];

function pickWritable(body) {
  const out = {};
  for (const key of UPSERT_WRITABLE) {
    if (key in body) out[key] = body[key];
  }
  return out;
}

/**
 * 工厂：绑定 db 与时钟，返回可路由的 handler 集合。
 * now 可注入以便测试控制时间戳。
 */
function createLedgerHandlers({ db, now = Date.now } = {}) {
  const _ = db.command;

  async function handleUpsert({ clientId, op, payload: body, baseVersion }, ownerId) {
    const coll = db.collection(COLLECTION);
    const where = { clientId, _openid: ownerId };

    if (op === 'create') {
      const existing = await coll.where(where).limit(1).get();
      if (existing.data.length > 0) {
        // 幂等命中：同一 (clientId, _openid) 已存在，不重复建
        return ok({ record: existing.data[0], duplicated: true });
      }
      if (!isPlainObject(body) || !isValidAmount(body.amount)) {
        return fail(ERR.INVALID_PARAM, { message: 'amount 必须是 1–1e8 的整数分' });
      }
      if (!['expense', 'income'].includes(body.type)) {
        return fail(ERR.INVALID_PARAM, { message: 'type 必须是 expense/income' });
      }
      const ts = now();
      const doc = {
        clientId,
        _openid: ownerId,
        version: 1,
        createdAt: ts,
        updatedAt: ts,
        ...pickWritable(body),
      };
      const res = await coll.add({ data: doc });
      return ok({ record: { _id: res._id, ...doc } });
    }

    // op === 'update'：baseVersion 由 validate 保证为 number
    const existing = await coll.where(where).limit(1).get();
    if (existing.data.length === 0) {
      return fail(ERR.NOT_FOUND, { message: '账单不存在，无法 update' });
    }
    const doc = existing.data[0];
    if (doc.version !== baseVersion) {
      // 乐观并发：服务端版本落后于客户端基线，交由客户端 LWW（字段级合并在客户端做）
      return ok({ record: doc, conflict: true });
    }
    if (!isPlainObject(body) || !isValidAmount(body.amount)) {
      return fail(ERR.INVALID_PARAM, { message: 'amount 必须是 1–1e8 的整数分' });
    }
    const patch = {
      ...pickWritable(body),
      version: doc.version + 1,
      updatedAt: now(),
    };
    // 不整体覆盖 doc，避免把 _id / _openid / createdAt / clientId 一并写改
    await coll.doc(doc._id).update({ data: patch });
    return ok({ record: { ...doc, ...patch } });
  }

  async function handleList({ limit, since, cursor, categoryId }, ownerId) {
    const coll = db.collection(COLLECTION);
    const base = { _openid: ownerId, deleted: _.neq(true) };
    if (since !== undefined) base.happenedAt = _.gte(since);
    if (categoryId !== undefined) base.categoryId = categoryId;

    let where;
    if (cursor !== undefined) {
      // 游标 = Base64("happenedAt:clientId") 上一页末条；复合键排他边界
      // 排序是 happenedAt 倒序 + clientId 升序 → 边界满足「更早 happenedAt，或同刻更大 clientId」
      try {
        const raw = Buffer.from(cursor, 'base64').toString('utf8');
        const sep = raw.indexOf(':');
        if (sep < 0) throw new Error('bad cursor');
        const prevAt = Number(raw.slice(0, sep));
        const prevId = raw.slice(sep + 1);
        if (!Number.isFinite(prevAt) || !prevId) throw new Error('bad cursor');
        const boundary = _.or([
          { happenedAt: _.lt(prevAt) },
          { happenedAt: prevAt, clientId: _.gt(prevId) },
        ]);
        where = _.and([base, { happenedAt: _.lte(prevAt) }, boundary]);
      } catch (err) {
        return fail(ERR.INVALID_PARAM, { message: 'cursor 非法' });
      }
    } else {
      where = base;
    }

    const res = await coll.where(where).orderBy('happenedAt', 'desc').orderBy('clientId', 'asc').limit(limit + 1).get();
    const list = res.data.slice(0, limit);
    const hasMore = res.data.length > limit;
    let nextCursor = null;
    if (hasMore && list.length > 0) {
      const last = list[list.length - 1];
      nextCursor = Buffer.from(`${last.happenedAt}:${last.clientId}`).toString('base64');
    }
    return ok({ list, nextCursor, hasMore });
  }

  async function handleRemove({ clientId }, ownerId) {
    const coll = db.collection(COLLECTION);
    const res = await coll.where({ clientId, _openid: ownerId }).limit(1).get();
    if (res.data.length === 0) {
      return fail(ERR.NOT_FOUND, { message: '账单不存在' });
    }
    await coll.doc(res.data[0]._id).update({
      data: { deleted: true, updatedAt: now() },
    });
    return ok({ ok: true });
  }

  return {
    ERR,
    COLLECTION,
    H5_DEMO_OWNER_ID,
    validate,
    handleUpsert,
    handleList,
    handleRemove,
  };
}

// 供无 db 也需要的纯函数直接 import：
module.exports = {
  ERR,
  H5_DEMO_OWNER_ID,
  COLLECTION,
  ok,
  fail,
  isPlainObject,
  isValidAmount,
  validate,
  pickWritable,
  createLedgerHandlers,
};