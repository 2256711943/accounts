/**
 * 离线同步队列单测（D10 亮点 H3）：
 * 入队合并（delete 终态 / update 字段级合并）、重试计数、失败标记、FIFO。
 * queue.ts 顶层 import `@/utils/id`（vitest 不解析 @ alias），用 vi.mock 短路注入可控 id。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as queue from '../queue';
import { installUniStorageMock } from './storage-mock';
import type { SyncTask } from '@/types/model';

vi.mock('@/utils/id', () => {
  let n = 0;
  return { generateId: vi.fn(() => `task-${++n}`) };
});

const AT = 1700000000000;

function makeInput(overrides: Partial<queue.EnqueueInput> = {}): queue.EnqueueInput {
  return {
    clientId: 'abc-1',
    op: 'create',
    payload: { type: 'expense', amount: 2500, categoryId: 'food', happenedAt: AT, source: 'manual' },
    baseVersion: 0,
    ...overrides,
  };
}

describe('computeBackoffMs（纯函数）', () => {
  it('第 1 次用基数，随后指数翻倍', () => {
    expect(queue.computeBackoffMs(1)).toBe(1000);
    expect(queue.computeBackoffMs(2)).toBe(2000);
    expect(queue.computeBackoffMs(4)).toBe(8000);
  });

  it('封顶 30s', () => {
    expect(queue.computeBackoffMs(10)).toBe(30000);
  });
});

describe('enqueue · 新建任务', () => {
  beforeEach(() => installUniStorageMock());
  afterEach(() => vi.unstubAllGlobals());

  it('新 clientId 入队：taskId/tries=0，队列长度 1', () => {
    const t = queue.enqueue(makeInput());
    expect(t.taskId).toBe('task-1');
    expect(t.tries).toBe(0);
    expect(t.op).toBe('create');
    expect(queue.count()).toBe(1);
    expect(queue.getAll()[0].clientId).toBe('abc-1');
  });

  it('重复入队同 clientId → 同位置覆盖，不新增', () => {
    queue.enqueue(makeInput());
    queue.enqueue(makeInput({ op: 'update', payload: { amount: 3000 }, baseVersion: 1 }));
    expect(queue.count()).toBe(1);
    const t = queue.getAll()[0];
    expect(t.payload.amount).toBe(3000);
  });
});

describe('enqueue · 同 clientId 合并策略', () => {
  beforeEach(() => installUniStorageMock());
  afterEach(() => vi.unstubAllGlobals());

  it('update 并入既有 create：op 保持 create、字段级后写覆盖、保留最早 baseVersion、tries 归零', () => {
    queue.enqueue(makeInput());
    const merged = queue.enqueue(
      makeInput({ op: 'update', payload: { amount: 3000, remark: '午餐' }, baseVersion: 99 })
    );
    expect(merged.op).toBe('create');
    expect(merged.baseVersion).toBe(0); // 最早基线
    expect(merged.payload).toMatchObject({ amount: 3000, remark: '午餐', categoryId: 'food' });
    expect(merged.tries).toBe(0);
    expect(queue.count()).toBe(1);
  });

  it('update 并入既有 update：合并载荷、保留最早基线', () => {
    queue.enqueue(makeInput({ op: 'update', payload: { amount: 3000 }, baseVersion: 1 }));
    const merged = queue.enqueue(makeInput({ op: 'update', payload: { remark: '晚餐' }, baseVersion: 2 }));
    expect(merged.op).toBe('update');
    expect(merged.baseVersion).toBe(1);
    expect(merged.payload).toMatchObject({ amount: 3000, remark: '晚餐' });
    expect(queue.count()).toBe(1);
  });

  it('delete 取代既有任务（create/update 全部作废）', () => {
    queue.enqueue(makeInput());
    const t = queue.enqueue(makeInput({ op: 'delete', payload: {} }));
    expect(t.op).toBe('delete');
    expect(queue.count()).toBe(1);
    expect(queue.getAll()[0].op).toBe('delete');
  });

  it('delete 之后再入 update → 作废，队列仍只有删除任务', () => {
    queue.enqueue(makeInput({ op: 'delete', payload: {} }));
    const t = queue.enqueue(makeInput({ op: 'update', payload: { amount: 1 }, baseVersion: 0 }));
    expect(t.op).toBe('delete'); // 返回既有删除任务
    expect(queue.count()).toBe(1);
  });

  it('跨 clientId 各自独立成任务', () => {
    queue.enqueue(makeInput());
    queue.enqueue(makeInput({ clientId: 'abc-2' }));
    expect(queue.count()).toBe(2);
    expect(queue.pendingClientIds().has('abc-1')).toBe(true);
    expect(queue.pendingClientIds().has('abc-2')).toBe(true);
  });
});

describe('队列运维', () => {
  beforeEach(() => installUniStorageMock());
  afterEach(() => vi.unstubAllGlobals());

  it('removeByTaskId 出队', () => {
    const t = queue.enqueue(makeInput());
    queue.removeByTaskId(t.taskId);
    expect(queue.count()).toBe(0);
    expect(queue.hasPending('abc-1')).toBe(false);
  });

  it('bumpTries 计数 +1 并记录 lastError；不存在的 taskId 返回 undefined', () => {
    const t = queue.enqueue(makeInput());
    const next = queue.bumpTries(t.taskId, 'SERVER_ERROR');
    expect(next?.tries).toBe(1);
    expect(next?.lastError).toBe('SERVER_ERROR');
    expect(queue.bumpTries('ghost')).toBeUndefined();
  });

  it('requeueToTail 重排到队尾', () => {
    queue.enqueue(makeInput({ clientId: 'a' }));
    queue.enqueue(makeInput({ clientId: 'b' }));
    queue.enqueue(makeInput({ clientId: 'c' }));
    queue.requeueToTail(queue.getAll()[0].taskId);
    expect(queue.getAll().map((t) => t.clientId)).toEqual(['b', 'c', 'a']);
  });

  it('isFailed：tries 超过 MAX_TRIES 判失败', () => {
    expect(queue.isFailed({ ...makeInput(), tries: queue.MAX_TRIES + 1 } as SyncTask)).toBe(true);
    expect(queue.isFailed({ ...makeInput(), tries: queue.MAX_TRIES } as SyncTask)).toBe(false);
  });

  it('peekBatch 取队头且不动队列', () => {
    queue.enqueue(makeInput({ clientId: 'a' }));
    queue.enqueue(makeInput({ clientId: 'b' }));
    expect(queue.peekBatch(1).map((t) => t.clientId)).toEqual(['a']);
    expect(queue.count()).toBe(2);
  });

  it('clear 清空', () => {
    queue.enqueue(makeInput());
    queue.clear();
    expect(queue.count()).toBe(0);
  });

  it('存储脏数据（非数组）→ 视为空队列，不抛', () => {
    const { store } = installUniStorageMock();
    store.set(queue.SYNC_QUEUE_KEY, 'garbage');
    expect(queue.count()).toBe(0);
    expect(queue.getAll()).toEqual([]);
  });
});
