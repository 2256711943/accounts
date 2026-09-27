import { describe, expect, it } from 'vitest';
import {
  emptyPreset,
  normalizeAvatarSize,
  normalizeButtonSize,
  normalizeButtonType,
  normalizeCardType,
  normalizeEmptyType,
  normalizeSkeletonType,
  normalizeTagColor,
  normalizeTagVariant
} from '../presets';

describe('normalize* 变体归一化', () => {
  it.each([
    ['primary', 'primary'],
    ['ghost', 'ghost'],
    ['text', 'text'],
    ['danger', 'danger'],
    ['link', 'primary'],
    [undefined, 'primary'],
    ['', 'primary']
  ])('normalizeButtonType(%j) → %s', (input, expected) => {
    expect(normalizeButtonType(input)).toBe(expected);
  });

  it.each([
    ['lg', 'lg'],
    ['md', 'md'],
    ['sm', 'sm'],
    ['xl', 'md'],
    [123, 'md'],
    [null, 'md']
  ])('normalizeButtonSize(%j) → %s', (input, expected) => {
    expect(normalizeButtonSize(input)).toBe(expected);
  });

  it.each([
    ['primary', 'primary'],
    ['success', 'success'],
    ['warning', 'warning'],
    ['danger', 'danger'],
    ['info', 'info'],
    ['purple', 'primary']
  ])('normalizeTagColor(%j) → %s', (input, expected) => {
    expect(normalizeTagColor(input)).toBe(expected);
  });

  it.each([
    ['soft', 'soft'],
    ['outline', 'outline'],
    ['solid', 'soft'],
    [false, 'soft']
  ])('normalizeTagVariant(%j) → %s', (input, expected) => {
    expect(normalizeTagVariant(input)).toBe(expected);
  });

  it.each([
    ['flat', 'flat'],
    ['elevated', 'elevated'],
    ['shadow', 'flat'],
    [null, 'flat']
  ])('normalizeCardType(%j) → %s', (input, expected) => {
    expect(normalizeCardType(input)).toBe(expected);
  });

  it.each([
    ['line', 'line'],
    ['card', 'card'],
    ['list', 'list'],
    ['table', 'line'],
    [undefined, 'line']
  ])('normalizeSkeletonType(%j) → %s', (input, expected) => {
    expect(normalizeSkeletonType(input)).toBe(expected);
  });

  it.each([
    ['md', 'md'],
    ['sm', 'sm'],
    ['lg', 'md'],
    ['', 'md']
  ])('normalizeAvatarSize(%j) → %s', (input, expected) => {
    expect(normalizeAvatarSize(input)).toBe(expected);
  });

  it.each([
    ['no-data', 'no-data'],
    ['no-network', 'no-network'],
    ['error', 'error'],
    ['empty', 'no-data'],
    [42, 'no-data']
  ])('normalizeEmptyType(%j) → %s', (input, expected) => {
    expect(normalizeEmptyType(input)).toBe(expected);
  });
});

describe('emptyPreset 空态文案', () => {
  it('no-data：说明现状 + 给出下一步动作，不写"暂无数据"', () => {
    const p = emptyPreset('no-data');
    expect(p).toMatchObject({ emoji: '🧾', title: '还没有内容' });
    expect(p.desc).toContain('拍一张小票');
  });

  it('no-network：指向网络问题与重试动作', () => {
    const p = emptyPreset('no-network');
    expect(p).toMatchObject({ emoji: '📡', title: '网络开小差了' });
    expect(p.desc).toContain('重试');
  });

  it('error：说明发生了什么 + 用户能做什么', () => {
    const p = emptyPreset('error');
    expect(p).toMatchObject({ emoji: '⚠️', title: '出错了' });
    expect(p.desc).toContain('稍后再试');
  });

  it('三态文案互不相同，且 emoji 各不相同', () => {
    const types = ['no-data', 'no-network', 'error'] as const;
    const emojis = types.map((t) => emptyPreset(t).emoji);
    expect(new Set(emojis).size).toBe(3);
  });
});
