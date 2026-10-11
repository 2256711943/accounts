/**
 * 本地账单快照单测（D10）：缓存直出载体 + 乐观更新落点。
 * snapshot.ts 无值导入（仅 type），无需 vi.mock；只 stub 全局 uni storage。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as snapshot from '../snapshot';
import { installUniStorageMock } from './storage-mock';
import type { LedgerRecord } from '@/types/model';

const AT = 1700000000000;

function rec(clientId: string, amount = 100): LedgerRecord {
  return {
    clientId,
    type: 'expense',
    amount,
    categoryId: 'food',
    happenedAt: AT,
    source: 'manual',
    version: 1,
  };
}

describe('快照读写', () => {
  let uniMock: ReturnType<typeof installUniStorageMock>['uniMock'];

  beforeEach(() => {
    uniMock = installUniStorageMock().uniMock;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('空快照 → 空数组', () => {
    expect(snapshot.loadSnapshot()).toEqual([]);
  });

  it('saveSnapshot + loadSnapshot 往返一致', () => {
    const rows = [rec('a'), rec('b')];
    snapshot.saveSnapshot(rows);
    expect(snapshot.loadSnapshot()).toEqual(rows);
  });

  it('upsertRecord 新记录插到队首（最新在前）', () => {
    snapshot.upsertRecord(rec('a'));
    snapshot.upsertRecord(rec('b'));
    expect(snapshot.loadSnapshot().map((r) => r.clientId)).toEqual(['b', 'a']);
  });

  it('upsertRecord 已存在 → 字段级覆盖，位置不变', () => {
    snapshot.upsertRecord(rec('a', 100));
    snapshot.upsertRecord(rec('b', 200));
    const updated = { ...rec('a', 999), remark: '改过' };
    snapshot.upsertRecord(updated);
    const all = snapshot.loadSnapshot();
    expect(all.map((r) => r.clientId)).toEqual(['b', 'a']); // 新记录插队首，a 仍在原位
    expect(all[1].amount).toBe(999);
    expect(all[1].remark).toBe('改过');
    expect(all[1].categoryId).toBe('food'); // 未提交字段保留
  });

  it('removeRecord 按 clientId 移除', () => {
    snapshot.upsertRecord(rec('a'));
    snapshot.upsertRecord(rec('b'));
    snapshot.removeRecord('a');
    expect(snapshot.loadSnapshot().map((r) => r.clientId)).toEqual(['b']);
  });

  it('存储读异常 → 返回空数组，不抛', () => {
    uniMock.getStorageSync.mockImplementationOnce(() => {
      throw new Error('read failed');
    });
    expect(snapshot.loadSnapshot()).toEqual([]);
  });

  it('存储写异常 → 静默吞掉，不抛', () => {
    uniMock.setStorageSync.mockImplementationOnce(() => {
      throw new Error('quota');
    });
    expect(() => snapshot.saveSnapshot([rec('a')])).not.toThrow();
  });
});
