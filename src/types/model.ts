/**
 * 领域模型 —— 与云数据库集合一一对应（见 SPEC.md §5）。
 *
 * ⚠️ 命名说明：账单模型叫 `LedgerRecord` 而**不是** `Record`。
 * `Record` 是 TypeScript 内置工具类型（`Record<K, V>`），同名会遮蔽内置类型，
 * 使 `Partial<Record>`、`Record<string, T>` 这类写法静默指向错误的类型。
 * ARCHITECTURE.md §4.2 里的 `Partial<Record>` 指的是本文件的账单模型。
 */

/** 账单方向 */
export type RecordType = 'expense' | 'income';

/** 录入来源，用于埋点分析 */
export type RecordSource = 'photo' | 'voice' | 'manual';

/** 识别元信息（服务端写入，客户端只读） */
export interface RecognizeMeta {
  /** 识别引擎标识（如 'model-v1' / 'rule-l0'） */
  engine: string;
  /** 0–1 */
  confidence: number;
  /** 本次识别耗时（ms） */
  costMs: number;
  /** 是否走了降级路径 */
  degraded: boolean;
}

/** 账单。`amount` 单位「分」，整数，避免浮点误差（SPEC.md §5.1） */
export interface LedgerRecord {
  /** 云端生成；本地乐观写入时暂无 */
  _id?: string;
  /** 客户端生成的 uuid（v4），**唯一索引 + 幂等键** */
  clientId: string;
  /** 归属身份：MP 为真实 OPENID，H5 为固定 demo 常量（ARCHITECTURE.md §1.2 决策 4） */
  _openid?: string;
  type: RecordType;
  /** 单位「分」，整数，约束 `0 < amount ≤ 100000000` */
  amount: number;
  categoryId: string;
  merchant?: string;
  /** ≤100 字 */
  remark?: string;
  /** 账单发生时间戳（ms） */
  happenedAt: number;
  source: RecordSource;
  recognizeMeta?: RecognizeMeta;
  /** 云存储 fileID；手动记账无图 */
  imageFileId?: string;
  /** 软删除标记：delete 不物理删除，保证其他设备增量拉取能看到「删除」这个事实 */
  deleted?: boolean;
  createdAt?: number;
  updatedAt?: number;
  /** 乐观并发控制，每次修改 +1 */
  version?: number;
}

/** 待同步操作类型 */
export type SyncOp = 'create' | 'update' | 'delete';

/** 离线同步队列项（ARCHITECTURE.md §4.2）—— 本地结构与 `record.batchSync` 的上行结构是同一个 */
export interface SyncTask {
  /** uuid，用于回填 `record.batchSync` 的 results */
  taskId: string;
  /** 目标账单的幂等键 */
  clientId: string;
  op: SyncOp;
  /** 只提交变更字段（字段级 LWW，降低冲突面） */
  payload: Partial<LedgerRecord>;
  /** 乐观并发基线 */
  baseVersion: number;
  /** 已重试次数；本地字段，恢复网络补传时一并上行 */
  tries?: number;
  lastError?: string;
  createdAt?: number;
}

/** 分类（SPEC.md §5.2）。内置分类随 app 版本内置在前端常量里，避免首屏依赖网络 */
export interface Category {
  /** 内置分类用固定 key（food / transport / shopping / …） */
  key: string;
  name: string;
  icon: string;
  color: string;
  sort: number;
}
