/**
 * D13 自研虚拟列表 —— 核心计算单测（纯函数，无 DOM 依赖）。
 * 覆盖：可视区计算（±overscan 屏缓冲 / 边界钳制 / 空列表）、UTF-8 字节口径。
 */
import { describe, expect, it } from 'vitest';
import { computeRange, serializedBytes, utf8Bytes } from '../virtual';

describe('computeRange 可视区计算', () => {
  const ITEM_H = 56;
  const VIEW_H = 560; // 一屏 10 行
  const OVERSCAN = 3;

  it('顶部：start=0，end = 一屏 + 下缓冲（3 屏）行', () => {
    const r = computeRange(0, ITEM_H, VIEW_H, OVERSCAN, 5000);
    expect(r.start).toBe(0);
    expect(r.end).toBe(10 + 30); // 可视 10 + 下缓冲 30
  });

  it('中段滚动：start/end 均按 ±3 屏平移，区间 = 可视 + 上下缓冲 = 70 行', () => {
    // scrollTop = 50 行整，恰好对齐
    const r = computeRange(50 * ITEM_H, ITEM_H, VIEW_H, OVERSCAN, 5000);
    expect(r.start).toBe(50 - 30);
    expect(r.end).toBe(50 + 10 + 30);
    expect(r.end - r.start).toBe(70);
  });

  it('非对齐滚动位置：区间不丢行', () => {
    const r = computeRange(5000, ITEM_H, VIEW_H, OVERSCAN, 5000);
    expect(r.start).toBe(Math.floor(5000 / 56) - 30);
    expect(r.end).toBe(Math.floor((5000 + VIEW_H - 1) / 56) + 1 + 30);
  });

  it('底部：end 钳制到 itemCount', () => {
    const r = computeRange(5000 * ITEM_H, ITEM_H, VIEW_H, OVERSCAN, 5000);
    expect(r.end).toBe(5000);
    expect(r.start).toBe(5000 - 30);
  });

  it('空列表 / 非法行高：返回空区间', () => {
    expect(computeRange(0, ITEM_H, VIEW_H, OVERSCAN, 0)).toEqual({ start: 0, end: 0 });
    expect(computeRange(0, 0, VIEW_H, OVERSCAN, 100)).toEqual({ start: 0, end: 0 });
    expect(computeRange(0, ITEM_H, 0, OVERSCAN, 100)).toEqual({ start: 0, end: 0 });
  });

  it('overscan=0：无缓冲，恰好一屏', () => {
    const r = computeRange(0, ITEM_H, VIEW_H, 0, 5000);
    expect(r.start).toBe(0);
    expect(r.end).toBe(10);
  });

  it('5000 条中段渲染区间 = 70 行（≈7 屏，可视节点数可复现）', () => {
    const r = computeRange(50 * ITEM_H, ITEM_H, VIEW_H, OVERSCAN, 5000);
    expect(r.end - r.start).toBe(70);
  });
});

describe('UTF-8 字节口径', () => {
  it('ASCII 1 字节', () => {
    expect(utf8Bytes('abc')).toBe(3);
  });
  it('中文 3 字节', () => {
    expect(utf8Bytes('餐饮')).toBe(6);
  });
  it('emoji 4 字节', () => {
    expect(utf8Bytes('🧾')).toBe(4);
  });
  it('serializedBytes 序列化对象', () => {
    expect(serializedBytes({ a: '餐饮', b: 123 })).toBeGreaterThan(0);
    expect(serializedBytes(null)).toBe(4); // "null"
  });
});
