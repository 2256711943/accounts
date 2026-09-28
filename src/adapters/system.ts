/**
 * 系统能力适配层（跨端）：动效偏好等。
 *
 * ⚠️ 本文件是 `#ifdef` 的合法发生地（AGENTS.md 架构红线 2）。
 * 单文件 + 函数体内 `#ifdef`，禁拆 platform 后缀文件（见 cloud.ts 同款说明 / ARCHITECTURE.md §3.3）。
 * 适配层方法永不抛未捕获异常（架构红线 6）。
 */

/**
 * 用户是否偏好减弱动效。
 *
 * - H5：跟随 `prefers-reduced-motion`
 * - 小程序：无该媒体查询，恒返回 false（用不透传、无异常的降级实现）
 */
export function prefersReducedMotion(): boolean {
  // #ifdef H5
  return (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || false;
  // #endif
  // #ifndef H5
  return false;
  // #endif
}

/** 当前是否运行在微信小程序端。 */
export function isMpWeixin(): boolean {
  // #ifdef MP-WEIXIN
  return true;
  // #endif
  // #ifndef MP-WEIXIN
  return false;
  // #endif
}

/**
 * 系统轻震。非小程序端 no-op（H5 无该能力）。
 * 永不抛未捕获异常（架构红线 6）。
 */
export function vibrateShort(type: 'heavy' | 'medium' | 'light' = 'light'): void {
  if (!isMpWeixin()) return;
  // #ifdef MP-WEIXIN
  try {
    wx.vibrateShort({ type });
  } catch {
    /* 震动失败无碍功能，忽略 */
  }
  // #endif
}