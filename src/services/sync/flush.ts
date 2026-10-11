/**
 * 离线同步冲刷（D10 亮点 H3）—— 串行出队上行。
 *
 * 流程（ARCHITECTURE.md §4.2）：
 * - 取队头一批 → 优先 `record.batchSync` 一次往返；云端旧版不支持（UNKNOWN_ACTION /
 *   INVALID_PARAM）自动退化为逐条 `record.upsert` / `record.remove`。
 * - 逐条应用回执：成功/冲突 → 出队 + 快照采纳服务端文档（LWW）；失败 → tries+1，
 *   未超限的任务重排队尾（下一轮/下次触发再试），超限留在队列标记「同步失败」。
 * - 通道级失败（NETWORK 等）→ 整轮中断，任务原样留队，等网络恢复 / 手动重试。
 * - flush 串行锁：并发触发只跑一轮（调用方可再补一次覆盖刚入队的任务）。
 *
 * 依赖方向：services → api/types；不出现 UI（红线 4）。
 */

import { ApiCallError, call } from '@/api/client';
import * as queue from './queue';
import * as snapshot from './snapshot';
import type { LedgerRecord, SyncTask } from '@/types/model';
import type { RecordBatchSyncResult } from '@/types/api';

/** 单批最大任务数（服务端 batchSync 上限 50，客户端留余量分批）。 */
const FLUSH_BATCH_SIZE = 20;

/** 一轮 flush 的汇总，供调用方展示/触发收尾。 */
export interface FlushSummary {
  synced: number;
  conflicts: number;
  failed: number;
  /** true = 本轮因通道故障（网络断）中断，队列仍有剩余任务待重试 */
  interrupted: boolean;
}

/** 单任务回执的归一形态（batch 与逐条退化共用）。 */
interface TaskOutcome {
  taskId: string;
  ok: boolean;
  conflict?: boolean;
  record?: LedgerRecord;
  error?: string;
}

let flushing = false;

/** 尝试冲刷队列。若已有 flush 在跑则返回 null（调用方可稍后再补一次）。 */
export async function flush(): Promise<FlushSummary | null> {
  if (flushing) return null;
  flushing = true;
  const summary: FlushSummary = { synced: 0, conflicts: 0, failed: 0, interrupted: false };
  // 每轮 flush 内每个任务只尝试一次（失败的靠下次触发重试，退避间隔由调用方/网络事件调度）
  const attempted = new Set<string>();
  try {
    // 串行多批：直到队列清空或本轮被打断
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = queue
        .getAll()
        .filter((t) => !attempted.has(t.taskId))
        .slice(0, FLUSH_BATCH_SIZE);
      if (batch.length === 0) break;
      for (const t of batch) attempted.add(t.taskId);

      let outcomes: TaskOutcome[];
      try {
        outcomes = await syncBatch(batch);
      } catch (err) {
        // 通道级失败（网络断 / 通道不可用）：整轮中断，任务原样留队
        summary.interrupted = true;
        break;
      }

      const byId = new Map(batch.map((t) => [t.taskId, t]));
      for (const o of outcomes) {
        if (o.ok) {
          queue.removeByTaskId(o.taskId);
          if (o.record) {
            snapshot.upsertRecord(o.record);
          } else {
            // delete 回执无 record：从本地快照移除该条（软删标记不落缓存）
            const t = byId.get(o.taskId);
            if (t?.op === 'delete') snapshot.removeRecord(t.clientId);
          }
          if (o.conflict) summary.conflicts += 1;
          else summary.synced += 1;
          continue;
        }
        // 业务/单条失败：tries+1；未超限 → 重排队尾（下轮再试）
        summary.failed += 1;
        const t = queue.bumpTries(o.taskId, o.error);
        if (t && (t.tries ?? 0) <= queue.MAX_TRIES) queue.requeueToTail(o.taskId);
      }
    }
  } finally {
    flushing = false;
  }
  return summary;
}

/** 上行一批：优先 batchSync，云端旧版退化为逐条。 */
async function syncBatch(batch: SyncTask[]): Promise<TaskOutcome[]> {
  try {
    const data = await call('record.batchSync', { tasks: batch });
    return data.results.map((r) => toOutcome(r));
  } catch (err) {
    const code = err instanceof ApiCallError ? err.code : '';
    if (code === 'UNKNOWN_ACTION' || code === 'INVALID_PARAM') {
      // 云端旧版不支持 batchSync：逐条上行（仍走统一通道，顺序与队列一致）
      const outcomes: TaskOutcome[] = [];
      for (const t of batch) {
        // eslint-disable-next-line no-await-in-loop
        outcomes.push(await syncOne(t));
      }
      return outcomes;
    }
    throw err;
  }
}

function toOutcome(r: RecordBatchSyncResult): TaskOutcome {
  return { taskId: r.taskId, ok: r.ok, conflict: r.conflict, record: r.record, error: r.error };
}

/** 逐条上行单任务（batchSync 退化路径）。通道级失败向上抛，由外层判中断。 */
async function syncOne(t: SyncTask): Promise<TaskOutcome> {
  try {
    if (t.op === 'delete') {
      await call('record.remove', { clientId: t.clientId });
      return { taskId: t.taskId, ok: true };
    }
    const res = await call('record.upsert', {
      clientId: t.clientId,
      op: t.op,
      payload: t.payload,
      baseVersion: t.baseVersion,
    });
    return { taskId: t.taskId, ok: true, conflict: res.conflict, record: res.record };
  } catch (err) {
    if (err instanceof ApiCallError && err.code === 'NETWORK') throw err;
    return { taskId: t.taskId, ok: false, error: err instanceof ApiCallError ? err.code : String(err) };
  }
}
