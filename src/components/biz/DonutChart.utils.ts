/**
 * DonutChart 纯函数工具 —— 与 uni/canvas 运行时解耦，供组件与单测共用。
 */

/** 把 hex → `rgba(hex, alpha)`，供未选中扇区降透明。非法输入原样返回（不抛）。 */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.replace(/\s/g, ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
