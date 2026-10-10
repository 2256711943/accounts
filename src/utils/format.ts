/**
 * 前端通用格式化 / 日期工具（纯函数，无平台依赖）。
 * 金额统一以「分」为单位整数存储（见 model.ts），展示时才转元。
 */

/** 分 → 元字符串（两位小数，千分位）。`fen` 非法或缺省返回 `'0.00'`。 */
export function fenToYuan(fen: number | undefined | null): string {
  const value = typeof fen === 'number' && Number.isFinite(fen) ? fen : 0;
  const negative = value < 0;
  const abs = Math.abs(value) / 100;
  const [int, dec] = abs.toFixed(2).split('.');
  const thousands = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${thousands}.${dec}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 今天 0 点 / 昨天 0 点的时间戳（ms），用于日期分组。 */
function dayBoundary(now = Date.now()): { todayStart: number; yesterdayStart: number } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const todayStart = d.getTime();
  return { todayStart, yesterdayStart: todayStart - DAY_MS };
}

export type DayGroup<T> = { label: string; items: T[] };

/**
 * 按 `happenedAt`（ms）把列表分组为「今天 / 昨天 / M月D日」。
 * 未提供 happenedAt 的项归入「更早」。
 */
export function groupByDay<T extends { happenedAt?: number }>(items: T[], now = Date.now()): DayGroup<T>[] {
  const { todayStart, yesterdayStart } = dayBoundary(now);
  const groups = new Map<string, DayGroup<T> & { sort: number }>();

  for (const item of items) {
    const has = typeof item.happenedAt === 'number' && Number.isFinite(item.happenedAt);
    const ticks = has ? (item.happenedAt as number) : -1;
    let label: string;
    let sort: number;
    if (has && ticks >= todayStart) {
      label = '今天';
      sort = 0;
    } else if (has && ticks >= yesterdayStart) {
      label = '昨天';
      sort = 1;
    } else {
      const base = ticks > 0 ? ticks : now;
      const d = new Date(base);
      label = `${d.getMonth() + 1}月${d.getDate()}日`;
      // 「更早」各组按当日时间戳从近到远排序，取一个随 ticks 单调的值
      sort = 1000000000000 - base;
    }
    let group = groups.get(label);
    if (!group) {
      group = { label, sort, items: [] };
      groups.set(label, group);
    }
    group.items.push(item);
  }

  return [...groups.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ label, items }) => ({ label, items }));
}

/** 返回「当前月往前/往后 offset 个月的 1 号 0 点」时间戳（ms），用于 `record.list` 的 since。 */
export function monthStartTicks(offset = 0, now = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + offset, 1, 0, 0, 0, 0).getTime();
}

/** 返回某时间戳所属的 `YYYY-MM`（`stats.monthly` 的入参键）。不足位补 0。 */
export function monthKey(ticks = Date.now()): string {
  const d = new Date(ticks);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 某月有多少天（用于统计页「日均」分母）。给到 `YYYY-MM`。 */
export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return 30;
  return new Date(y, m, 0, 0, 0, 0, 0).getDate();
}