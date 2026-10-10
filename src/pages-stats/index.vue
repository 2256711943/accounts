<template>
  <view class="page">
    <!-- 顶部：本月 + 环比 -->
    <view class="head" @tap="onTapHead">
      <text class="head__month">{{ monthLabel(thisMonthKey) }}</text>
      <text class="head__mom" v-if="mo2NBadge">{{ mo2NBadge }}</text>
    </view>

    <!-- 总额 + 日均 -->
    <view class="kpi">
      <view class="kpi__item">
        <text class="kpi__label">本月支出（元）</text>
        <text class="kpi__value">{{ fenToYuan(stats?.total) }}</text>
      </view>
      <view class="kpi__item">
        <text class="kpi__label">日均（元/天）</text>
        <text class="kpi__value">{{ fenToYuan(stats?.avg) }}</text>
      </view>
    </view>

    <!-- 环形图 + 分类明细 -->
    <view v-if="!loading && !error && ring.length" class="chart">
      <DonutChart
        :slices="ring"
        :colors="ringColors"
        :size="200"
        :center-value="centerValue"
        :center-label="centerLabel"
        @change="onDonutChange"
      />
      <view class="legend">
        <view v-for="(s, i) in stats?.byCategory ?? []" :key="s.categoryId" class="legend__row">
          <view class="legend__left">
            <view class="legend__dot" :style="{ backgroundColor: colorOf(s.categoryId) }" />
            <text class="legend__name">{{ nameOf(s.categoryId) }}</text>
          </view>
          <view class="legend__right">
            <view class="legend__track">
              <view
                class="legend__bar"
                :class="{ 'legend__bar--dim': activeBar !== null && activeBar !== i }"
                :style="{ width: pctOf(s.amount) + '%', backgroundColor: colorOf(s.categoryId) }"
              />
            </view>
            <text class="legend__amount">{{ fenToYuan(s.amount) }}</text>
            <text class="legend__pct">{{ pctText(s.amount) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空态 -->
    <view v-if="!loading && !error && !ring.length && stats" class="empty">
      <text class="empty__emoji">📊</text>
      <text class="empty__title">本月还没有支出</text>
      <text class="empty__desc">拍一张小票，看看分类占比</text>
    </view>

    <!-- 错误态 -->
    <view v-if="error && !loading" class="error">
      <text class="error__title">统计加载失败</text>
      <text class="error__desc">{{ error }}</text>
      <view class="error__btn" @tap="load">重试</view>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="loading">
      <view class="loading__ring" />
      <view class="loading__line" />
      <view class="loading__line loading__line--short" />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * D9 统计页（普通分包 `pages-stats`）—— 总额 / 日均 / 环比 / 分类占比 + 自绘环形图。
 *
 * 数据边界（D9 决策）：云函数 `stats.monthly` 未实现，本轮走**客户端聚合**——
 * 用 `record.list` 循环拉取「本月 + 上月」区间，经 `services/stats/aggregate.ts` 算总额/日均/
 * 环比/占比。环图占比之和 = 1（SPEC US-03）。H5 无云 SDK → `call` 抛 NETWORK → 错误态。
 */
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { call } from '@/api/client';
import { fenToYuan, monthKey, monthStartTicks } from '@/utils/format';
import { computeMonthly } from '@/services/stats/aggregate';
import { CATEGORIES } from '@/services/recognize/categories';
import DonutChart from '@/components/biz/DonutChart.vue';
import type { DonutSlice } from '@/components/biz/DonutChart.vue';
import type { LedgerRecord } from '@/types/model';
import type { StatsMonthlyData } from '@/types/api';

const PAGE = 100;
const CAP = 2000;

const thisMonthKey = monthKey();
const thisStart = monthStartTicks(0);
const lastStart = monthStartTicks(-1);

const loading = ref(true);
const error = ref('');
const stats = ref<StatsMonthlyData | null>(null);
const lastTotal = ref(0);
const activeBar = ref<number | null>(null);

function nameOf(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.name ?? key ?? '未分类';
}
function colorOf(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.color ?? '#8A8F98';
}
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${y} 年 ${m} 月`;
}

/** 按 `since` 循环拉完全部区间（游标翻页，封顶防死循环）。 */
async function fetchWindow(since: number): Promise<LedgerRecord[]> {
  const out: LedgerRecord[] = [];
  let cursor: string | undefined;
  for (;;) {
    const data = await call('record.list', {
      since,
      limit: PAGE,
      ...(cursor ? { cursor } : {}),
    });
    out.push(...data.list);
    if (!data.hasMore || !data.nextCursor) break;
    if (out.length >= CAP) break;
    cursor = data.nextCursor;
  }
  return out;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  stats.value = null;
  try {
    const all = await fetchWindow(lastStart);
    const lastBucket = all.filter((r) => r.happenedAt >= lastStart && r.happenedAt < thisStart);
    const thisBucket = all.filter((r) => r.happenedAt >= thisStart);
    stats.value = computeMonthly(thisBucket, thisMonthKey);
    lastTotal.value = computeMonthly(lastBucket, monthKey(lastStart)).total;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

/* ── 环图数据 / 视图映射 ── */
const ring = computed<DonutSlice[]>(() =>
  (stats.value?.ring ?? []).map((s) => ({ categoryId: s.categoryId, value: s.amount }))
);
const ringColors = computed(() => (stats.value?.ring ?? []).map((s) => colorOf(s.categoryId)));

function pctOf(amount: number): number {
  if (!stats.value || stats.value.total <= 0) return 0;
  return (amount / stats.value.total) * 100;
}
function pctText(amount: number): string {
  return `${pctOf(amount).toFixed(0)}%`;
}

/** 环 == 选中：中心显示该分类金额与占比，右侧条目置灰高亮联动 */
const centerValue = computed(() => {
  if (activeBar.value === null || !stats.value) return fenToYuan(stats.value?.total);
  const slice = stats.value.byCategory[activeBar.value];
  return slice ? fenToYuan(slice.amount) : fenToYuan(stats.value.total);
});
const centerLabel = computed(() => {
  if (activeBar.value === null || !stats.value) return '总支出';
  const slice = stats.value.byCategory[activeBar.value];
  return slice ? `${nameOf(slice.categoryId)} · ${pctText(slice.amount)}` : '总支出';
});
function onDonutChange(index: number): void {
  activeBar.value = index >= 0 ? index : null;
}

/** 环比徽标：>0 上升(警示色) / <0 下降(成功色) / 无上月 → 不显示 */
const mo2NBadge = computed(() => {
  if (lastTotal.value <= 0) return stats.value && stats.value.total > 0 ? '本月首记' : '';
  const diff = stats.value ? stats.value.total - lastTotal.value : 0;
  const pct = (diff / lastTotal.value) * 100;
  return `${diff >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(0)}%`;
});

function onTapHead(): void {
  // 月切换依赖云函数 stats.monthly 的范围过滤，本轮不做；点标题回到首页方便核对
  uni.navigateBack();
}

onLoad(() => {
  load();
});
</script>

<style lang="scss">
@import '../styles/tokens';

.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: $sp-5 $sp-4 $sp-8;
  background-color: $color-bg-base;
}

.head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-3;

  &__month {
    font-size: $fs-h1;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__mom {
    padding: $sp-1 $sp-2;
    font-size: $fs-caption;
    color: $color-text-secondary;
    background-color: $color-bg-surface;
    border-radius: $r-full;
  }
}

.kpi {
  display: flex;
  flex-direction: row;
  gap: $sp-3;
  margin-top: $sp-4;

  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: $sp-2;
    padding: $sp-4;
    background-color: $color-bg-surface;
    border-radius: $r-lg;
    box-shadow: $sh-1;
  }

  &__label {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }

  &__value {
    font-size: $fs-h2;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }
}

.chart {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-5;
  padding: $sp-5;
  margin-top: $sp-4;
  background-color: $color-bg-surface;
  border-radius: $r-lg;
  box-shadow: $sh-1;
  box-sizing: border-box;
}

.legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: $sp-3;

  &__row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  &__left {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: $sp-2;
    width: 96rpx;
  }

  &__dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: $r-full;
  }

  &__name {
    font-size: $fs-caption;
    color: $color-text-primary;
  }

  &__right {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: $sp-2;
    flex: 1;
  }

  &__track {
    flex: 1;
    height: 8rpx;
    overflow: hidden;
    background-color: $color-line;
    border-radius: $r-full;
  }

  &__bar {
    height: 100%;
    border-radius: $r-full;
    transition: opacity $dur-fast $ease-std;

    &--dim {
      opacity: 0.25;
    }
  }

  &__amount {
    font-size: $fs-caption;
    color: $color-text-primary;
  }

  &__pct {
    width: 64rpx;
    font-size: $fs-caption;
    color: $color-text-secondary;
    text-align: right;
  }
}

.empty,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-3;
  padding: $sp-8 $sp-4;
  margin-top: $sp-8;

  &__emoji {
    font-size: $fs-display;
  }

  &__title {
    font-size: $fs-h2;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__desc {
    font-size: $fs-body;
    color: $color-text-secondary;
  }

  &__btn {
    padding: $sp-3 $sp-8;
    margin-top: $sp-2;
    font-size: $fs-body;
    color: $color-bg-surface;
    background-color: $color-accent;
    border-radius: $r-full;
  }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-4;
  margin-top: $sp-8;

  &__ring {
    width: 200rpx;
    height: 200rpx;
    background-color: $color-bg-surface;
    border-radius: $r-full;
  }

  &__line {
    width: 60%;
    height: 24rpx;
    background-color: $color-bg-surface;
    border-radius: $r-sm;

    &--short {
      width: 40%;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .legend__bar {
    transition: none;
  }
}
</style>