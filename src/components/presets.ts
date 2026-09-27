/**
 * 自研原子组件（Sg 系列）的共享预设 —— 变体枚举 + 归一化纯函数。
 *
 * 为什么抽成独立文件：7 个组件的「变体合法性校验 + 默认值回退 + 空态文案」是唯一
 * 能脱离 uni-app 运行时做单测的逻辑；组件模板只消费归一化结果，保持模板干净。
 * 单测见 `src/components/__tests__/presets.spec.ts`。
 */

export type SgButtonType = 'primary' | 'ghost' | 'text' | 'danger';
export type SgButtonSize = 'lg' | 'md' | 'sm';
export type SgTagColor = 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type SgTagVariant = 'soft' | 'outline';
export type SgCardType = 'flat' | 'elevated';
export type SgSkeletonType = 'line' | 'card' | 'list';
export type SgAvatarSize = 'md' | 'sm';
export type SgEmptyType = 'no-data' | 'no-network' | 'error';

const BTN_TYPES: readonly SgButtonType[] = ['primary', 'ghost', 'text', 'danger'];
const BTN_SIZES: readonly SgButtonSize[] = ['lg', 'md', 'sm'];
const TAG_COLORS: readonly SgTagColor[] = ['primary', 'success', 'warning', 'danger', 'info'];
const TAG_VARIANTS: readonly SgTagVariant[] = ['soft', 'outline'];
const CARD_TYPES: readonly SgCardType[] = ['flat', 'elevated'];
const SKELETON_TYPES: readonly SgSkeletonType[] = ['line', 'card', 'list'];
const AVATAR_SIZES: readonly SgAvatarSize[] = ['md', 'sm'];
const EMPTY_TYPES: readonly SgEmptyType[] = ['no-data', 'no-network', 'error'];

function oneOf<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

export function normalizeButtonType(value: unknown): SgButtonType {
  return oneOf(value, BTN_TYPES) ? value : 'primary';
}
export function normalizeButtonSize(value: unknown): SgButtonSize {
  return oneOf(value, BTN_SIZES) ? value : 'md';
}
export function normalizeTagColor(value: unknown): SgTagColor {
  return oneOf(value, TAG_COLORS) ? value : 'primary';
}
export function normalizeTagVariant(value: unknown): SgTagVariant {
  return oneOf(value, TAG_VARIANTS) ? value : 'soft';
}
export function normalizeCardType(value: unknown): SgCardType {
  return oneOf(value, CARD_TYPES) ? value : 'flat';
}
export function normalizeSkeletonType(value: unknown): SgSkeletonType {
  return oneOf(value, SKELETON_TYPES) ? value : 'line';
}
export function normalizeAvatarSize(value: unknown): SgAvatarSize {
  return oneOf(value, AVATAR_SIZES) ? value : 'md';
}
export function normalizeEmptyType(value: unknown): SgEmptyType {
  return oneOf(value, EMPTY_TYPES) ? value : 'no-data';
}

/** 空态预设文案：说明现状 + 给出下一步动作，不写「暂无数据」（UI_SPEC §6） */
export interface EmptyPreset {
  emoji: string;
  title: string;
  desc: string;
}
export function emptyPreset(type: SgEmptyType): EmptyPreset {
  switch (type) {
    case 'no-network':
      return { emoji: '📡', title: '网络开小差了', desc: '检查一下网络，然后重试' };
    case 'error':
      return { emoji: '⚠️', title: '出错了', desc: '操作没有成功，请稍后再试' };
    case 'no-data':
    default:
      return { emoji: '🧾', title: '还没有内容', desc: '拍一张小票，开始记账吧' };
  }
}
