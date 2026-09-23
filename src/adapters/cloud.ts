/**
 * 云开发初始化（跨端能力适配层）。
 *
 * ⚠️ 本文件是 `#ifdef` 的合法发生地（AGENTS.md 架构红线 2）。
 *
 * 为什么是「单文件 + 函数体内条件编译」而不是 `cloud.mp.ts` / `cloud.h5.ts`：
 * `uni-app` 3.0 的 `resolve.extensions` 只含 .uts/.mjs/.js/.ts/.jsx/.tsx/.json/.vue，
 * **不含任何平台后缀**，`@dcloudio/**` 内也没有平台后缀文件的解析插件
 * （只有 `platforms/<platform>/` 目录约定，那是给「页面」用的）。
 * 硬拆两个文件再由 index.ts 选择的话，两条同名 export 会让 vue-tsc 报 TS2308。
 * 详见 docs/ARCHITECTURE.md §3.3。
 */

/** `initCloud` 的返回值。适配层契约：永不抛未捕获异常（架构红线 6）。 */
export interface CloudInitResult {
  /** 是否初始化成功（`skipped === true` 表示「按预期跳过」，不算失败） */
  ok: boolean;
  /** true = 当前端没有云开发 SDK，调用方应走降级路径（H5 走云函数 HTTP 访问服务） */
  skipped: boolean;
  /** 失败原因；仅在 `ok === false` 时有值 */
  errMsg?: string;
}

/**
 * 初始化云开发。
 *
 * - 小程序端：`wx.cloud.init`，之后可用 `wx.cloud.callFunction`
 * - H5 端：无云开发 SDK，返回 `skipped`；数据通道由 `api/client.ts` 走云函数 HTTP 访问服务
 *
 * 必须在任何 `callFunction` 之前调用；失败不阻塞启动（只返回结果，不抛）。
 */
export function initCloud(envId?: string): CloudInitResult {
  // 默认返回值 = 当前端没有云开发 SDK（H5 走这条，MP 端下面被覆盖）
  let result: CloudInitResult = { ok: true, skipped: true };

  // #ifdef MP-WEIXIN
  result = initMpCloud(envId);
  // #endif

  return result;
}

// #ifdef MP-WEIXIN
/**
 * 小程序端实现。仅保留在 MP-WEIXIN 的编译产物中。
 */
function initMpCloud(envId?: string): CloudInitResult {
  const cloud = wx.cloud;
  if (!cloud) {
    return {
      ok: false,
      skipped: true,
      errMsg:
        'wx.cloud 不可用：请确认小程序已开通云开发，且 project.config.json 的 appid 为正式 AppID',
    };
  }

  try {
    cloud.init({ env: envId, traceUser: true });
    return { ok: true, skipped: false };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      errMsg: err instanceof Error ? err.message : String(err),
    };
  }
}
// #endif
