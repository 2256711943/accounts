/**
 * 统一数据通道（ARCHITECTURE.md §3.4）。
 *
 * 职责边界（§3.2 分层表）：只做**请求构造**与**错误归一**，不含业务判断；
 * 也**不做平台分支** —— 红线 2 规定 `#ifdef` 只允许出现在 `adapters/` 内，
 * 两端差异已由 `adapters/cloud.ts` 的 `callCloud()` 收敛。
 */

import { callCloud } from '@/adapters/cloud';
import type { ApiAction, ApiError, ApiMap, ApiResponse } from '@/types/api';

/** 通道级失败的补充错误码（不属于云函数返回的业务错误码） */
export type ApiCallFailureCode = ApiError['code'] | 'NETWORK';

/**
 * 调用失败时抛出的统一错误。
 * 业务错误（信封 `ok: false`）与通道错误（网络断、非 2xx）都归一到这一个类型，
 * 上层只需 catch 一种。
 */
export class ApiCallError extends Error {
  readonly code: ApiCallFailureCode;
  /** 原始错误详情，便于上层读取补充上下文（如 conflict 时的服务端文档） */
  readonly detail?: unknown;

  constructor(code: ApiCallFailureCode, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiCallError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * 调用云函数 `ledger`：`action + payload` → `data`。
 *
 * 成功直接返回 `data`；失败抛 `ApiCallError`。选择抛而不是返回联合类型，
 * 是因为调用方（`services/`）绝大多数只关心成功路径，让失败显式冒泡可以
 * 避免每处调用都写一遍 `if (!res.ok)` 分支。
 */
export async function call<A extends ApiAction>(
  action: A,
  payload: ApiMap[A]['payload']
): Promise<ApiMap[A]['data']> {
  const res = await callCloud<ApiResponse<ApiMap[A]['data']>>(action, payload);

  // 通道级失败：SDK 不可用 / 网络断 / 非 2xx
  if (!res.ok) {
    throw new ApiCallError('NETWORK', res.errMsg ?? `调用 ${action} 失败`);
  }

  const envelope = res.result;
  if (!envelope) {
    throw new ApiCallError('NETWORK', `云函数 ${action} 返回空结果`);
  }
  if (!envelope.ok) {
    throw new ApiCallError(
      envelope.error.code,
      envelope.error.message ?? envelope.error.code,
      envelope.error
    );
  }

  return envelope.data;
}
