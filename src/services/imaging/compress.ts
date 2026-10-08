/**
 * 图片压缩管线（亮点 H2）—— business service。
 *
 * 策略：先按长边降采样，再阶梯压 jpg 质量，首次 ≤ 阈值即停（省时且可控体积）。
 * 平台差异（解码 / 编码 / 取字节数）全部收敛在 `adapters/imaging`，本文件只做编排 + 埋点。
 *
 * 依赖方向：services → adapters（红线 1），不出现 UI 代码（红线 4）。
 *
 * 可单测部分：`computeTargetSize` / `pickQualityStep` 是纯函数；
 * `compressImage` 依赖 adapter 的 I/O，单测时注入 mock（见 __tests__/compress.spec.ts）。
 */

import { encodeImage, getDpr, getFileSize, getImageInfo } from '@/adapters/imaging';
import type { EncodeOutcome } from '@/adapters/imaging';

/** 压缩目标配置。 */
export interface CompressTarget {
  /** 长边上限（超出则等比降采样） */
  maxEdge: number;
  /** 压缩阈值：首次 size ≤ sizeLimitBytes 即停止阶梯 */
  sizeLimitBytes: number;
  /** 阶梯质量（降序，越靠后体积越小） */
  qualities: number[];
}

/** D6 尺寸下的默认目标：长边 1600 · ≤200KB · 质量 0.8/0.6/0.4。 */
export const DEFAULT_TARGET: CompressTarget = {
  maxEdge: 1600,
  sizeLimitBytes: 200_000,
  qualities: [0.8, 0.6, 0.4],
};

export interface CompressMetrics {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  /** 最终命中/兜底的质量级 */
  quality: number;
  /** 尝试过的质量阶梯数 */
  steps: number;
  costMs: number;
  dpr: number;
  /** 压缩比（%）：compressed / original */
  ratioPct: number;
}

/**
 * 纯函数：计算等比例降采样后的目标尺寸（长边 ≤ maxEdge）。
 * 长边本就 ≤ maxEdge 时原样返回。非法输入回退原始尺寸。
 */
export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: Math.max(1, Math.round(width || 1)), height: Math.max(1, Math.round(height || 1)) };
  }
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) {
    return { width, height };
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 纯函数：取第 index 步应使用的质量级；越界回退最后一级。 */
export function pickQualityStep(qualities: number[], index: number): number {
  if (!Array.isArray(qualities) || qualities.length === 0) return 1;
  const i = Math.min(Math.max(Math.floor(index), 0), qualities.length - 1);
  return qualities[i];
}

/**
 * 压缩一张图片（以发热但可接受的按步重新解码换取实现清晰，D8 可缓存中间位图）。
 * 返回 line;失败返回 null。`sourceSizeBytes` 用于记录压缩比，可不传（走 adapter 探测）。
 */
export async function compressImage(
  src: string,
  target: CompressTarget = DEFAULT_TARGET
): Promise<CompressMetrics | null> {
  const start = Date.now();
  const info = await getImageInfo(src);
  if (!info) return null;

  const dpr = getDpr();
  const targetSize = computeTargetSize(info.width, info.height, target.maxEdge);
  const originalSizeBytes = (await getFileSize(src)) ?? 0;

  // 阶梯压质量：首次命中阈值即停；全部未命中则保留最后一级最低质量。
  let last: EncodeOutcome | null = null;
  let quality = pickQualityStep(target.qualities, 0);
  let steps = 0;
  for (let i = 0; i < target.qualities.length; i += 1) {
    quality = pickQualityStep(target.qualities, i);
    const out = await encodeImage(src, { width: targetSize.width, height: targetSize.height, quality });
    steps += 1;
    if (!out) {
      // 编码失败：若已有更高质量命中可保留，否则终结
      if (last) break;
      return null;
    }
    last = out;
    if (out.size <= target.sizeLimitBytes) break;
  }

  if (!last) return null;
  return {
    sourceWidth: info.width,
    sourceHeight: info.height,
    targetWidth: targetSize.width,
    targetHeight: targetSize.height,
    originalSizeBytes,
    compressedSizeBytes: last.size,
    quality,
    steps,
    costMs: Date.now() - start,
    dpr,
    ratioPct: originalSizeBytes > 0 ? Math.round((last.size / originalSizeBytes) * 100) : 0,
  };
}