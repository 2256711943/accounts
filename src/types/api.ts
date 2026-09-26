/**
 * 云函数接口入出参类型 —— 必须与 ARCHITECTURE.md §6 的 action 表保持一致。
 * 新增/改动云函数 action 时同步本文件（AGENTS.md「修改后必须执行」）。
 */

import type { LedgerRecord, SyncOp, SyncTask } from './model';

/** §6 的 action 全集 */
export type ApiAction =
  | 'record.list'
  | 'record.upsert'
  | 'record.remove'
  | 'record.batchSync'
  | 'stats.monthly'
  | 'recognize.image'
  | 'perf.report'
  | 'user.login'
  | 'subscribe.register';

/** 错误码。云函数当前只产出前两个，D4 补业务 action 时按需扩充 */
export type ApiErrorCode = 'INVALID_PARAM' | 'UNKNOWN_ACTION';

/** 失败信封（§6：`{ ok:false, error:{ code } }`） */
export interface ApiError {
  code: ApiErrorCode;
  message?: string;
  /** 补充上下文，字段随 code 而定（如 `UNKNOWN_ACTION` 带回 `action`） */
  readonly [extra: string]: unknown;
}

/** 统一响应信封（§6：`{ ok, data, error }`） */
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

// ---------- record.list ----------
/** 游标分页，按 `happenedAt` 倒序 */
export interface RecordListPayload {
  /** 只取此时间戳（ms）之后的账单，用于增量拉取 */
  since?: number;
  limit: number;
  cursor?: string;
  categoryId?: string;
}
export interface RecordListData {
  list: LedgerRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------- record.upsert ----------
/** 幂等入口，create / update 共用 */
export interface RecordUpsertPayload {
  clientId: string;
  op: SyncOp;
  payload: Partial<LedgerRecord>;
  baseVersion?: number;
}
export interface RecordUpsertData {
  record: LedgerRecord;
  /** 版本落后：服务端拒绝覆盖，返回当前文档由客户端做 LWW */
  conflict?: boolean;
  /** 幂等命中：该 `clientId` 已存在，本次未新建（视为成功） */
  duplicated?: boolean;
}

// ---------- record.remove ----------
export interface RecordRemovePayload {
  clientId: string;
}
export interface RecordRemoveData {
  ok: boolean;
}

// ---------- record.batchSync ----------
/** 恢复网络后批量补传，减少往返 */
export interface RecordBatchSyncPayload {
  tasks: SyncTask[];
}
export interface RecordBatchSyncData {
  results: Array<{ taskId: string; ok: boolean; conflict?: boolean }>;
}

// ---------- stats.monthly ----------
export interface StatsMonthlyPayload {
  /** `'YYYY-MM'` */
  month: string;
}
/**
 * ⚠️ 以下两个元素结构 §6 只给了 `ring: [...]` / `byCategory: [...]`，未定义元素字段。
 * 这里按「分类 + 金额 + 占比 / 笔数」的最小可用形态定义，
 * D4 实现 `stats.monthly` 时若调整，**必须同步回本文件**。
 */
export interface StatsRingSlice {
  categoryId: string;
  /** 单位「分」 */
  amount: number;
  /** 0–1，全部 slice 之和为 1（SPEC.md US-03 验收要求） */
  ratio: number;
}
export interface StatsCategoryStat {
  categoryId: string;
  /** 单位「分」 */
  amount: number;
  count: number;
}
export interface StatsMonthlyData {
  /** 单位「分」 */
  total: number;
  /** 单位「分」 */
  avg: number;
  ring: StatsRingSlice[];
  byCategory: StatsCategoryStat[];
}

// ---------- recognize.image ----------
/** 超时 8s，失败降级 */
export interface RecognizeImagePayload {
  /** 云存储 fileID；与 `base64` 二选一 */
  fileId?: string;
  base64?: string;
}
export interface RecognizeImageData {
  /** 单位「分」 */
  amount?: number;
  merchant?: string;
  categoryKey?: string;
  /** 账单发生时间戳（ms） */
  happenedAt?: number;
  confidence: number;
  /** 走了降级路径，UI 需提示「请核对」 */
  degraded: boolean;
}

// ---------- perf.report ----------
/** 指标名取自 SPEC.md §5.4 的 `perf_logs.metric` 枚举 */
export type PerfMetricName = 'launch_t1' | 't1' | 't2' | 'setdata' | 'api' | 'error';
export interface PerfMetric {
  metric: PerfMetricName;
  value: number;
  page?: string;
  payload?: unknown;
  ts: number;
}
export interface PerfReportPayload {
  sessionId: string;
  metrics: PerfMetric[];
}
export interface PerfReportData {
  ok: boolean;
}

// ---------- user.login ----------
export interface UserLoginPayload {
  /** H5 端由客户端生成并传入；MP 端忽略（OPENID 由云开发注入），见 §1.2 决策 4 */
  deviceId?: string;
}
export interface UserLoginData {
  uid: string;
  token: string;
}

// ---------- subscribe.register ----------
export interface SubscribeRegisterPayload {
  templateId: string;
}
export interface SubscribeRegisterData {
  ok: boolean;
}

/** action → { payload, data } 映射，供 `client.call()` 做端到端类型推导 */
export interface ApiMap {
  'record.list': { payload: RecordListPayload; data: RecordListData };
  'record.upsert': { payload: RecordUpsertPayload; data: RecordUpsertData };
  'record.remove': { payload: RecordRemovePayload; data: RecordRemoveData };
  'record.batchSync': { payload: RecordBatchSyncPayload; data: RecordBatchSyncData };
  'stats.monthly': { payload: StatsMonthlyPayload; data: StatsMonthlyData };
  'recognize.image': { payload: RecognizeImagePayload; data: RecognizeImageData };
  'perf.report': { payload: PerfReportPayload; data: PerfReportData };
  'user.login': { payload: UserLoginPayload; data: UserLoginData };
  'subscribe.register': { payload: SubscribeRegisterPayload; data: SubscribeRegisterData };
}
