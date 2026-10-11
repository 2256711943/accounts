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

/**
 * 网络状态变化订阅（D10 离线队列：断网/恢复时驱动同步调度）。
 * 返回退订函数；能力缺失时退订为 no-op（永不抛，红线 6）。
 */
export function onNetworkChange(cb: (online: boolean) => void): () => void {
  // #ifdef MP-WEIXIN
  try {
    if (typeof wx.onNetworkStatusChange === 'function') {
      const handler = (res: WxNetwork.StatusResult) => cb(!!res.isConnected);
      wx.onNetworkStatusChange(handler);
      return () => {
        try {
          wx.offNetworkStatusChange(handler);
        } catch {
          /* 忽略 */
        }
      };
    }
  } catch {
    /* 能力缺失：落到 no-op */
  }
  // #endif
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const onOnline = () => cb(true);
    const onOffline = () => cb(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }
  // #endif
  return () => {};
}

/**
 * 查询当前在线状态（初始判定）。能力缺失/查询失败 → 默认在线
 * （离线由后续同步失败 + 队列兜底，不阻塞首屏）。
 */
export function getNetworkState(cb: (online: boolean) => void): void {
  // #ifdef MP-WEIXIN
  try {
    if (typeof wx.getNetworkType === 'function') {
      wx.getNetworkType({
        success: (res) => cb(!!res.isConnected),
        fail: () => cb(true),
      });
      return;
    }
  } catch {
    /* 落到默认 */
  }
  // #endif
  // #ifdef H5
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    cb(navigator.onLine);
    return;
  }
  // #endif
  cb(true);
}