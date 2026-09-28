/**
 * 媒体选择适配层（跨端）：拍照（相机） / 相册选图。
 *
 * ⚠️ 本文件是 `#ifdef` 的合法发生地（AGENTS.md 架构红线 2）。
 * 单文件 + 函数体内 `#ifdef`，禁拆 platform 后缀文件（见 cloud.ts 同款说明 / ARCHITECTURE.md §3.3）。
 * 适配层方法永不抛未捕获异常（架构红线 6）：能力缺失 / 授权被拒一律以结构化结果返回，
 * 由 `services/` 或页面决定业务降级路径。
 */

import { isMpWeixin } from './system';

/** `pickImage` 的返回。适配层契约：不抛异常，失败带降级标记。 */
export interface MediaPickResult {
  ok: boolean;
  /** 选择的临时路径（MP 为临时文件路径；H5 为 blob URL） */
  tempFilePath?: string;
  /** true = 用户主动取消，不算失败 */
  canceled?: boolean;
  /** true = 相机权限被拒 → 页面应展示 `Empty` + 「去开启」并保留下方相册 / 手输入口 */
  hasDenied?: boolean;
  /** 未捕获异常 / SDK 不可用时的说明 */
  errMsg?: string;
}

type MediaSource = 'camera' | 'album';

/**
 * 选择一张图片。
 *
 * - `camera`：拍照（MP 走 `wx.chooseMedia({ sourceType: ['camera'] })`，触发相机授权；H5 走带 `capture` 的文件选择）
 * - `album`：相册选图
 *
 * 返回结构化结果，绝不抛出。权限被拒 → `hasDenied: true`，由页面决定降级。
 */
export function pickImage(source: MediaSource): Promise<MediaPickResult> {
  if (!isMpWeixin()) return pickImageH5();
  // #ifdef MP-WEIXIN
  return pickImageMp(source);
  // #endif
}

// #ifdef MP-WEIXIN
/**
 * 小程序端实现：`wx.chooseMedia`。
 * 仅保留在 MP-WEIXIN 的编译产物中。
 */
function pickImageMp(source: MediaSource): Promise<MediaPickResult> {
  return new Promise((resolve) => {
    if (typeof wx.chooseMedia !== 'function') {
      resolve({ ok: false, errMsg: '当前微信基础库不支持 chooseMedia' });
      return;
    }
    try {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: [source],
        sizeType: ['compressed'],
        success: (res) => {
          const file = res && res.tempFiles && res.tempFiles[0];
          resolve(
            file ? { ok: true, tempFilePath: file.tempFilePath } : { ok: false, canceled: true }
          );
        },
        fail: (err) => {
          const msg = (err && err.errMsg) || '';
          const canceled = /cancel/i.test(msg);
          // 授权被拒 / 无权限的特征串（区别于用户主动取消）
          const hasDenied = !canceled && /authorize|deny|permission|scope|camera/i.test(msg);
          resolve({ ok: false, canceled, hasDenied, errMsg: msg });
        },
      });
    } catch (err) {
      resolve({ ok: false, errMsg: err instanceof Error ? err.message : String(err) });
    }
  });
}
// #endif

/**
 * H5 实现：程序化创建临时 `<input type="file">`，选中后回传 `URL.createObjectURL`。
 *
 * ⚠️ 本函数**故意不包 `#ifdef`**：它要充当 `pickImage` 的默认值（同 cloud.ts 的 `callCloudH5`）。
 * 代价是 MP 产物里多留一份本函数（约数百字节，且 MP 端永不调用）。
 */
function pickImageH5(): Promise<MediaPickResult> {
  return new Promise((resolve) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.addEventListener(
        'change',
        () => {
          input.remove();
          const file = input.files && input.files[0];
          resolve(
            file ? { ok: true, tempFilePath: URL.createObjectURL(file) } : { ok: false, canceled: true }
          );
        },
        { once: true }
      );
      document.body.appendChild(input);
      input.click();
    } catch (err) {
      resolve({ ok: false, errMsg: err instanceof Error ? err.message : String(err) });
    }
  });
}