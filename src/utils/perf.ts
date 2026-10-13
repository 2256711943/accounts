/**
 * D13 性能埋点（亮点 H4）—— 覆盖 启动 / 渲染 / 接口 / 错误 四类指标 + setData / 压缩。
 *
 * 设计：事件采集 → 内存缓冲 → 攒批落盘（满 10 条或距上次 10s）→ 聚合统计写本地 `sl:perf`。
 * 开发面板直接读本地聚合（T1 / setData 数据量 / 接口耗时 TOP5 / 错误计数），
 * 不依赖云上报；`setReporter` 预留上报钩子（默认本地面板消费，控制改动半径）。
 *
 * 依赖方向：utils → 无（纯工具 + uni storage，H5 即 localStorage，可单测）。
 */
const STORAGE_KEY = 'sl:perf';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 10_000;

/** 时序埋点键：t1 = 启动到首页首屏可用；pageReady = 页面渲染完成；launch = 启动锚点。 */
export type TimingKey = 't1' | 'pageReady';

export type PerfEvent =
  | { kind: 'timing'; key: TimingKey; ms: number }
  | { kind: 'api'; name: string; ms: number }
  | { kind: 'setdata'; bytes: number }
  | { kind: 'compress'; bytesIn: number; bytesOut: number; ms: number }
  | { kind: 'error'; source: string; message: string };

/** 聚合统计（面板展示用，持久化在本地）。 */
export interface PerfStats {
  /** 最近一次 T1（ms） */
  t1: number | null;
  /** setData 总量（字节）/ 次数 / 单次最大字节 */
  setdataBytes: number;
  setdataCount: number;
  setdataMax: number;
  /** 接口耗时 TOP5（按平均耗时降序） */
  apiTop: { name: string; avgMs: number; count: number }[];
  /** 错误计数 */
  errors: { source: string; count: number }[];
  /** 压缩管线（最近一次） */
  compress: { bytesIn: number; bytesOut: number; ms: number } | null;
  /** 累计事件数（面板展示采样规模） */
  totalEvents: number;
  updatedAt: number;
}

const EMPTY: PerfStats = {
  t1: null,
  setdataBytes: 0,
  setdataCount: 0,
  setdataMax: 0,
  apiTop: [],
  errors: [],
  compress: null,
  totalEvents: 0,
  updatedAt: 0,
};

let buffer: PerfEvent[] = [];
let lastFlush = 0;
let launchAt = 0;
let reporter: ((stats: PerfStats) => void) | null = null;

function load(): PerfStats {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY);
    return raw ? { ...EMPTY, ...(typeof raw === 'string' ? JSON.parse(raw) : raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

function persist(stats: PerfStats): void {
  stats.updatedAt = Date.now();
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    /* 存储满等异常：埋点丢失不阻塞业务 */
  }
}

/** 把一批事件合并进聚合统计（纯函数，可单测）。 */
export function mergeStats(base: PerfStats, events: PerfEvent[]): PerfStats {
  const src = { ...EMPTY, ...base };
  const s: PerfStats = {
    ...src,
    errors: [...src.errors],
  };
  const api = new Map<string, { sum: number; count: number }>();
  for (const a of src.apiTop) api.set(a.name, { sum: a.avgMs * a.count, count: a.count });
  const err = new Map<string, number>(src.errors.map((e) => [e.source, e.count]));

  for (const e of events) {
    s.totalEvents += 1;
    switch (e.kind) {
      case 'timing':
        if (e.key === 't1') s.t1 = e.ms;
        break;
      case 'setdata':
        s.setdataBytes += e.bytes;
        s.setdataCount += 1;
        s.setdataMax = Math.max(s.setdataMax, e.bytes);
        break;
      case 'api': {
        const cur = api.get(e.name) ?? { sum: 0, count: 0 };
        cur.sum += e.ms;
        cur.count += 1;
        api.set(e.name, cur);
        break;
      }
      case 'compress':
        s.compress = { bytesIn: e.bytesIn, bytesOut: e.bytesOut, ms: e.ms };
        break;
      case 'error': {
        err.set(e.source, (err.get(e.source) ?? 0) + 1);
        break;
      }
    }
  }
  s.apiTop = [...api.entries()]
    .map(([name, v]) => ({ name, avgMs: Math.round(v.sum / v.count), count: v.count }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 5);
  s.errors = [...err.entries()].map(([source, count]) => ({ source, count }));
  return s;
}

function flushNow(): PerfStats {
  if (buffer.length === 0) return load();
  const stats = mergeStats(load(), buffer);
  buffer = [];
  lastFlush = Date.now();
  persist(stats);
  reporter?.(stats);
  return stats;
}

function push(e: PerfEvent): void {
  buffer.push(e);
  if (buffer.length >= BATCH_SIZE || (lastFlush > 0 && Date.now() - lastFlush >= FLUSH_INTERVAL_MS)) {
    flushNow();
  }
}

/* ── 对外埋点 API ── */

/** App onLaunch 调用：锚定启动时刻（T1 起点）。 */
export function markLaunch(): void {
  launchAt = Date.now();
}

/** 记录一次时序点：ms = 相对启动的毫秒。 */
export function markTiming(key: TimingKey, at = Date.now()): void {
  push({ kind: 'timing', key, ms: at - launchAt });
}

/** 包裹一次接口调用：返回 stop()，调用时记录耗时。 */
export function measureApi(name: string): () => void {
  const t = Date.now();
  return () => push({ kind: 'api', name, ms: Date.now() - t });
}

/** 记录一次 setData 序列化字节数。 */
export function recordSetdata(bytes: number): void {
  push({ kind: 'setdata', bytes });
}

/** 记录压缩管线：输入/输出字节 + 耗时。 */
export function recordCompress(bytesIn: number, bytesOut: number, ms: number): void {
  push({ kind: 'compress', bytesIn, bytesOut, ms });
}

/** 记录错误。 */
export function recordError(source: string, message: string): void {
  push({ kind: 'error', source, message });
}

/** 强制落盘（同步前 / 页面卸载时调用）。 */
export function flush(): PerfStats {
  return flushNow();
}

/** 面板读取聚合。 */
export function snapshot(): PerfStats {
  return buffer.length > 0 ? mergeStats(load(), buffer) : load();
}

/** 注入上报钩子（默认空：本地面板消费；扩展云上报时在此接入 call 通道）。 */
export function setReporter(fn: ((stats: PerfStats) => void) | null): void {
  reporter = fn;
}

/** 测试辅助：清空全部状态。 */
export function _resetForTest(): void {
  buffer = [];
  lastFlush = 0;
  launchAt = 0;
  reporter = null;
  try {
    uni.removeStorageSync(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
