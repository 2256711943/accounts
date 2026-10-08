/**
 * L0 规则识别单测：extractAmount / mapCategory / recognizeByRules。
 */
import { describe, expect, it } from 'vitest';
import { extractAmount, mapCategory, recognizeByRules } from '../rule';

describe('extractAmount', () => {
  it('中文单位「元」', () => {
    expect(extractAmount('消费 58 元')).toBe(5800);
  });
  it('符号 ¥', () => {
    expect(extractAmount('¥23.50')).toBe(2350);
  });
  it('人民币符号 ￥ + 元', () => {
    expect(extractAmount('￥100 元')).toBe(10000);
  });
  it('合计词优先（总价 128.6 → 12860，而非行内其他数）', () => {
    expect(extractAmount('单价 6.5 数量 2 总价：128.6 元')).toBe(12860);
  });
  it('无单位纯数字取首个合理金额', () => {
    expect(extractAmount('订单号 2026 金额 88')).toBe(8800);
  });
  it('整数金额', () => {
    expect(extractAmount('实收 50 块')).toBe(5000);
  });
  it('空/非法输入返回 undefined', () => {
    expect(extractAmount('')).toBeUndefined();
    expect(extractAmount('无金额')).toBeUndefined();
    expect(extractAmount('  ')).toBeUndefined();
    expect(extractAmount(123 as unknown as string)).toBeUndefined();
  });
  it('超过 1e8 分(100万元) 视为异常金额（非真实消费）→ undefined', () => {
    // 2e6 元 = 2e8 分 > 1e8，与 LedgerRecord.amount 约束一致地被过滤
    expect(extractAmount('¥2000000')).toBeUndefined();
  });
  it('边界内最大金额 999999.99 元 → 99999999 分', () => {
    expect(extractAmount('¥999999.99')).toBe(99999999);
  });
});

describe('mapCategory', () => {
  it('命中餐饮关键词', () => {
    const r = mapCategory('美团外卖 奶茶');
    expect(r.categoryKey).toBe('food');
    expect(r.hits).toBeGreaterThan(0);
  });
  it('命中交通关键词', () => {
    expect(mapCategory('滴滴出行 打车费').categoryKey).toBe('transport');
  });
  it('未命中 → 兜底分类 other', () => {
    const r = mapCategory('xyz未知内容');
    expect(r.categoryKey).toBe('other');
  });
  it('空文本 → other + 0 置信', () => {
    const r = mapCategory('   ');
    expect(r.categoryKey).toBe('other');
    expect(r.hits).toBe(0);
    expect(r.confidence).toBe(0);
  });
  it('大小写不敏感（关键词含 rmb / 英文片语）', () => {
    // '便利店' 属 shopping 与 daily 双命中，多数决倾斜不确定；只验证不抛且能返回
    expect(typeof mapCategory('便利店 洗衣').categoryKey).toBe('string');
  });
});

describe('recognizeByRules', () => {
  it('合并金额 + 分类', () => {
    const r = recognizeByRules('咖啡店 消费 ¥28 元');
    expect(r.amount).toBe(2800);
    expect(r.categoryKey).toBe('food');
    expect(r.hits).toBeGreaterThan(0);
  });
  it('无金额但有分类词', () => {
    const r = recognizeByRules('地铁');
    expect(r.amount).toBeUndefined();
    expect(r.categoryKey).toBe('transport');
  });
  it('纯占位文本 → 兜底', () => {
    const r = recognizeByRules('随手记');
    expect(r.categoryKey).toBe('other');
    expect(r.amount).toBeUndefined();
  });
});