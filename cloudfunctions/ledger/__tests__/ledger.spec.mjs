// ledger 逻辑层单测：幂等 / 乐观并发 / 软删除 / 游标分页 / _openid 隔离
//
// 直接驱动 logic.createLedgerHandlers（注入内存 db），不 mock wx-server-sdk。
// 运行：npm run test:ledger 或 npm test
//
// 对 CJS 模块（logic.js / memory-db.js）用 default import 读取其 module.exports。
//
// 覆盖 D4 DoD 的关键语义（见 docs/DEV_PLAN.md D4 与 docs/ARCHITECTURE.md §6）：
//   1. 幂等：同一 clientId 重复 create 不产生第二条
//   2. 乐观并发：baseVersion 落后 → conflict，不覆盖
//   3. _openid 隔离：不同 owner 互不可见
//   4. 软删除：remove → deleted:true，list 默认过滤
//   5. 游标分页：happenedAt 倒序 + clientId 升序，翻页不重不漏

import { describe, expect, it } from 'vitest';
import logic from '../logic.js';
import {
  createMemoryDb,
} from './memory-db.js';

const { createLedgerHandlers, validate, isValidAmount } = logic;

const H5_OWNER = 'h5-demo-single-user';
const MP_OWNER = 'openid-aaa';

function makeHandler(seed = []) {
  const db = createMemoryDb(seed);
  return { db, handlers: createLedgerHandlers({ db }) };
}

const AMOUNT = 2500; // 25.00 元（单位分）
const AT = 1700000000000;

function basePayload(overrides = {}) {
  const { payload: payloadOverride, ...rest } = overrides;
  const payload = {
    type: 'expense',
    amount: AMOUNT,
    categoryId: 'food',
    happenedAt: AT,
    source: 'manual',
    ...payloadOverride,
  };
  return { clientId: 'abc-1', op: 'create', ...rest, payload };
}

describe('validate', () => {
  it('payload 非对象 → INVALID_PARAM', () => {
    expect(validate('record.upsert', null).code).toBe('INVALID_PARAM');
    expect(validate('record.list', [1, 2]).code).toBe('INVALID_PARAM');
  });

  it('upsert: clientId 必填、op 白名单、update 必带 baseVersion', () => {
    expect(validate('record.upsert', { ...basePayload(), clientId: '' }).code).toBe('INVALID_PARAM');
    expect(validate('record.upsert', { ...basePayload(), op: 'explode' }).code).toBe('INVALID_PARAM');
    expect(validate('record.upsert', { ...basePayload(), op: 'update', baseVersion: undefined }).code).toBe(
      'INVALID_PARAM'
    );
    expect(validate('record.upsert', basePayload())).toBeNull();
    expect(validate('record.upsert', { ...basePayload(), op: 'delete' })).toBeNull();
  });

  it('list: limit 必须 1–100 整数', () => {
    expect(validate('record.list', { limit: 0 }).code).toBe('INVALID_PARAM');
    expect(validate('record.list', { limit: 101 }).code).toBe('INVALID_PARAM');
    expect(validate('record.list', { limit: 20 })).toBeNull();
  });
});

describe('isValidAmount', () => {
  it('整数分、>0、≤1e8', () => {
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(100000000)).toBe(true);
    expect(isValidAmount(1.5)).toBe(false); // 非整数
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-5)).toBe(false);
    expect(isValidAmount(100000001)).toBe(false);
  });
});

