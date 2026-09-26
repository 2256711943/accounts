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

/* ------------------------------------------------------------------ *
 * 云函数调用（数据通道的平台差异收敛点）
 * ------------------------------------------------------------------ */

/** 云函数名。`api/client.ts` 不需要知道它 —— 传输层细节止步于此。 */
const CLOUD_FUNCTION_NAME = 'ledger';

/**
 * `callCloud` 的返回。
 *
 * 注意这里**只表达通道级结果**，不判定业务成败 —— 业务结果在云函数返回的信封
 * （`{ ok, data, error }`）里，由 `api/client.ts` 解读。这样适配层不需要理解业务。
 */
export interface CloudCallResult<T> {
  ok: boolean;
  /** 云函数返回的原始信封；通道失败时为 undefined */
  result?: T;
  /** 通道级失败原因（SDK 不可用 / 网络断 / 非 2xx），不含业务错误 */
  errMsg?: string;
}

/** 平台实现签名。放在类型位置，避免两个实现互相依赖。 */
type CloudCallFn = <T>(action: string, payload: unknown) => Promise<CloudCallResult<T>>;

/**
 * 调用云函数 `ledger`（ARCHITECTURE.md §3.4 的统一数据通道底座）。
 *
 * - MP：`wx.cloud.callFunction({ name, data: { action, payload } })`
 * - H5：`POST ${VITE_CLOUD_HTTP_BASE}/${action}`，body 为 payload 的 JSON
 *
 * 契约：**永不抛未捕获异常**（架构红线 6），失败一律以 `{ ok: false, errMsg }` 返回。
 * MP 端调用前必须先 `initCloud()`。
 */
export async function callCloud<T>(action: string, payload: unknown): Promise<CloudCallResult<T>> {
  // 默认取 H5 实现（H5 无云开发 SDK）；MP 端在下面被覆盖
  let caller: CloudCallFn = callCloudH5;

  // #ifdef MP-WEIXIN
  caller = callCloudMp;
  // #endif

  return caller<T>(action, payload);
}

/**
 * H5 实现：走云函数 HTTP 访问服务。
 *
 * 用 `uni.request` 而不是 §3.4 示例里的 `fetch` —— 前者在两端都存在且由
 * `@dcloudio/types` 提供类型，后者依赖 DOM lib。行为一致（均为 POST + JSON body）。
 *
 * ⚠️ 本函数**故意不包 `#ifdef`**：它要充当 `callCloud` 的默认值，而条件编译发生在构建期，
 * 若包起来，MP 构建时默认值会指向一个已被删除的函数。代价是 MP 产物里多留一份本函数
 * （约数百字节，且 MP 端永不调用）。用体积换「不会静默引用到不存在的函数」。
 */
async function callCloudH5<T>(action: string, payload: unknown): Promise<CloudCallResult<T>> {
  const base = import.meta.env.VITE_CLOUD_HTTP_BASE;
  if (!base) {
    return {
      ok: false,
      errMsg: '缺少 VITE_CLOUD_HTTP_BASE：H5 端无法定位云函数 HTTP 访问服务（见 .env.example）',
    };
  }

  try {
    const res = await uni.request({
      url: `${base}/${action}`,
      method: 'POST',
      // 实测（2026-09-26）：网关把 action 编进 event.path（已剥掉 /ledger 前缀），payload 走 body
      header: { 'content-type': 'application/json' },
      data: payload as Record<string, unknown>,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return { ok: false, errMsg: `HTTP ${res.statusCode}` };
    }
    return { ok: true, result: res.data as T };
  } catch (err) {
    return { ok: false, errMsg: err instanceof Error ? err.message : String(err) };
  }
}

// #ifdef MP-WEIXIN
/** 小程序端实现：`wx.cloud.callFunction`。仅保留在 MP-WEIXIN 的编译产物中。 */
async function callCloudMp<T>(action: string, payload: unknown): Promise<CloudCallResult<T>> {
  const cloud = wx.cloud;
  if (!cloud) {
    return {
      ok: false,
      errMsg: 'wx.cloud 不可用：请确认小程序已开通云开发，且 project.config.json 的 appid 为正式 AppID',
    };
  }

  try {
    const res = await cloud.callFunction<T, { action: string; payload: unknown }>({
      name: CLOUD_FUNCTION_NAME,
      data: { action, payload },
    });
    return { ok: true, result: res.result };
  } catch (err) {
    return { ok: false, errMsg: err instanceof Error ? err.message : String(err) };
  }
}
// #endif
