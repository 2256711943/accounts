/**
 * D13 性能埋点单测：mergeStats 聚合（T1 / setData / API TOP5 / 错误 / 压缩）、
 * 攒批落盘（满 10 条自动 flush）、snapshot 合并内存缓冲。
 * perf.ts 顶层引用全局 `uni`（vitest node 无全局 uni），用 installUniStorageMock stub。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as perf from '../perf';

/** 内联 uni storage stub（vitest node 无全局 uni）。 */
function installStorageStub(): Map<string, unknown> {
  const store = new Map<string, unknown>();
  vi.stubGlobal('uni', {
    getStorageSync: vi.fn((key: string) => store.get(key)),
    setStorageSync: vi.fn((key: string, value: unknown) => void store.set(key, value)),
    removeStorageSync: vi.fn((key: string) => void store.delete(key)),
  });
  return store;
}

describe('mergeStats（纯函数聚合）', () => {
  it('时序 t1 取最近值；setData 累计字节/次数/单次最大', () => {
    const base = perf.mergeStats({} as perf.PerfStats, [
      { kind: 'timing', key: 't1', ms: 800 },
      { kind: 'setdata', bytes: 2048 },
      { kind: 'setdata', bytes: 4096 },
    ]);
    expect(base.t1).toBe(800);
    expect(base.setdataBytes).toBe(6144);
    expect(base.setdataCount).toBe(2);
    expect(base.setdataMax).toBe(4096);
  });

  it('api 按平均耗时降序截 TOP5', () => {
    const stats = perf.mergeStats({} as perf.PerfStats, [
      { kind: 'api', name: 'record.list', ms: 300 },
      { kind: 'api', name: 'record.list', ms: 100 },
      { kind: 'api', name: 'user.login', ms: 50 },
      { kind: 'api', name: 'slow.a', ms: 900 },
      { kind: 'api', name: 'slow.b', ms: 800 },
      { kind: 'api', name: 'slow.c', ms: 700 },
      { kind: 'api', name: 'slow.d', ms: 600 },
      { kind: 'api', name: 'slow.e', ms: 500 },
      { kind: 'api', name: 'slow.f', ms: 400 },
    ]);
    expect(stats.apiTop.map((a) => a.name)).toEqual(['slow.a', 'slow.b', 'slow.c', 'slow.d', 'slow.e']);
    expect(stats.apiTop[0].avgMs).toBe(900);
    expect(stats.apiTop[0].count).toBe(1);
    // record.list 聚合平均 (300+100)/2 = 200，不在 TOP5
  });

  it('错误按 source 聚合计数；压缩取最近一次', () => {
    const stats = perf.mergeStats({} as perf.PerfStats, [
      { kind: 'error', source: 'fetch', message: 'NETWORK' },
      { kind: 'error', source: 'fetch', message: 'NETWORK' },
      { kind: 'compress', bytesIn: 1000, bytesOut: 300, ms: 12 },
    ]);
    expect(stats.errors).toEqual([{ source: 'fetch', count: 2 }]);
    expect(stats.compress).toEqual({ bytesIn: 1000, bytesOut: 300, ms: 12 });
  });

  it('在既有统计上增量合并，不丢失旧数据', () => {
    const base = perf.mergeStats({} as perf.PerfStats, [
      { kind: 'api', name: 'a', ms: 100 },
      { kind: 'setdata', bytes: 100 },
    ]);
    const next = perf.mergeStats(base, [
      { kind: 'api', name: 'a', ms: 300 },
      { kind: 'setdata', bytes: 200 },
    ]);
    expect(next.apiTop[0]).toEqual({ name: 'a', avgMs: 200, count: 2 });
    expect(next.setdataBytes).toBe(300);
    expect(next.totalEvents).toBe(4);
  });
});

describe('埋点 API 与攒批', () => {
  beforeEach(() => {
    installStorageStub();
    perf._resetForTest();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('markTiming 的 ms 为相对 launch 的毫秒', () => {
    perf.markLaunch();
    vi.advanceTimersByTime(1500);
    perf.markTiming('t1');
    const s = perf.snapshot();
    expect(s.t1).toBe(1500);
  });

  it('满 10 条自动落盘：snapshot 命中持久化聚合', () => {
    perf.markLaunch();
    for (let i = 0; i < 10; i += 1) {
      perf.recordSetdata(1024 + i);
    }
    const s = perf.snapshot();
    expect(s.setdataCount).toBe(10);
    expect(s.setdataBytes).toBe(1024 * 10 + 45); // 1024..1033
    // 已自动落盘：内存缓冲应已清空（snapshot 仍能读到持久化聚合）
    expect(s.totalEvents).toBe(10);
  });

  it('measureApi 返回 stop()，调用后记录耗时', () => {
    perf.markLaunch();
    const stop = perf.measureApi('record.list');
    vi.advanceTimersByTime(230);
    stop();
    expect(perf.snapshot().apiTop[0]).toMatchObject({ name: 'record.list', avgMs: 230 });
  });

  it('flush 强制落盘并触发 reporter', () => {
    const spy = vi.fn();
    perf.setReporter(spy);
    perf.recordSetdata(512);
    perf.flush();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].setdataBytes).toBe(512);
  });

  it('_resetForTest 清空状态', () => {
    perf.recordSetdata(100);
    perf._resetForTest();
    expect(perf.snapshot()).toMatchObject({ setdataBytes: 0, totalEvents: 0 });
  });
});