describe('record.upsert · create', () => {
  it('成功创建，落 _openid + version=1', async () => {
    const { db, handlers } = makeHandler();
    const res = await handlers.handleUpsert(basePayload(), MP_OWNER);
    expect(res.ok).toBe(true);
    expect(res.data.record._openid).toBe(MP_OWNER);
    expect(res.data.record.version).toBe(1);
    const snap = db.inspect();
    expect(snap[0]._openid).toBe(MP_OWNER);
    expect(snap[0].version).toBe(1);
  });

  it('幂等：同一 clientId 重复 create → duplicated:true，不产生第二条', async () => {
    const { db, handlers } = makeHandler();
    const p1 = await handlers.handleUpsert(basePayload(), MP_OWNER);
    expect(p1.data.duplicated).toBeUndefined();

    const p2 = await handlers.handleUpsert(basePayload(), MP_OWNER);
    expect(p2.ok).toBe(true);
    expect(p2.data.duplicated).toBe(true);
    expect(p2.data.record._id).toBe(p1.data.record._id);
    expect(db.inspect().length).toBe(1);
  });

  it('幂等键是 (clientId, _openid)：不同 owner 同 clientId 各自建一条', async () => {
    const { db, handlers } = makeHandler();
    await handlers.handleUpsert(basePayload(), MP_OWNER);
    await handlers.handleUpsert(basePayload(), H5_OWNER);
    expect(db.inspect().length).toBe(2);
    expect(db.inspect().map((r) => r._openid).sort()).toEqual([MP_OWNER, H5_OWNER].sort());
  });

  it('amount 非法 → INVALID_PARAM（不落库）', async () => {
    const { db, handlers } = makeHandler();
    const bad = { payload: { ...basePayload().payload, amount: 1.5 } };
    const res = await handlers.handleUpsert(basePayload(bad), MP_OWNER);
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('INVALID_PARAM');
    expect(db.inspect().length).toBe(0);
  });
});

describe('record.upsert · update / 乐观并发', () => {
  it('baseVersion 匹配 → 覆盖并 version+1', async () => {
    const { handlers } = makeHandler();
    await handlers.handleUpsert(basePayload(), MP_OWNER);
    const up = await handlers.handleUpsert(
      basePayload({ op: 'update', baseVersion: 1, payload: { amount: 3000 } }),
      MP_OWNER
    );
    expect(up.ok).toBe(true);
    expect(up.data.conflict).toBeUndefined();
    expect(up.data.record.version).toBe(2);
    expect(up.data.record.amount).toBe(3000);
  });

  it('baseVersion 落后 → conflict:true，返回服务端当前文档，不覆盖', async () => {
    const { db, handlers } = makeHandler();
    await handlers.handleUpsert(basePayload(), MP_OWNER); // v1
    await handlers.handleUpsert(basePayload({ op: 'update', baseVersion: 1, payload: { amount: 3000 } }), MP_OWNER); // v2
    // 客户端还拿着旧基线 v1 再提交 → conflict
    const res = await handlers.handleUpsert(
      basePayload({ op: 'update', baseVersion: 1, payload: { amount: 9999 } }),
      MP_OWNER
    );
    expect(res.ok).toBe(true);
    expect(res.data.conflict).toBe(true);
    expect(db.inspect()[0].amount).toBe(3000); // 不被覆盖
    expect(res.data.record.amount).toBe(3000);
  });

  it('update 不存在的 clientId → NOT_FOUND', async () => {
    const { handlers } = makeHandler();
    const res = await handlers.handleUpsert(
      basePayload({ clientId: 'nope', op: 'update', baseVersion: 1, payload: { amount: 3000 } }),
      MP_OWNER
    );
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('NOT_FOUND');
  });
});

describe('record.remove · 软删除', () => {
  it('软删除：deleted:true 落库，list 默认过滤', async () => {
    const { db, handlers } = makeHandler();
    await handlers.handleUpsert(basePayload(), MP_OWNER);
    const rm = await handlers.handleRemove({ clientId: 'abc-1' }, MP_OWNER);
    expect(rm.ok).toBe(true);
    expect(db.inspect()[0].deleted).toBe(true);

    const list = await handlers.handleList({ limit: 10 }, MP_OWNER);
    expect(list.data.list.length).toBe(0);
  });

  it('删除不存在的 clientId → NOT_FOUND', async () => {
    const { handlers } = makeHandler();
    const res = await handlers.handleRemove({ clientId: 'ghost' }, MP_OWNER);
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('NOT_FOUND');
  });

  it('不同 owner 不能删对方的账单', async () => {
    const { db, handlers } = makeHandler();
    await handlers.handleUpsert(basePayload(), MP_OWNER);
    const rm = await handlers.handleRemove({ clientId: 'abc-1' }, H5_OWNER);
    expect(rm.ok).toBe(false);
    expect(rm.error.code).toBe('NOT_FOUND');
    expect(db.inspect()[0].deleted).toBeUndefined();
  });
});

