/**
 * L0 规则识别（亮点：正则抽金额 + 关键词映射分类）。
 *
 * 与 L1（云端多模态模型）相对：L0 不依赖网络 / 模型，纯确定性规则，输入是**一段文本**
 * （如手输的商户说明 / 备注），输出可供 ConfirmCard 预填的最小字段，永不抛异常。
 *
 * 只在「模型不可用 / 超时 / 图片无 OCR 信息」时作为降级路径被 orchestrator 调用，
 * 同样也作为 L1 结果的后置兜底（如模型漏填分类时用关键词补 categoryKey）。
 *
 * 依赖方向：services → types（红线 1）；不出现 UI 代码（红线 4）。纯函数可单测。
 */
import { CATEGORY_KEYWORDS, DEFAULT_CATEGORY_KEY } from './categories';

export interface RuleResult {
  /** 识别出的金额（单位「分」，整数）；无可识别 → undefined */
  amount?: number;
  /** 命中分类 key；未命中 → DEFAULT_CATEGORY_KEY */
  categoryKey: string;
  /** 0–1，由「命中关键词数」粗估，供 ConfirmCard 展示信心 */
  confidence: number;
  /** 关键词命中总数（调试/埋点用） */
  hits: number;
}

/**
 * 从一段文本里抽取金额，返回单位「分」的整数。
 *
 * 支持中文单位（元 / 块 / 块 / RMB）与符号（¥ / ￥），兼容小数（1.5 元 → 150 分）。
 * 规则：
 * - 第一位匹配的数字为金额（多行收据这类文本取首个符合格式的数值）；
 * - 无明确金额单位时，若存在「总价 / 合计 / 付款 / 实收」等合计词，优先取其后数值；
 * - 否则取第一个合理金额（0 < 金额 ≤ 1e8 分）。
 *
 * 纯函数：非法输入/未匹配返回 undefined，不抛异常。
 */
export function extractAmount(text: string): number | undefined {
  if (typeof text !== 'string') return undefined;
  const t = text.trim();
  if (!t) return undefined;

  // 合计词优先：取其后跟着的数字
  const totalMatch = /(?:合计|总计|总价|实收|付款|应付|金额)[:：]?\s*[¥￥]?\s*(\d{1,8}(?:\.\d{1,2})?)/.exec(
    t
  );
  if (totalMatch) {
    const fen = toFen(totalMatch[1]);
    if (fen != null) return fen;
  }

  // 任意处（含单位）的金额
  const amountMatch = /[¥￥]?\s*(\d{1,8}(?:\.\d{1,2})?)\s*(?:元|块|rmb|RMB)?/.exec(t);
  if (amountMatch) {
    const fen = toFen(amountMatch[1]);
    if (fen != null && fen <= 1e8 && fen > 0) return fen;
  }
  return undefined;
}

/** 数字串 → 分（整数）。非法返回 null。 */
function toFen(raw: string): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100);
}

/**
 * 关键词 → 分类（多数决）。遍历所有分类关键词，计数命中；取票数最高者。
 * 未命中任何关键词 → DEFAULT_CATEGORY_KEY。
 */
export function mapCategory(text: string): { categoryKey: string; hits: number; confidence: number } {
  if (typeof text !== 'string' || !text.trim()) {
    return { categoryKey: DEFAULT_CATEGORY_KEY, hits: 0, confidence: 0 };
  }
  const lower = text.toLowerCase();
  let best = DEFAULT_CATEGORY_KEY;
  let bestHits = 0;
  for (const [key, words] of Object.entries(CATEGORY_KEYWORDS)) {
    let hits = 0;
    for (const w of words) {
      // 简单子串匹配：大小写不敏感（关键词本身多为中文，英文词如 rmb 走 lower）
      if (lower.includes(w.toLowerCase())) hits += 1;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = key;
    }
  }
  // 命中数 → 0–1：0 个(无置信) / 1 个(0.6) / 2 个(0.8) / 3+ 个(0.95)
  const confidence = bestHits === 0 ? 0 : bestHits === 1 ? 0.6 : bestHits === 2 ? 0.8 : 0.95;
  return { categoryKey: best, hits: bestHits, confidence };
}

/**
 * 对一段文本跑完整 L0：抽金额 + 映射分类。
 * ConfirmCard / 手输辅助直接消费；编排（orchestrator.ts）在 L1 不可用时调用它作为降级。
 */
export function recognizeByRules(text: string): RuleResult {
  const amount = extractAmount(text);
  const { categoryKey, hits, confidence } = mapCategory(text);
  return { amount, categoryKey, hits, confidence };
}