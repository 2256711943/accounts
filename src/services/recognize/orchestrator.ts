/**
 * 识别编排（D8）—— business service。
 *
 * 目标：一份统一入口，对「拍照链路」做 **L1 → L0 分级识别 + 降级**。
 *
 * - **L1**：调云函数 `recognize.image`（多模态模型 + JSON Schema，8s 超时）。本轮 L1 云端未部署
 *   （`ledger` 云函数对 `recognize.image` 返回 `UNKNOWN_ACTION`，或已部署后模型不可用作 degraded），
 *   因此实际会落到 L0 —— 与 DEV_PLAN「模型 API Key 不可用 → 整体降级 L0，闭环不受影响」一致。
 * - **L0**：`rule.ts` 的纯规则。对一段文本（手输辅助 / 模型漏填的分类兜底）做金额 + 分类识别。
 *   拍照链路无 OCR 信息时 L0 给出低置信兜底，金额交由用户在 ConfirmCard 手填。
 *
 * 编排原则（红线）：本层不发请求之外不做业务判断，把「能力分级」与「降级语义」封装成
 * 一个 `RecognizeCandidate`，页面只需消费它。
 */
import { call } from '@/api/client';
import { recognizeByRules } from './rule';
import { DEFAULT_CATEGORY_KEY } from './categories';
import type { RecognizeImageData } from '@/types/api';

export interface RecognizeCandidate {
  /** 金额（分）；未识别 → undefined，ConfirmCard 交由用户填 */
  amount?: number;
  merchant?: string;
  categoryKey?: string;
  /** 账单发生时间戳（ms）（模型的推断时间；未给则页面用当前时间） */
  happenedAt?: number;
  /** 0–1 */
  confidence: number;
  engine: 'model' | 'rule0';
  /** true = 走了降级路径，ConfirmCard 需展示琥珀条「请核对」 */
  degraded: boolean;
  costMs: number;
}

/**
 * 拍照链路识别。`guessText` 为可选的 OCR/手输文本，用于在 L1 不可用 / 漏分类时给 L0 兜底。
 * 永不抛异常：L1 全部失败路径（网络 / UNKNOWN_ACTION / 模型 degraded）都收敛到 L0 或带回结果。
 */
export async function recognizePhoto(opts: {
  fileId?: string;
  base64?: string;
  guessText?: string;
}): Promise<RecognizeCandidate> {
  const start = Date.now();

  // ---- L1：云端模型 ----
  try {
    const data: RecognizeImageData = await call('recognize.image', {
      fileId: opts.fileId,
      base64: opts.base64,
    });
    const costMs = Date.now() - start;
    // 模型降级（L1 内部 degraded）或漏分类时用 L0 补 categoryKey，提升确认卡可用性
    let categoryKey = data.categoryKey;
    let confidence = data.confidence;
    const l0 = recognizeByRules(opts.guessText ?? '');
    if (!categoryKey || categoryKey === DEFAULT_CATEGORY_KEY) categoryKey = l0.categoryKey;
    if (data.categoryKey && !opts.guessText) confidence = data.confidence;
    else if (!data.categoryKey) confidence = Math.max(data.confidence, l0.confidence);

    return {
      amount: data.amount,
      merchant: data.merchant,
      categoryKey,
      happenedAt: data.happenedAt,
      confidence,
      engine: 'model',
      degraded: data.degraded || false,
      costMs,
    };
  } catch {
    // ---- L0：规则降级（模型未部署 / UNKNOWN_ACTION / 网络失败 / 超时） ----
    const l0 = recognizeByRules(opts.guessText ?? '');
    return {
      amount: l0.amount,
      categoryKey: l0.categoryKey,
      confidence: l0.confidence,
      engine: 'rule0',
      degraded: true,
      costMs: Date.now() - start,
    };
  }
}

/** 文本识别辅助（手输 / 备注补分类）：直接走 L0，供 ConfirmCard 的「手输模式」调用。 */
export function recognizeText(text: string): RecognizeCandidate {
  const l0 = recognizeByRules(text);
  return {
    amount: l0.amount,
    categoryKey: l0.categoryKey,
    confidence: l0.confidence,
    engine: 'rule0',
    degraded: true,
    costMs: 0,
  };
}