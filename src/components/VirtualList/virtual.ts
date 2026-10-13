/**
 * D13 自研虚拟列表 —— 核心计算（纯函数，独立单测）。
 *
 * 职责：给定滚动位置 / 行高 / 可视区高 / 缓冲屏数，计算「应渲染的行区间」；
 * 以及 UTF-8 序列化字节数（setData 数据量口径，DoD「单次 setData ≤8KB」测量）。
 */

export interface VListRange {
  start: number;
  end: number;
}

/**
 * 可视区 + 上下各 overscan 屏缓冲。
 * - viewRows：一屏能装多少行（向上取整）
 * - bufferRows：缓冲行数 = viewRows * overscan（默认 overscan=3 → 上下各 3 屏）
 * - start = 滚动位置所在行 − 上缓冲（≥0）
 * - end   = 滚动位置底部行 + 下缓冲（≤itemCount）
 */
export function computeRange(
  scrollTop: number,
  itemHeight: number,
  viewportHeight: number,
  overscan: number,
  itemCount: number
): VListRange {
  if (itemCount <= 0 || itemHeight <= 0 || viewportHeight <= 0) return { start: 0, end: 0 };
  const viewRows = Math.max(1, Math.ceil(viewportHeight / itemHeight));
  const bufferRows = viewRows * Math.max(0, overscan);
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferRows);
  const lastVisibleRow = Math.floor((scrollTop + viewportHeight - 1) / itemHeight);
  const end = Math.min(itemCount, lastVisibleRow + 1 + bufferRows);
  return { start, end };
}

/** UTF-8 字节数（JSON 序列化后测量，中文 3 字节 / emoji 4 字节）。 */
export function utf8Bytes(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c < 0xd800 || c > 0xdfff) bytes += 3;
    else {
      bytes += 4;
      i += 1;
    }
  }
  return bytes;
}

/** 序列化一组渲染数据的字节数（虚拟列表 setData 数据量口径）。 */
export function serializedBytes(data: unknown): number {
  try {
    return utf8Bytes(JSON.stringify(data));
  } catch {
    return 0;
  }
}
