/**
 * 图片上传管线纯函数单测（D8）：退避间隔 + 并发限制器。
 * `uploadRecordImage` 依赖 adapter 的 `uploadToCloud`，此处只测可独立验证的纯函数。
 */

import { describe, expect, it, vi } from 'vitest';
import { computeBackoffDelay, createConcurrencyLimiter } from '../upload';

// upload.ts 顶层 import 了 adapter；纯函数虽不使用它，但模块加载会触发，
// 用 vi.mock 短路，避免在纯函数测试里真实解析云适配层（同 compress.spec 策略）。
vi.mock('@/adapters/cloud', () => ({ uploadToCloud: vi.fn() }));

describe('computeBackoffDelay', () => {
  it('第 1 次重试即用基数（2^0）', () => {
    expect(computeBackoffDelay(1, 300, 5000)).toBe(300);
  });

  it('第 2 次重试翻倍', () => {
    expect(computeBackoffDelay(2, 300, 5000)).toBe(600);
  });

  it('指数增长：第 4 次为基数×8', () => {
    expect(computeBackoffDelay(4, 300, 5000)).toBe(2400);
  });

  it('封顶 capMs，超出不再涨', () => {
    expect(computeBackoffDelay(10, 300, 5000)).toBe(5000);
  });
});

describe('createConcurrencyLimiter', () => {
  it('并发数不超高 <limit>：同一时刻并行任务数 ≤ limit', async () => {
    const run = createConcurrencyLimiter(2);
    let parallel = 0;
    let peak = 0;
    const tasks = Array.from({ length: 5 }, () => async () => {
      parallel += 1;
      peak = Math.max(peak, parallel);
      await new Promise((r) => setTimeout(r, 20));
      parallel -= 1;
      return 1;
    });
    const results = await run(tasks);
    expect(results).toEqual([1, 1, 1, 1, 1]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('结果按入队顺序返回（不完全按完成序）', async () => {
    const run = createConcurrencyLimiter(1);
    const results = await run([
      async () => {
        await new Promise((r) => setTimeout(r, 30));
        return 'a';
      },
      async () => 'b',
      async () => 'c',
    ]);
    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('limit ≤ 0 时退化为 1 并发', async () => {
    const run = createConcurrencyLimiter(0);
    let peak = 0;
    let cur = 0;
    await run(
      Array.from({ length: 3 }, () => async () => {
        cur += 1;
        peak = Math.max(peak, cur);
        await new Promise((r) => setTimeout(r, 10));
        cur -= 1;
      })
    );
    expect(peak).toBeLessThanOrEqual(1);
  });
});