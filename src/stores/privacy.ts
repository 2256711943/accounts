/**
 * 隐私授权 store —— D6 拍照页《隐私保护指引》弹窗的唯一状态源。
 *
 * 归口职责：注册 `onNeedPrivacyAuthorization` 回调，把「隐私接口被拦截」翻译成
 * 页面可订阅的 `shown` 布尔 + 一次性的 resolve 推进函数。H5 端注册恒失败，状态保持关闭。
 *
 * 依赖方向：store → adapters（不依赖 UI / 其它 store）。
 */

import { ref } from 'vue';
import { defineStore } from 'pinia';
import { bindNeedPrivacy, type NeedPrivacyResolve } from '@/adapters/privacy';

export const usePrivacyStore = defineStore('privacy', () => {
  /** 隐私指引弹窗是否显示（隐私接口被微信拦截时置 true） */
  const shown = ref(false);
  /** 当前被拦截接口的 resolve：不同意后必须调用，否则接口悬停 */
  let resolveFn: NeedPrivacyResolve | null = null;
  /** 已注册过 onNeedPrivacyAuthorization，避免 App 与多个页面重复注册导致监听器叠加 */
  let registered = false;

  /** 在 App 启动时调用一次：注册隐私回调。H5 端注册失败，shown 恒为 false。 */
  function init(): void {
    if (registered) return;
    registered = bindNeedPrivacy((resolve) => {
      resolveFn = resolve;
      shown.value = true;
    });
  }

  /** 用户「同意」：继续执行被拦截的隐私接口，并关闭弹窗。 */
  function agree(): void {
    const fn = resolveFn;
    resolveFn = null;
    shown.value = false;
    if (fn) fn({ event: 'agree', buttonId: 'sg-privacy-agree' });
  }

  /** 用户「不同意」：取消被拦截的隐私接口（页面保留下方相册 / 手输降级路径）。 */
  function refuse(): void {
    const fn = resolveFn;
    resolveFn = null;
    shown.value = false;
    if (fn) fn({ event: 'disagree' });
  }

  return { shown, init, agree, refuse };
});