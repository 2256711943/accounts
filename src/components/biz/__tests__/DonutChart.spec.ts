import { describe, expect, it } from 'vitest';
import { withAlpha } from '../DonutChart.utils';

/**
 * DonutChart 纯函数单测 —— 覆盖从 .vue 组件拆出的可脱离 uni/canvas 运行时测试的逻辑。
 * （组件绘制本身依赖 `uni.createSelectorQuery` + canvas 2d，属双端 build/浏览器实测范围。）
 */
describe('withAlpha（hex → rgba）', () => {
  it.each([
    ['#4C86F5', 0.35, 'rgba(76, 134, 245, 0.35)'],
    ['#E0464B', 1, 'rgba(224, 70, 75, 1)'],
    ['4C86F5', 0.5, 'rgba(76, 134, 245, 0.5)'],
    ['#12A594', 0.2, 'rgba(18, 165, 148, 0.2)']
  ])('%s @ %s → %s', (hex, alpha, expected) => {
    expect(withAlpha(hex, alpha)).toBe(expected);
  });

  it('非法 hex 原样返回（不抛）', () => {
    expect(withAlpha('not-a-color', 0.3)).toBe('not-a-color');
  });

  it('带空格的 hex 先去掉空白再解析', () => {
    expect(withAlpha(' #F0A32B ', 0.5)).toBe('rgba(240, 163, 43, 0.5)');
  });
});
