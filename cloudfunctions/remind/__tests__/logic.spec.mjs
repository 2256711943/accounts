// remind 逻辑层单测（D14 F7）：24h 未记账识别 + 订阅消息下发 + 额度扣减
//
// 直接驱动 logic.createRemindHandlers（注入内存 db + send mock），不 mock wx-server-sdk。
// 运行：npm run test:remind（package.json）或 npm test
//
// 覆盖语义：
//   1. 模板未配置（占位）→ 安全跳过，不误发
//   2. 24h 内记过账 → 不发（skipped）
//   3. 超过 24h / 无记录 → 下发，成功后扣额度
//   4. 用户已拒绝（43101）→ 额度失效扣减，避免反复打空
//   5. _openid 隔离：只处理有额度用户

import { describe, expect, it } from 'vitest';
import logic from '../logic.js';
import { createMemoryDb } from './memory-db.js';

const { createRemindHandlers, REMIND_WINDOW_MS } = logic;

const HOUR = 60 * 60 * 1000;
const NOW = 1700000000000;
const OWNER = 'openid-remind-1';
const TPL = 'tmpl-remind-001';

/** 构造内存 db：quota 与 ledger 记录混排（memory-db 无集合隔离，测试自行区分字段） */
function makeDb({ quota, records }) {
  const seed = [];
  if (quota) {
    seed.push({ _id: 'q1', _openid: quota._openid, templateId: quota.templateId, count: quota.count });
  }
  for (const r of records || []) {
    seed.push({ _id: r._id || 'r1', _openid: r._openid, happenedAt: r.happenedAt, deleted: r.deleted });
  }
  return createMemoryDb(seed);
}

function makeHandler(db, sendMock, opts = {}) {
  return createRemindHandlers({ db, send: sendMock, now: () => NOW, templateId: opts.templateId });
}

describe('remind.handleTimerRun（D14 F7）', () => {
  it('模板未配置（占位）：扫描但不发送，模板缺失计数', async () => {
    const db = makeDb({ quota: { _openid: OWNER, templateId: TPL, count: 2 } });
    const send = async () => {
      throw new Error('不应被调用');
    };
    const { handleTimerRun } = makeHandler(db, send); // 不注入 templateId → 占位
    const stat = (await handleTimerRun()).data;
    expect(stat.scanned).toBe(1);
    expect(stat.templateMissing).toBe(1);
    expect(stat.sent).toBe(0);
  });

  it('24h 内记过账：不发（skipped），额度保留', async () => {
    const db = makeDb({
      quota: { _openid: OWNER, templateId: TPL, count: 2 },
      records: [{ _openid: OWNER, happenedAt: NOW - 2 * HOUR }],
    });
    const send = async () => ({ errCode: 0 });
    const { handleTimerRun } = makeHandler(db, send, { templateId: TPL });
    const stat = (await handleTimerRun()).data;
    expect(stat.scanned).toBe(1);
    expect(stat.skipped).toBe(1);
    expect(stat.sent).toBe(0);
    expect(db.inspect().find((d) => d._id === 'q1').count).toBe(2);
  });

  it('超过 24h 未记账：下发成功 → sent +1，额度扣减', async () => {
    const db = makeDb({
      quota: { _openid: OWNER, templateId: TPL, count: 2 },
      records: [{ _openid: OWNER, happenedAt: NOW - (REMIND_WINDOW_MS + HOUR) }],
    });
    const calls = [];
    const send = async (params) => {
      calls.push(params);
      return { errCode: 0 };
    };
    const { handleTimerRun } = makeHandler(db, send, { templateId: TPL });
    const stat = (await handleTimerRun()).data;
    expect(stat.sent).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].touser).toBe(OWNER);
    expect(calls[0].templateId).toBe(TPL);
    expect(calls[0].page).toBe('pages/index/index');
    expect(calls[0].data.thing1.value).toContain('24 小时');
    expect(db.inspect().find((d) => d._id === 'q1').count).toBe(1); // 2 → 1
  });

  it('无记录（新用户）：同样下发提醒', async () => {
    const db = makeDb({
      quota: { _openid: OWNER, templateId: TPL, count: 1 },
      records: [],
    });
    const send = async () => ({ errCode: 0 });
    const { handleTimerRun } = makeHandler(db, send, { templateId: TPL });
    const stat = (await handleTimerRun()).data;
    expect(stat.sent).toBe(1);
    expect(db.inspect().find((d) => d._id === 'q1').count).toBe(0);
  });

  it('用户已拒绝（43101）：额度失效扣减，refused +1', async () => {
    const db = makeDb({
      quota: { _openid: OWNER, templateId: TPL, count: 1 },
      records: [],
    });
    const send = async () => ({ errCode: 43101 });
    const { handleTimerRun } = makeHandler(db, send, { templateId: TPL });
    const stat = (await handleTimerRun()).data;
    expect(stat.refused).toBe(1);
    expect(stat.sent).toBe(0);
    expect(db.inspect().find((d) => d._id === 'q1').count).toBe(0);
  });

  it('只处理有额度的用户：count=0 不扫描不发送', async () => {
    const db = makeDb({
      quota: { _openid: OWNER, templateId: TPL, count: 0 },
      records: [],
    });
    const send = async () => {
      throw new Error('不应被调用');
    };
    const { handleTimerRun } = makeHandler(db, send, { templateId: TPL });
    const stat = (await handleTimerRun()).data;
    expect(stat.scanned).toBe(0);
    expect(stat.sent).toBe(0);
  });
});
