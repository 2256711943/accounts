/**
 * 本地账单快照（D10）—— `sl:records:cache`。
 *
 * 用途（ARCHITECTURE.md §4.2）：
 * - 首屏缓存直出：先渲染快照再静默拉取服务端，弱网/离线时 UI 不空。
 * - 乐观更新载体：本地新增/修改立即写快照，pending 记录在刷新时以快照覆盖服务端（后写胜出）。
 *
 * 只依赖 uni storage 全局（异常被吞），不依赖 adapter/api，可单测。
 */

import type { LedgerRecord } from '@/types/model';

/** 快照存储键（ARCHITECTURE.md §4.2）。 */
export const SNAPSHOT_KEY = 'sl:records:cache';

/** 读快照；无数据或读取失败返回空数组（不抛）。 */
export function loadSnapshot(): LedgerRecord[] {
  try {
    const raw = uni.getStorageSync(SNAPSHOT_KEY);
    return Array.isArray(raw) ? (raw as LedgerRecord[]) : [];
  } catch {
    return [];
  }
}

/** 整体覆盖写快照。 */
export function saveSnapshot(records: LedgerRecord[]): void {
  try {
    uni.setStorageSync(SNAPSHOT_KEY, records);
  } catch {
    /* 存储满等异常：忽略，下次触发重写 */
  }
}

/** 合并/插入一条记录到快照（按 clientId；已存在则字段级覆盖）。 */
export function upsertRecord(record: LedgerRecord): void {
  const all = loadSnapshot();
  const idx = all.findIndex((r) => r.clientId === record.clientId);
  if (idx >= 0) all[idx] = { ...all[idx], ...record };
  else all.unshift(record);
  saveSnapshot(all);
}

/** 从快照移除（本地删除/软删展示）。 */
export function removeRecord(clientId: string): void {
  saveSnapshot(loadSnapshot().filter((r) => r.clientId !== clientId));
}