describe('record.list · 分页与过滤', () => {
  function seedDb(seed = []) {
    const db = createMemoryDb(seed);
    return { db, handlers: createLedgerHandlers({ db }) };
  }

  async function seedRecords(handlers, owner) {
    await handlers.handleUpsert(basePayload({ clientId: 'late', payload: { amount: 100, happenedAt: AT + 100 } }), owner);
    await handlers.handleUpsert(basePayload({ clientId: 'early', payload: { amount: 200, happenedAt: AT - 100 } }), owner);
    await handlers.handleUpsert(basePayload({ clientId: 'mid', payload: { amount: 300, happenedAt: AT } }), owner);
  }

  it('默认过滤软删，按 happenedAt 倒序', async () => {
    const { handlers } = seedDb();
    await seedRecords(handlers, MP_OWNER);
    await handlers.handleRemove({ clientId: 'mid' }, MP_OWNER);
    const res = await handlers.handleList({ limit: 10 }, MP_OWNER);
    expect(res.data.list.map((r) => r.clientId)).toEqual(['late', 'early']);
  });

  it('游标翻页：不重不漏', async () => {
    const { handlers } = seedDb();
    for (let i = 0; i < 5; i += 1) {
      await handlers.handleUpsert(
        basePayload({ clientId: `item-${i}`, payload: { amount: i + 1, happenedAt: AT - i } }),
        MP_OWNER
      );
    }
    const page1 = await handlers.handleList({ limit: 2 }, MP_OWNER);
    expect(page1.data.hasMore).toBe(true);
    expect(page1.data.list.map((r) => r.clientId)).toEqual(['item-0', 'item-1']);

    const page2 = await handlers.handleList({ limit: 2, cursor: page1.data.nextCursor }, MP_OWNER);
    expect(page2.data.hasMore).toBe(true);
    expect(page2.data.list.map((r) => r.clientId)).toEqual(['item-2', 'item-3']);

    const page3 = await handlers.handleList({ limit: 2, cursor: page2.data.nextCursor }, MP_OWNER);
    expect(page3.data.hasMore).toBe(false);
    expect(page3.data.list.map((r) => r.clientId)).toEqual(['item-4']);
  });

  it('categoryId / since 过滤', async () => {
    const { handlers } = seedDb();
    await handlers.handleUpsert(basePayload({ payload: { amount: 100, happenedAt: AT, categoryId: 'food' } }), MP_OWNER);
    await handlers.handleUpsert(
      basePayload({ clientId: 't', payload: { amount: 200, happenedAt: AT + 100, categoryId: 'transport' } }),
      MP_OWNER
    );

    const byCat = await handlers.handleList({ limit: 10, categoryId: 'food' }, MP_OWNER);
    expect(byCat.data.list.map((r) => r.clientId)).toEqual(['abc-1']);

    const since = await handlers.handleList({ limit: 10, since: AT + 50 }, MP_OWNER);
    expect(since.data.list.map((r) => r.clientId)).toEqual(['t']);
  });

  it('_openid 隔离：list 不返回他人数据', async () => {
    const { handlers } = seedDb();
    await handlers.handleUpsert(basePayload({ clientId: 'mine' }), MP_OWNER);
    await handlers.handleUpsert(basePayload({ clientId: 'theirs' }), H5_OWNER);
    const res = await handlers.handleList({ limit: 10 }, MP_OWNER);
    expect(res.data.list.map((r) => r.clientId)).toEqual(['mine']);
  });
});