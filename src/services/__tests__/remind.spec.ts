// remind 客户端服务单测（D14 F7）：订阅授权申请 + 云端额度累加编排
//
// mock '@/adapters/subscribe' 与 '@/api/client'，覆盖四类路径：
//   1. 模板占位 → 跳过，不调 adapter
//   2. 用户允许（accept）→ 调云端 subscribe.register
//   3. 非 accept（拒绝/不支持）→ 跳过，不调云端
//   4. 通道失败 → 静默降级，不抛异常（红线 6 / 不阻塞记账）

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 先 mock 依赖，再动态导入被测模块（保持模板占位常量可测）
const requestSubscribe = vi.fn();
vi.mock('@/adapters/subscribe', () => ({
  requestSubscribe: (...args: unknown[]) => requestSubscribe(...args),
}));

const call = vi.fn();
vi.mock('@/api/client', () => ({
  call: (...args: unknown[]) => call(...args),
}));

import * as remind from '../remind';

const TEMPLATE = 'tmpl-remind-001';

describe('registerRemindQuota（D14 F7）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('模板占位（默认参数）：直接跳过，不调 adapter 不调云端', async () => {
    const res = await remind.registerRemindQuota();
    expect(res.skipped).toBe(true);
    expect(requestSubscribe).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });

  it('用户允许（accept）：调云端 subscribe.register，返回 ok', async () => {
    requestSubscribe.mockResolvedValue({ status: 'accept' });
    call.mockResolvedValue({ ok: true });
    const res = await remind.registerRemindQuota(TEMPLATE);
    expect(res).toEqual({ ok: true, skipped: false });
    expect(requestSubscribe).toHaveBeenCalledWith(TEMPLATE);
    expect(call).toHaveBeenCalledWith('subscribe.register', { templateId: TEMPLATE });
  });

  it('用户拒绝/端不支持（非 accept）：跳过，不调云端', async () => {
    requestSubscribe.mockResolvedValue({ status: 'reject' });
    const res = await remind.registerRemindQuota(TEMPLATE);
    expect(res.skipped).toBe(true);
    expect(call).not.toHaveBeenCalled();
  });

  it('adapter 抛错：静默降级不抛，记账不受影响', async () => {
    requestSubscribe.mockRejectedValue(new Error('subscribe unavailable'));
    await expect(remind.registerRemindQuota(TEMPLATE)).resolves.toEqual({ ok: false, skipped: true });
  });

  it('云端调用失败：静默降级不抛', async () => {
    requestSubscribe.mockResolvedValue({ status: 'accept' });
    call.mockRejectedValue(new Error('network down'));
    const res = await remind.registerRemindQuota(TEMPLATE);
    expect(res.skipped).toBe(true);
  });
});
