/**
 * 图片压缩管线单测：纯函数 + 编排逻辑（mock 掉 adapter 的 I/O）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImage, computeTargetSize, pickQualityStep } from '../compress';

const mocks = vi.hoisted(() => ({
  encodeImage: vi.fn(),
  getImageInfo: vi.fn(),
  getFileSize: vi.fn(),
  getDpr: vi.fn(),
}));

vi.mock('@/adapters/imaging', () => mocks);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getImageInfo.mockResolvedValue({ width: 4000, height: 3000 });
  mocks.getFileSize.mockResolvedValue(4_000_000);
  mocks.getDpr.mockReturnValue(3);
});

describe('computeTargetSize', () => {
  it('长边本就 ≤ maxEdge 时原样返回（不放大）', () => {
    expect(computeTargetSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('超长边按等比降采样到 maxEdge', () => {
    const r = computeTargetSize(4000, 3000, 1600);
    expect(r.width).toBe(1600);
    expect(r.height).toBe(1200);
  });

  it('宽高为 0 / 非法时回退可绘制尺寸', () => {
    expect(computeTargetSize(0, 100, 1600)).toEqual({ width: 1, height: 100 });
  });

  it('maxEdge ≤ 0 时视为不降采样', () => {
    expect(computeTargetSize(2000, 1000, 0)).toEqual({ width: 2000, height: 1000 });
  });
});

describe('pickQualityStep', () => {
  it('取当前阶梯质量', () => {
    expect(pickQualityStep([0.8, 0.6, 0.4], 0)).toBe(0.8);
    expect(pickQualityStep([0.8, 0.6, 0.4], 2)).toBe(0.4);
  });

  it('越界回退到最后一级', () => {
    expect(pickQualityStep([0.8, 0.6, 0.4], 5)).toBe(0.4);
  });

  it('空数组回退 1', () => {
    expect(pickQualityStep([], 0)).toBe(1);
  });
});

describe('compressImage', () => {
  it('命中阈值即停：质量 0.8 超阈值，0.6 命中 → 2 步收口', async () => {
    mocks.encodeImage
      .mockResolvedValueOnce({ tempFilePath: 't1', size: 300_000 })
      .mockResolvedValueOnce({ tempFilePath: 't2', size: 150_000 });

    const m = await compressImage('blob:test', { maxEdge: 1600, sizeLimitBytes: 200_000, qualities: [0.8, 0.6, 0.4] });

    expect(m).not.toBeNull();
    expect(m!.quality).toBe(0.6);
    expect(m!.steps).toBe(2);
    expect(m!.targetWidth).toBe(1600);
    expect(m!.targetHeight).toBe(1200);
    expect(m!.originalSizeBytes).toBe(4_000_000);
    expect(m!.compressedSizeBytes).toBe(150_000);
    expect(m!.ratioPct).toBe(4);
    expect(m!.dpr).toBe(3);
    // encode 传参包含降采样后尺寸与当前质量级
    expect(mocks.encodeImage).toHaveBeenNthCalledWith(1, 'blob:test', { width: 1600, height: 1200, quality: 0.8 });
    expect(mocks.encodeImage).toHaveBeenNthCalledWith(2, 'blob:test', { width: 1600, height: 1200, quality: 0.6 });
  });

  it('全部阶梯未命中 → 保留最低质量兜底', async () => {
    mocks.encodeImage
      .mockResolvedValueOnce({ tempFilePath: 'a', size: 900_000 })
      .mockResolvedValueOnce({ tempFilePath: 'b', size: 600_000 })
      .mockResolvedValueOnce({ tempFilePath: 'c', size: 400_000 });

    const m = await compressImage('blob:t');
    expect(m!.steps).toBe(3);
    expect(m!.quality).toBe(0.4);
    expect(m!.compressedSizeBytes).toBe(400_000);
  });

  it('首次编码即命中阈值 → 只走 1 步', async () => {
    mocks.encodeImage.mockResolvedValueOnce({ tempFilePath: 'a', size: 120_000 });
    const m = await compressImage('blob:t');
    expect(m!.steps).toBe(1);
    expect(m!.quality).toBe(0.8);
  });

  it('读图失败 → 返回 null', async () => {
    mocks.getImageInfo.mockResolvedValueOnce(null);
    expect(await compressImage('blob:t')).toBeNull();
  });

  it('全部编码失败 → 返回 null', async () => {
    mocks.encodeImage.mockResolvedValue(null);
    expect(await compressImage('blob:t')).toBeNull();
  });
});