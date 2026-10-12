/**
 * 离线同步队列（D10 亮点 H3）—— 本地持久化的 SyncTask 队列。
 *
 * 存储键：`sl:sync:queue`（uni storage，跨端；key 见 ARCHITECTURE.md §4.2）。
 * 语义：
 * - 队列即「待同步」全集；flush 串行出队，保证同一 clientId 的操作有序。
 * - 入队做**同 clientId 合并**（字段级后写覆盖），降低冲突面：
 *   - `update` 并入既有 create/update 任务的 payload（保留最早基线 baseVersion）
 *   - `delete` 取代同 clientId 的所有既有任务（删除即终态，后续 update 作废）
 * - `tries` 计数 + 指数退避（`computeBackoffMs` 暴露给上层调度）；
 *   `tries > MAX_TRIES` 视为「同步失败」（D11 列表项出「重试」按钮）。
 *
 * 依赖方向：services → types；只依赖 uni storage 全局（异常被吞，可单测）。
 */

import { generateId } from '@/utils/id';
import type { LedgerRecord, SyncOp, SyncTask } from '@/types/model';

/** 本地队列存储键（ARCHITECTURE.md §4.2）。 */
export const SYNC_QUEUE_KEY = 'sl:sync:queue';

/** 单任务重试上限：超过即标记「同步失败」。 */
export const MAX_TRIES = 5;

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30000;

/** 纯函数：第 `tries` 次重试的退避间隔（ms）。`tries` 从 1 起。 */
export function computeBackoffMs(tries: number, baseMs = BACKOFF_BASE_MS, capMs = BACKOFF_CAP_MS): number {
  const raw = baseMs * 2 ** Math.max(tries - 1, 0);
  return Math.min(raw, capMs);
}

/** 入队入参：taskId / tries / createdAt 由队列生成。 */
export interface EnqueueInput {
  clientId: string;
  op: SyncOp;
  payload: Partial<LedgerRecord>;
  baseVersion: number;
}

function readAll(): SyncTask[] {
  try {
    const raw = uni.getStorageSync(SYNC_QUEUE_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (t): t is SyncTask =>
        !!t && typeof t.taskId === 'string' && typeof t.clientId === 'string' && typeof t.op === 'string'
    );
  } catch {
    // uni 不可用（如单测环境）或存储读失败 → 视为空队列，不抛（适配层/本地层契约）
    return [];
  }
}

function writeAll(next: SyncTask[]): void {
  try {
    uni.setStorageSync(SYNC_QUEUE_KEY, next);
  } catch {
    /* 存储满等异常：内存操作已完成，持久化失败不致命（下次触发重写） */
  }
}

/**
 * 入队（带同 clientId 合并）。返回入队结果（可能是合并后的既有任务）。
 */
export function enqueue(input: EnqueueInput): SyncTask {
  const all = readAll();
  const idx = all.findIndex((t) => t.clientId === input.clientId);

  if (input.op === 'delete') {
    // delete 是终态：取代同 clientId 的既有任务（create/update 全部作废）
    const task: SyncTask = { taskId: generateId(), ...input, tries: 0, createdAt: Date.now() };
    if (idx >= 0) all[idx] = task;
    else all.push(task);
    writeAll(all);
    return task;
  }

  if (idx >= 0) {
    const prev = all[idx];
    if (prev.op === 'delete') {
      // 已排删除：本次更新作废，保留删除任务（后写覆盖策略里删除胜出）
      writeAll(all);
      return prev;
    }
    // 字段级合并：update 吸收进既有 create/update 载荷，后写覆盖；保留最早基线
    const merged: SyncTask = {
      ...prev,
      op: prev.op === 'create' ? 'create' : 'update',
      payload: { ...prev.payload, ...input.payload },
      baseVersion: prev.baseVersion,
      tries: 0,
      lastError: undefined,
    };
    all[idx] = merged;
    writeAll(all);
    return merged;
  }

  const task: SyncTask = { taskId: generateId(), ...input, tries: 0, createdAt: Date.now() };
  all.push(task);
  writeAll(all);
  return task;
}

/** 队列长度。 */
export function count(): number {
  return readAll().length;
}

/** 是否有针对某账单的待同步任务。 */
export function hasPending(clientId: string): boolean {
  return readAll().some((t) => t.clientId === clientId);
}

/** 有未同步任务的 clientId 集合。 */
export function pendingClientIds(): Set<string> {
  return new Set(readAll().map((t) => t.clientId));
}

/** 取队头最多 n 个任务（FIFO，不动队列）。 */
export function peekBatch(n: number): SyncTask[] {
  return readAll().slice(0, Math.max(1, n));
}

/** 全部任务的拷贝（供 UI 镜像待同步数/失败标记）。 */
export function getAll(): SyncTask[] {
  return readAll().map((t) => ({ ...t }));
}

/** 按 taskId 出队（同步成功后调用）。 */
export function removeByTaskId(taskId: string): void {
  writeAll(readAll().filter((t) => t.taskId !== taskId));
}

/** 重试计数 +1 并记录错误。返回更新后的任务；不存在返回 undefined。 */
export function bumpTries(taskId: string, error?: string): SyncTask | undefined {
  const all = readAll();
  const idx = all.findIndex((t) => t.taskId === taskId);
  if (idx < 0) return undefined;
  const next = { ...all[idx], tries: (all[idx].tries ?? 0) + 1, lastError: error };
  all[idx] = next;
  writeAll(all);
  return next;
}

/** 失败重排到队尾（保留 tries），避免队头阻塞与同一轮热重试。 */
export function requeueToTail(taskId: string): void {
  const all = readAll();
  const idx = all.findIndex((t) => t.taskId === taskId);
  if (idx < 0) return;
  const [task] = all.splice(idx, 1);
  all.push(task);
  writeAll(all);
}

/** 是否超过重试上限（视为同步失败，列表项出「重试」）。 */
export function isFailed(task: SyncTask): boolean {
  return (task.tries ?? 0) > MAX_TRIES;
}

/**
 * 重置某账单的全部任务的重试计数（D11「重试」按钮）：
 * 清零 tries 与 lastError，让任务重新可被 flush。返回是否有任务被重置。
 */
export function resetTries(clientId: string): boolean {
  const all = readAll();
  let changed = false;
  for (let i = 0; i < all.length; i++) {
    if (all[i].clientId === clientId && (all[i].tries ?? 0) > 0) {
      all[i] = { ...all[i], tries: 0, lastError: undefined };
      changed = true;
    }
  }
  if (changed) writeAll(all);
  return changed;
}

/** 清空队列（我的页「清空本地缓存」用）。 */
export function clear(): void {
  try {
    uni.removeStorageSync(SYNC_QUEUE_KEY);
  } catch {
    /* 忽略 */
  }
}
