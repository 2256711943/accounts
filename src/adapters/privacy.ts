/**
 * 隐私 / 授权适配层（跨端）：相机授权状态、隐私保护指引流程。
 *
 * ⚠️ 本文件是 `#ifdef` 的合法发生地（AGENTS.md 架构红线 2）。
 * 适配层方法永不抛未捕获异常（架构红线 6）：能力缺失 / 端不支持一律返回降级结果。
 *
 * 隐私指引合规（D6）：微信小程序后台配置《用户隐私保护指引》后，凡调用
 * 隐私接口（相机 / 相册）前会触发 `onNeedPrivacyAuthorization`，前端借此弹出自有
 * 隐私弹窗；用户同意后用 `requirePrivacyAuthorize` 推进被拦截的接口。H5 无此机制，恒 no-op。
 */

import { isMpWeixin } from './system';

export type CameraAuthStatus = 'granted' | 'denied' | 'not-determined' | 'unsupported';

/** `onNeedPrivacyAuthorization` 的 resolve：agree / disagree 后推进被拦截的隐私接口。 */
export type NeedPrivacyResolve = (opts?: { event?: 'agree' | 'disagree'; buttonId?: string }) => void;

/**
 * 注册隐私授权回调：隐私接口（相机等）被调用前触发，用于展示自有《隐私保护指引》。
 * H5 无该机制，恒返回 false（不注册）。
 */
export function bindNeedPrivacy(cb: (resolve: NeedPrivacyResolve) => void): boolean {
  if (!isMpWeixin()) return false;
  let bound = false;
  // #ifdef MP-WEIXIN
  if (typeof wx.onNeedPrivacyAuthorization === 'function') {
    wx.onNeedPrivacyAuthorization((resolve) => {
      cb(resolve as NeedPrivacyResolve);
    });
    bound = true;
  }
  // #endif
  return bound;
}

/** 请求用户同意隐私协议（新版基础库的显式授权入口）。H5 no-op。 */
export function requestPrivacyAuthorize(): boolean {
  if (!isMpWeixin()) return false;
  let called = false;
  // #ifdef MP-WEIXIN
  if (typeof wx.requirePrivacyAuthorize === 'function') {
    wx.requirePrivacyAuthorize({ success: () => {}, fail: () => {} });
    called = true;
  }
  // #endif
  return called;
}

/** 打开官方《用户隐私保护指引》协议页。H5 no-op。 */
export function openPrivacyContract(): void {
  if (!isMpWeixin()) return;
  // #ifdef MP-WEIXIN
  if (typeof wx.openPrivacyContract === 'function') {
    try {
      wx.openPrivacyContract({});
    } catch {
      /* 打开失败无碍，忽略 */
    }
  }
  // #endif
}

/**
 * 查询相机授权状态（`scope.camera`）。
 * H5 无应用级授权（走浏览器文件选择），恒返回 'granted'。
 */
export function getCameraAuthStatus(): Promise<CameraAuthStatus> {
  if (!isMpWeixin()) return Promise.resolve('granted');
  // #ifdef MP-WEIXIN
  if (typeof wx.getSetting !== 'function') return Promise.resolve('unsupported');
  return new Promise((resolve) => {
    try {
      wx.getSetting({
        success: (res) => {
          const value = res.authSetting && res.authSetting['scope.camera'];
          resolve(value === true ? 'granted' : value === false ? 'denied' : 'not-determined');
        },
        fail: () => resolve('not-determined'),
      });
    } catch {
      resolve('not-determined');
    }
  });
  // #endif
}

/**
 * 打开系统设置页，引导用户重新授权被拒的 scope。返回是否成功发出。
 * H5 no-op → false。
 */
export function openSetting(): Promise<boolean> {
  if (!isMpWeixin()) return Promise.resolve(false);
  // #ifdef MP-WEIXIN
  if (typeof wx.openSetting !== 'function') return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      wx.openSetting({ success: () => resolve(true), fail: () => resolve(false) });
    } catch {
      resolve(false);
    }
  });
  // #endif
}