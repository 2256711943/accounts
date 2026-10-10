<template>
  <view class="donut" :style="{ width: size + 'px', height: size + 'px' }">
    <!-- 中心文本：默认展示总额；选中扇区时展示该分类金额与占比 -->
    <view class="donut__center">
      <text class="donut__value">{{ centerValue }}</text>
      <text class="donut__label">{{ centerLabel }}</text>
    </view>
    <canvas
      id="donut-canvas"
      type="2d"
      class="donut__canvas"
      :style="{ width: size + 'px', height: size + 'px' }"
      @tap="onTap"
      @touchmove.stop.prevent
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 环形图（canvas 2d 自绘，DVD 简历亮点本体 —— 禁外采 / 不被替换，见 AGENTS.md 组件引入红线）。
 * - 纯 canvas 2d 自绘，替代 uCharts / ec-canvas，省下主包体积（简历条目）。
 * - dpr 适配：物理像素按 pixelRatio 放大，逻辑坐标 ctx.scale 还原。
 * - 扇区点击高亮：touch 坐标 → 极坐标角度 → 命中检测。
 *
 * 依赖方向：仅消费 props 与 emit，不发请求、不读全局 store（AGENTS 组件红线 3）。
 * 扇区颜色由父级按分类映射给定（源自 `services/recognize/categories.ts`），本组件不写领域色。
 */
import { onMounted, ref, watch } from 'vue';
import { getDpr } from '@/adapters/imaging';
import { withAlpha } from './DonutChart.utils';

export interface DonutSlice {
  /** 分类 key（仅用于事件回传；绘制权重用 value） */
  categoryId: string;
  /** 权重（单位「分」），占比自动 = value / sum */
  value: number;
}

const props = withDefaults(
  defineProps<{
    /** 数据。value 权重决定扇区角度，空数组显示空环 */
    slices: DonutSlice[];
    /** 与 slices 等长的扇区色值（hex） */
    colors: string[];
    /** 侧视尺寸（px），宽 = 高 */
    size?: number;
    /** 环厚度（px） */
    thickness?: number;
    /** 底环色（去强调，与 token color-bg-subtle 一致） */
    trackColor?: string;
    /** 中心主文本（通常为总额） */
    centerValue?: string;
    /** 中心副文本 */
    centerLabel?: string;
  }>(),
  { size: 220, thickness: 26, trackColor: '#F0F0F5', centerValue: '', centerLabel: '' }
);

const emit = defineEmits<{ (e: 'change', index: number): void }>();

/** 选中扇区索引；-1 = 未选中（中心显示默认总额）。父级可通过监听 change 得知高亮。 */
const sel = ref(-1);

interface SliceArc {
  index: number;
  categoryId: string;
  start: number;
  end: number;
}
let arcs: SliceArc[] = [];
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function setupCanvas(): void {
  try {
    uni
      .createSelectorQuery()
      .select('#donut-canvas')
      .node((res: unknown) => {
        const n = res as { node?: { getContext(t: string): CanvasRenderingContext2D | null } } | null;
        const node = n?.node;
        if (!node) return;
        canvas = node as unknown as HTMLCanvasElement;
        ctx = node.getContext('2d');
        draw();
      })
      .exec();
  } catch {
    /* 画布能力缺失 → 保留空环占位（不抛） */
  }
}

function draw(): void {
  const c = canvas;
  const g = ctx;
  if (!c || !g) return;
  const dpr = getDpr();
  const size = props.size;
  c.width = size * dpr;
  c.height = size * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 2;
  const inner = outer - props.thickness;

  // 底环（subtle，恒显示，形成「整圈」观感）
  g.beginPath();
  g.arc(cx, cy, outer, 0, Math.PI * 2);
  g.arc(cx, cy, inner, 0, Math.PI * 2, true);
  g.closePath();
  g.fillStyle = props.trackColor;
  g.fill();

  const valid = props.slices.filter((s) => s.value > 0);
  const total = valid.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    arcs = [];
    return;
  }

  arcs = [];
  // 起点指向正上方（-90°），顺时针
  let angle = -Math.PI / 2;
  valid.forEach((s, i) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    arcs.push({ index: i, categoryId: s.categoryId, start, end });

    const isSel = sel.value === i;
    g.beginPath();
    // 高亮扇区外扩 4px，制造「凸起」层次
    g.arc(cx, cy, isSel ? outer + 4 : outer, start, end);
    g.arc(cx, cy, isSel ? inner - 4 : inner, end, start, true);
    g.closePath();
    const hex = props.colors[i] || props.trackColor;
    g.fillStyle = isSel ? hex : withAlpha(hex, 0.35);
    g.fill();

    angle = end;
  });
}

/** 把 hex → `rgba(hex, alpha)`，供未选中扇区降透明。实现与单测见 `DonutChart.utils.ts`。 */

function onTap(e: { detail: { x: number; y: number } }): void {
  const x = e.detail.x - props.size / 2;
  const y = e.detail.y - props.size / 2;
  const radius = Math.hypot(x, y);
  const outer = props.size / 2 - 2;
  const inner = outer - props.thickness;
  if (radius < inner || radius > outer + 4) {
    setSel(-1);
    return;
  }
  let deg = (Math.atan2(y, x) * 180) / Math.PI; // [-180, 180]
  const rad = (deg * Math.PI) / 180;
  // 与绘制同起点（正上方 = -90°），归一到 [0, 2π)
  let rel = rad - -Math.PI / 2;
  while (rel < 0) rel += Math.PI * 2;
  const hit = arcs.find((a) => rel >= a.start - 1e-6 && rel < a.end);
  setSel(hit ? hit.index : -1);
}

function setSel(index: number): void {
  if (sel.value === index) return;
  sel.value = index;
  draw();
  emit('change', index);
}

onMounted(() => {
  setupCanvas();
});

watch(() => [props.slices, props.colors], () => draw());
</script>

<style lang="scss">
.donut {
  position: relative;

  &__canvas {
    position: absolute;
    inset: 0;
  }

  /* 中心文本用 view 覆盖在 canvas 之上，走 token 变量，避免在 canvas 文本里写死样式 */
  &__center {
    position: absolute;
    top: 50%;
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $sp-1;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  &__value {
    font-size: $fs-h2;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__label {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }
}
</style>