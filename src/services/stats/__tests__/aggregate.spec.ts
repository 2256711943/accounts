/**
 * 月度统计聚合单测（D9）：验证 total/avg/byCategory/ring 及占比之和 = 1。
 */

import { describe, expect, it, vi } from 'vitest';
import { computeMonthly } from '../aggregate';
import type { LedgerRecord } from '@/types/model';

// aggregate 顶层 import `@/utils/format`（vitest 对未 mock 的真模块 alias 解析不生效），
// 用 vi.mock 短路并注入等价实现，仅保留测试所需 daysInMonth（同 compress/upload.spec 策略）。
vi.mock('@/utils/format', () => ({
  daysInMonth: (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  },
}));

function rec(partial: Partial<LedgerRecord> & Pick<LedgerRecord, 'categoryId' | 'amount'>): LedgerRecord {
  return { type: 'expense', clientId: '', happenedAt: 0, ...partial } as LedgerRecord;
}

describe('computeMonthly', () => {
  it('空列表：total/avg 为 0，ring 与 byCategory 为空', () => {
    const s = computeMonthly([], '2026-10');
    expect(s.total).toBe(0);
    expect(s.avg).toBe(0);
    expect(s.ring).toEqual([]);
    expect(s.byCategory).toEqual([]);
  });

  it('合计所有支出金额', () => {
    const s = computeMonthly(
      [
        rec({ categoryId: 'food', amount: 4500 }),
        rec({ categoryId: 'transport', amount: 800 }),
        rec({ categoryId: 'food', amount: 200 }),
      ],
      '2026-10'
    );
    expect(s.total).toBe(5500);
  });

  it('byCategory 按金额降序聚合（分类去重、金额累加）', () => {
    const s = computeMonthly(
      [
        rec({ categoryId: 'transport', amount: 800 }),
        rec({ categoryId: 'food', amount: 4500 }),
        rec({ categoryId: 'food', amount: 200 }),
      ],
      '2026-10'
    );
    expect(s.byCategory[0]).toMatchObject({ categoryId: 'food', amount: 4700 });
    expect(s.byCategory[1]).toMatchObject({ categoryId: 'transport', amount: 800 });
  });

  it('ring 占比之和为 1（环图 100% 验收）', () => {
    const s = computeMonthly(
      [
        rec({ categoryId: 'a', amount: 100 }),
        rec({ categoryId: 'b', amount: 300 }),
        rec({ categoryId: 'c', amount: 600 }),
      ],
      '2026-10'
    );
    expect(s.ring.reduce((sum, r) => sum + r.ratio, 0)).toBeCloseTo(1, 10);
    expect(s.ring[0].ratio).toBeCloseTo(0.6, 10);
  });

  it('avg = 总支出 / 当月天数（10 月按 31 天）', () => {
    const s = computeMonthly([rec({ categoryId: 'a', amount: 3100 })], '2026-10');
    expect(s.avg).toBe(Math.round(3100 / 31));
  });

  it('收入（income）不计入统计', () => {
    const s = computeMonthly(
      [
        rec({ type: 'income', categoryId: 'income', amount: 99999 }),
        rec({ categoryId: 'food', amount: 500 }),
      ],
      '2026-10'
    );
    expect(s.total).toBe(500);
    expect(s.byCategory.some((c) => c.categoryId === 'income')).toBe(false);
  });
});