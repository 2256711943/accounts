/**
 * 离线同步冲刷单测（D10 亮点 H3）：串行出队上行 + 逐条回执应用。
 * 覆盖：批量成功 / 云端旧版退化为逐条 / 通道失败整轮中断 / 单条失败重试 /
 *       冲突采纳服务端文档 / 超过 MAX_TRIES 标记失败 / 并发锁 / 空队列。
 * flush → queue → `@/utils/id`；flush → `@/api/client`（call + ApiCallError），
 * vitest 不解析 @ alias，两处均用 vi.mock 短路；queue/snapshot 用真实模块 + uni storage mock。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiCallError, call } from '@/api/client';
import { flush } from '../flush';
import * as queue from '../queue';
import * as snapshot from '../snapshot';
import { installUniStorageMock } from './storage-mock';
import type { LedgerRecord, SyncTask } from '@/types/model';

vi.mock('@/utils/id', () => {
  let n = 0;
  return { generateId: vi.fn(() => `task-${++n}`) };
});

vi.mock('@/api/client', () => {
  class ApiCallError extends Error {
    readonly code: string;
    readonly detail?: unknown;

    constructor(code: string, message?: string, detail?: unknown) {
      super(message ?? code);
      this.name = 'ApiCallError';
      this.code = code;
      this.detail = detail;
    }
  }
  return { ApiCallError, call: vi.fn() };
});

const AT = 1700000000000;
let seq = 0;

function rec(clientId: string): LedgerRecord {
  seq += 1;
  return {
    clientId,
    type: 'expense',
    amount: seq * 100,
    categoryId: 'food',
    happenedAt: AT,
    source: 'manual',
    version: seq,
  };
}

function task(partial: Partial<SyncTask> & { clientId: string; op: SyncTask['op'] }): SyncTask {
  const base: SyncTask = {
    taskId: `t-${++seq}`,
    clientId: partial.clientId,
    op: partial.op,
    payload: { type: 'expense', amount: 100, categoryId: 'food', happenedAt: AT, source: 'manual' },
    baseVersion: 0,
    tries: 0,
  };
  return { ...base, ...partial };
}

describe('flush · 离线同步冲刷', () => {
  let store: Map<string, unknown>;
  const callMock = vi.mocked(call);

  beforeEach(() => {
    seq = 0;
    store = installUniStorageMock().store;
    callMock.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  function seedQueue(tasks: SyncTask[]) {
    store.set(queue.SYNC_QUEUE_KEY, tasks);
  }

  it('空队列：直接返回空汇总，不发起调用', async () => {
    const s = await flush();
    expect(s).toEqual({ synced: 0, conflicts: 0, failed: 0, interrupted: false });
    expect(callMock).not.toHaveBeenCalled();
  });

  it('批量成功：出队 + 快照采纳服务端文档，conflict 单独计数', async () => {
    seedQueue([task({ taskId: 't1', clientId: 'a', op: 'create' }), task({ taskId: 't2', clientId: 'b', op: 'create' })]);
    callMock.mockResolvedValueOnce({
      results: [
        { taskId: 't1', ok: true, record: rec('a') },
        { taskId: 't2', ok: true, conflict: true, record: rec('b') },
      ],
    });

    const s = await flush();
    expect(s).toEqual({ synced: 1, conflicts: 1, failed: 0, interrupted: false });
    expect(queue.count()).toBe(0);
    expect(snapshot.loadSnapshot().map((r) => r.clientId).sort()).toEqual(['a', 'b']);
  });

  it('云端旧版无 batchSync → 退化为逐条上行，delete 同步移除快照', async () => {
    seedQueue([
      task({ taskId: 't1', clientId: 'a', op: 'create' }),
      task({ taskId: 't2', clientId: 'b', op: 'update' }),
      task({ taskId: 't3', clientId: 'c', op: 'delete' }),
    ]);
    snapshot.upsertRecord(rec('c')); // 删除目标先在本地快照

    callMock
      .mockRejectedValueOnce(new ApiCallError('UNKNOWN_ACTION', 'legacy cloud'))
      .mockResolvedValueOnce({ record: rec('a'), conflict: false })
      .mockResolvedValueOnce({ record: rec('b'), conflict: false })
      .mockResolvedValueOnce({ ok: true });

    const s = await flush();
    expect(s).toEqual({ synced: 3, conflicts: 0, failed: 0, interrupted: false });
    expect(queue.count()).toBe(0);
    expect(snapshot.loadSnapshot().map((r) => r.clientId)).not.toContain('c');

    const calls = callMock.mock.calls;
    expect(calls[0][0]).toBe('record.batchSync');
    expect(calls[1]).toEqual([
      'record.upsert',
      { clientId: 'a', op: 'create', payload: { type: 'expense', amount: 100, categoryId: 'food', happenedAt: AT, source: 'manual' }, baseVersion: 0 },
    ]);
    expect(calls[2][0]).toBe('record.upsert');
    expect(calls[3]).toEqual(['record.remove', { clientId: 'c' }]);
  });

  it('通道级失败（NETWORK）→ 整轮中断，任务原样留队', async () => {
    seedQueue([task({ taskId: 't1', clientId: 'a', op: 'create' })]);
    callMock.mockRejectedValueOnce(new ApiCallError('NETWORK', 'offline'));

    const s = await flush();
    expect(s).toEqual({ synced: 0, conflicts: 0, failed: 0, interrupted: true });
    expect(queue.count()).toBe(1);
  });

  it('单条业务失败：tries+1 记录错误并重排队尾，不影响其他任务', async () => {
    seedQueue([task({ taskId: 't1', clientId: 'a', op: 'create' }), task({ taskId: 't2', clientId: 'b', op: 'create' })]);
    callMock.mockResolvedValueOnce({
      results: [
        { taskId: 't1', ok: false, error: 'SERVER_ERROR' },
        { taskId: 't2', ok: true, record: rec('b') },
      ],
    });

    const s = await flush();
    expect(s).toEqual({ synced: 1, conflicts: 0, failed: 1, interrupted: false });
    const rest = queue.getAll();
    expect(rest).toHaveLength(1);
    expect(rest[0].taskId).toBe('t1');
    expect(rest[0].tries).toBe(1);
    expect(rest[0].lastError).toBe('SERVER_ERROR');
  });

  it('conflict 回执：采纳服务端最新文档（LWW 后写胜出之外）', async () => {
    seedQueue([task({ taskId: 't1', clientId: 'a', op: 'update', baseVersion: 1 })]);
    const serverDoc = { ...rec('a'), amount: 9999, version: 5 };
    callMock.mockResolvedValueOnce({ results: [{ taskId: 't1', ok: true, conflict: true, record: serverDoc }] });

    const s = await flush();
    expect(s).toEqual({ synced: 0, conflicts: 1, failed: 0, interrupted: false });
    expect(queue.count()).toBe(0);
    expect(snapshot.loadSnapshot()[0]).toMatchObject({ clientId: 'a', amount: 9999, version: 5 });
  });

  it('tries 超过 MAX_TRIES：任务留在队列标记同步失败，不再重排', async () => {
    seedQueue([task({ taskId: 't1', clientId: 'a', op: 'create', tries: queue.MAX_TRIES })]);
    callMock.mockResolvedValueOnce({ results: [{ taskId: 't1', ok: false, error: 'SERVER_ERROR' }] });

    const s = await flush();
    expect(s?.failed).toBe(1);
    const rest = queue.getAll();
    expect(rest).toHaveLength(1);
    expect(rest[0].tries).toBe(queue.MAX_TRIES + 1);
    expect(queue.isFailed(rest[0])).toBe(true);
  });

  it('已有 flush 在跑：并发触发返回 null', async () => {
    seedQueue([task({ taskId: 't1', clientId: 'a', op: 'create' })]);
    callMock.mockImplementationOnce(
      () => new Promise((res) => setTimeout(() => res({ results: [{ taskId: 't1', ok: true, record: rec('a') }] }), 20))
    );

    const p1 = flush();
    const p2 = flush();
    expect(await p2).toBeNull();
    await p1;
    expect(queue.count()).toBe(0);
  });
});
