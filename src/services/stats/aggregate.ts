/**
 * 月度统计聚合（纯函数）—— 统计页数据源。
 *
 * 边界说明（D9 决策）：云函数 `stats.monthly` 尚未实现，为守住「不部署、前端 L0 闭环优先」
 * 的滚动边界，统计页先走**客户端聚合**：用 `record.list` 拉取当月账单，本地算出与
 * `StatsMonthlyData` 结构一致的返回。将来接入云函数时，仅替换数据来源，页面零改动。
 *
 * 口径与 SPEC.md US-03 一致：`total/avg/ring/byCategory` 均**只统计支出**（expense）；
 * `ring` 各 slice 的 `ratio` 之和为 1（环图占比 100% 验收）。
 */

import { daysInMonth } from '@/utils/format';
import type { StatsCategoryStat, StatsMonthlyData, StatsRingSlice } from '@/types/api';
import type { LedgerRecord } from '@/types/model';

/** 输入：某个月的账单快照（前端从 `record.list` 拿到）。只消费 expense，income 忽略。 */
export function computeMonthly(records: LedgerRecord[], monthKey: string): StatsMonthlyData {
  const expenses = records.filter((r) => !r.deleted && r.type === 'expense');
  const total = expenses.reduce((sum, r) => sum + (r.amount || 0), 0);

  const byCat = new Map<string, number>();
  for (const r of expenses) {
    byCat.set(r.categoryId, (byCat.get(r.categoryId) || 0) + (r.amount || 0));
  }

  const byCategory: StatsCategoryStat[] = [...byCat.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount, count: 0 }))
    .sort((a, b) => b.amount - a.amount);

  // ring：占比 = 分类金额 / 总支出。total 为 0 时无收入环 → 空数组。
  const denom = total || 1;
  const ring: StatsRingSlice[] = byCategory.map((c) => ({
    categoryId: c.categoryId,
    amount: c.amount,
    ratio: c.amount / denom,
  }));

  const avg = total === 0 ? 0 : Math.round(total / daysInMonth(monthKey));
  return { total, avg, ring, byCategory };
}