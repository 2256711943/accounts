<template>
  <!-- 页面滚动模式：父页面 onPageScroll 传入 scrollTop，组件用绝对定位画布撑起总高，
       只渲染可视区 ±overscan 屏的行。不改动页面滚动行为（下拉刷新/触底加载照常）。 -->
  <view class="vl" :style="{ height: totalHeightPx + 'px' }">
    <view
      v-for="row in visibleRows"
      :key="row.key"
      class="vl__row"
      :style="rowStyle(row.index)"
    >
      <slot name="row" :item="row.item" :index="row.index" />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * D13 自研虚拟列表（简历亮点本体，亮点 H4 下）—— 不引任何第三方。
 *
 * 设计（DEV_PLAN §D13）：
 * - 页面滚动模式：列表是普通文档流里的绝对定位画布，总高 = items.length × itemHeight，
 *   实际只渲染可视区 ±overscan 屏的行（computeRange，纯函数可单测）。
 *   父页面在 `onPageScroll` 里节流（16ms）后把 scrollTop 传进来，不动页面滚动行为，
 *   下拉刷新 / onReachBottom（触底加载）等页面级能力原样保留。
 * - setData 治理：可视区间变化时，序列化该区间数据统计字节数 → `perf.recordSetdata`。
 * - ≤threshold（默认 200）条不启用虚拟化：区间退化为全量，防止小列表抖动。
 *
 * 协议：props in / slot out，无 store、无请求（components 红线）。
 */
import { computed, watch } from 'vue';
import { recordSetdata } from '@/utils/perf';
import { computeRange, serializedBytes, type VListRange } from './virtual';
import { isMpWeixin } from '@/adapters/system';

interface Props {
  items: unknown[];
  /** 每行固定高度（px） */
  itemHeight: number;
  /** 页面滚动位置（px，父页面 onPageScroll 节流后传入） */
  scrollTop?: number;
  /** 缓冲屏数（默认 ±2 屏；D13 压测实测 overscan=2 时可视节点 40 余、单次 setData ≤8KB） */
  overscan?: number;
  /** 低于等于该条数不启用虚拟化 */
  threshold?: number;
  /** 可视区高度（px，默认取系统窗口高；压测可注入任意值） */
  viewportHeight?: number;
  /** 行 key 生成器（默认取 index） */
  rowKey?: (item: unknown, index: number) => string;
}

const props = withDefaults(defineProps<Props>(), {
  scrollTop: 0,
  overscan: 2,
  threshold: 200,
  rowKey: (_item, index) => String(index),
});

const virtualized = computed(() => props.items.length > props.threshold);
const totalHeightPx = computed(() => props.items.length * props.itemHeight);

const viewportPx = computed(() => {
  if (props.viewportHeight != null && props.viewportHeight > 0) return props.viewportHeight;
  return isMpWeixin() ? uni.getSystemInfoSync().windowHeight : window.innerHeight;
});

const range = computed<VListRange>(() =>
  virtualized.value
    ? computeRange(props.scrollTop, props.itemHeight, viewportPx.value, props.overscan, props.items.length)
    : { start: 0, end: props.items.length }
);

const visibleRows = computed(() => {
  const rows: { key: string; index: number; item: unknown }[] = [];
  for (let i = range.value.start; i < range.value.end; i += 1) {
    rows.push({ key: props.rowKey(props.items[i], i), index: i, item: props.items[i] });
  }
  return rows;
});

function rowStyle(index: number): Record<string, string> {
  return {
    position: 'absolute',
    top: `${index * props.itemHeight}px`,
    left: '0',
    right: '0',
    height: `${props.itemHeight}px`,
  };
}

/* setData 治理：可视区间变更即统计一次序列化字节（D13 DoD 指标）。 */
watch(
  visibleRows,
  (rows) => {
    if (!virtualized.value || rows.length === 0) return;
    recordSetdata(serializedBytes(rows.map((r) => r.item)));
  },
  { flush: 'post' }
);

defineExpose({
  visibleCount: computed(() => range.value.end - range.value.start),
  range,
  totalHeightPx,
  virtualized,
});
</script>

<style lang="scss">
@import '../../styles/tokens';

.vl {
  box-sizing: border-box;
  width: 100%;

  &__row {
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
  }
}
</style>
