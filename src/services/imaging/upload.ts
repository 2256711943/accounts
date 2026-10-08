/**
 * 图片上传管线（D8）—— business service。
 *
 * 编排：`adapters/cloud` 的上传能力 + 本地并发/重试控制。核心承诺是
 * **「上传失败不阻塞记账主流程」**（架构红线：适配层不抛、service 层兜降级）。
 *
 * 设计要点：
 * - **并发上限**（默认 3）：多图上传时限制同时进行的网络数，避免打满带宽拖垮识别链路。
 * - **指数退避重试**：失败按 `base * 2^tries` 递增间隔重试（封顶 capMs），网络抖动可自愈。
 * - **降级**：最终仍失败 → 返回 `{ ok:false, imageFileId:null, queued:true }`，
 *   账单照常落库（图片 fileId 留空），图片进本地 `pendingUploads` 列表待 D10 离线队列补传。
 *
 * 依赖方向：services → adapters/types（红线 1）；不出现 UI（红线 4）。
 * `computeBackoffDelay` / `createConcurrencyLimiter` 为纯函数，可单测；
 * `uploadRecordImage` 依赖 adapter 的 `uploadToCloud`（存在性由测试 mock，见 __tests__）。
 */

import { uploadToCloud as uploadAdapter } from '@/adapters/cloud';

export interface UploadOptions {
  /** 并发上限 */
  concurrency?: number;
  /** 最大重试次数（不含首次尝试） */
  maxTries?: number;
  /** 退避基数（ms） */
  baseDelayMs?: number;
  /** 退避封顶（ms） */
  capDelayMs?: number;
}

/** 上传结果。失败不抛，由调用方读 `ok` 决定降级路径。 */
export interface UploadResult {
  ok: boolean;
  /** 成功时的云存储 fileID（写进 `LedgerRecord.imageFileId`） */
  imageFileId?: string;
  /** true = 当前端不支持云存储（H5），图片未落云，记账不阻塞 */
  unsupported?: boolean;
  /** true = 最终失败，图片已进待重传队列（D10 补传） */
  queued?: boolean;
  errMsg?: string;
  /** 上报用 */
  attempts?: number;
  costMs?: number;
}

const DEFAULT_OPTS: Required<UploadOptions> = {
  concurrency: 3,
  maxTries: 2,
  baseDelayMs: 300,
  capDelayMs: 5000,
};

/** 纯函数：第 `tries` 次重试的退避间隔（ms）。`tries` 从 0 递增。 */
export function computeBackoffDelay(
  tries: number,
  baseDelayMs = DEFAULT_OPTS.baseDelayMs,
  capDelayMs = DEFAULT_OPTS.capDelayMs
): number {
  const raw = baseDelayMs * 2 ** Math.max(tries - 1, 0);
  return Math.min(raw, capDelayMs);
}

/**
 * 并发限制器：把一批异步任务以 `limit` 并发执行，全部完成后 resolve（按入队序收集结果）。
 * 纯函数（返回一个 `run<T>(tasks): Promise<T[]>`），不依赖平台 API，可单测。
 */
export function createConcurrencyLimiter(limit: number) {
  const max = Math.max(1, Math.floor(limit) || 1);
  return async function run<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(max, tasks.length) }, async () => {
      while (cursor < tasks.length) {
        const i = cursor;
        cursor += 1;
        // eslint-disable-next-line no-await-in-loop
        results[i] = await tasks[i]();
      }
    });
    await Promise.all(workers);
    return results;
  };
}

/**
 * 上传一张本地图片，带指数退避重试；最终失败也**不抛**，返回降级结构。
 *
 * @param localPath 压缩后的本地临时路径
 * @param opts 并发/重试配置
 * @returns 见 `UploadResult`。`unsupported`（H5）或最终失败都返回 `ok:false`，
 *          但前者不 `queued`（无云存储可等重试），后者入待补传 `queued:true`。
 */
export async function uploadRecordImage(
  localPath: string,
  opts: UploadOptions = {}
): Promise<UploadResult> {
  const cfg = { ...DEFAULT_OPTS, ...opts };
  const started = Date.now();
  let attempts = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempts += 1;
    const res = await uploadAdapter(localPath);
    if (res.ok) {
      return {
        ok: true,
        imageFileId: res.fileId,
        attempts,
        costMs: Date.now() - started,
      };
    }
    // 能力缺失（H5 无云存储）→ 非重试错误，直接降级返回
    if (res.unsupported) {
      return { ok: false, unsupported: true, errMsg: res.errMsg, attempts, costMs: Date.now() - started };
    }
    // 可重试失败：达到上限则放弃并把图片挂起待补传
    if (attempts > cfg.maxTries) {
      return {
        ok: false,
        queued: true,
        errMsg: res.errMsg ?? '图片上传失败，已挂起待重传',
        attempts,
        costMs: Date.now() - started,
      };
    }
    // 指数退避后重试
    await new Promise((r) => setTimeout(r, computeBackoffDelay(attempts, cfg.baseDelayMs, cfg.capDelayMs)));
  }
}

/** 待补传图片列表（D8 只做挂起记账不阻塞；D10 离线队列将消费该列表补传 imageFileId）。 */
const pendingUploads: string[] = [];

/** 取待补传图片（只读；D10 消费）。 */
export function getPendingUploads(): string[] {
  return pendingUploads.slice();
}

/**
 * 并发上传多张图片。返回逐张结果数组，顺序与入参一致；单张失败不影响其他张（数组元素降级）。
 */
export async function uploadRecordImages(
  localPaths: string[],
  opts: UploadOptions = {}
): Promise<UploadResult[]> {
  if (!localPaths.length) return [];
  const limiter = createConcurrencyLimiter(opts.concurrency ?? DEFAULT_OPTS.concurrency);
  return limiter(localPaths.map((p) => () => uploadRecordImage(p, opts)));
}