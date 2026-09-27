<template>
  <view class="page">
    <!-- 离线顶条 -->
    <view v-if="store.offline" class="offline-bar">
      <text class="offline-bar__text">当前无网络，记账会先存在本地</text>
    </view>

    <!-- 顶部 Hero：月份 + 本月总支出 -->
    <view class="hero">
      <text class="hero__month">{{ monthLabel }}</text>
      <text class="hero__label">本月支出（元）</text>
      <text class="hero__amount">{{ expenseTotalLabel }}</text>
    </view>

    <!-- 前三分类速览 -->
    <view v-if="topCategories.length" class="top-cats">
      <view v-for="cat in topCategories" :key="cat.categoryId" class="top-cat">
        <view class="top-cat__head">
          <text class="top-cat__name">{{ categoryName(cat.categoryId) }}</text>
          <text class="top-cat__amount">{{ fenToYuan(cat.amount) }}</text>
        </view>
        <view class="top-cat__track">
          <view class="top-cat__bar" :style="{ width: cat.ratio + '%' }" />
        </view>
      </view>
    </view>

    <!-- 分类筛选胶囊 -->
    <view v-if="!isNoData" class="chips">
      <view
        class="chip"
        :class="{ 'chip--active': store.categoryId === null }"
        @tap="onToggleCategory(null)"
      >全部</view>
      <view
        v-for="cat in availableChips"
        :key="cat"
        class="chip"
        :class="{ 'chip--active': store.categoryId === cat }"
        @tap="onToggleCategory(cat)"
      >{{ categoryName(cat) }}</view>
    </view>

    <!-- 列表：分组 -->
    <view v-if="!store.loading && !store.error && !isNoData" class="content" :class="{ 'content--fading': fading }">
      <view v-for="group in groups" :key="group.label" class="group">
        <view class="group__header">
          <text class="group__label">{{ group.label }}</text>
          <text class="group__count">{{ group.items.length }} 笔</text>
        </view>
        <view
          v-for="item in group.items"
          :key="item.clientId"
          class="item"
          :class="'item--' + item.type"
          @tap="onTapItem(item)"
        >
          <view class="item__avatar" :style="{ backgroundColor: categoryColor(item.categoryId) }">
            <text class="item__avatar-text">{{ categoryName(item.categoryId).slice(0, 1) }}</text>
          </view>
          <view class="item__body">
            <text class="item__title">{{ item.merchant || categoryName(item.categoryId) }}</text>
            <text class="item__sub">{{ categoryName(item.categoryId) }} · {{ timeText(item.happenedAt) }}</text>
          </view>
          <text class="item__amount">{{ (item.type === 'expense' ? '-' : '+') + fenToYuan(item.amount) }}</text>
        </view>
      </view>

      <view class="footer">
        <wd-loadmore :status="loadmoreStatus" @loadmore="onLoadMore" />
      </view>
    </view>

    <!-- 空态 -->
    <view v-if="!store.loading && !store.error && isNoData" class="empty">
      <text class="empty__emoji">🧾</text>
      <text class="empty__title">本月还没有账单</text>
      <text class="empty__desc">拍一张小票，开始记账吧</text>
      <view class="empty__btn" @tap="onTapFab">拍一张开始记账</view>
    </view>

    <view v-if="store.error && !store.loading" class="error">
      <text class="error__title">加载失败</text>
      <text class="error__desc">{{ store.error?.message }}</text>
      <view class="error__btn" @tap="onRetry">重试</view>
    </view>

    <!-- 加载态 -->
    <view v-if="store.loading" class="skeleton">
      <view class="skeleton__amount" />
      <view v-for="i in 5" :key="i" class="skeleton__row">
        <view class="skeleton__dot" />
        <view class="skeleton__line" />
      </view>
    </view>

    <!-- 悬浮按钮 -->
    <view class="fab" @tap="onTapFab">
      <text class="fab__icon">＋</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * D5 真实首页 —— record store 数据源 + 四态（加载/空/错/离线）+ 分类筛选 + 下拉刷新。
 *
 * 顶部金额速览暂用「本月列表合计」占位：后续接 `stats.monthly` 云函数（服务端聚合），
 * 见 docs/DEV_PLAN.md D5「明确不做」。分类源固定少数内置项（无历史数据时也能出胶囊）。
 */
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { useRecordStore } from '@/stores/record';
import { fenToYuan, groupByDay } from '@/utils/format';
import { prefersReducedMotion } from '@/adapters/system';
import type { LedgerRecord } from '@/types/model';

const store = useRecordStore();

/* ── 分类内置项（无后端分类表，先固定少数；名/色仅供首屏展示） ── */
interface BuiltinCat {
  name: string;
  color: string;
}
const BUILTIN_CATS: Record<string, BuiltinCat> = {
  food: { name: '餐饮', color: '#4C86F5' },
  transport: { name: '交通', color: '#12A594' },
  shopping: { name: '购物', color: '#F0A32B' },
  entertainment: { name: '娱乐', color: '#E0464B' },
  other: { name: '其他', color: '#8A8FA3' },
};
function categoryName(id?: string): string {
  return (id && BUILTIN_CATS[id]?.name) || id || '未分类';
}
function categoryColor(id?: string): string {
  return (id && BUILTIN_CATS[id]?.color) || '#8A8FA3';
}

/* ── Hero：本月 + 总支出（列表合计占位） ── */
const monthLabel = computed(() => {
  const d = new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
});
const expenseTotal = computed(() =>
  store.list.filter((r) => r.type === 'expense').reduce((sum, r) => sum + (r.amount || 0), 0)
);
const expenseTotalLabel = computed(() => fenToYuan(expenseTotal.value));

/* ── 前三分类速览 ── */
const topCategories = computed(() => {
  const byCat = new Map<string, number>();
  for (const r of store.list) {
    if (r.type !== 'expense') continue;
    byCat.set(r.categoryId, (byCat.get(r.categoryId) || 0) + (r.amount || 0));
  }
  const total = [...byCat.values()].reduce((s, v) => s + v, 0) || 1;
  return [...byCat.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount, ratio: Math.round((amount / total) * 100) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
});

/* ── 筛选胶囊：候选来自列表去重 ── */
const availableChips = computed(() => [...new Set(store.list.map((r) => r.categoryId).filter(Boolean))]);
const isNoData = computed(() => store.list.length === 0);

/* ── 日期分组 ── */
const groups = computed(() => groupByDay(store.list));

const timeText = (ts?: number) => {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : `${d.getMonth() + 1}月${d.getDate()}日`;
};

/* ── 分页状态 ── */
const loadmoreStatus = computed(() => {
  if (store.loadingMore) return 'loading';
  if (!store.hasMore) return 'finished';
  return 'loading';
});

/* ── 淡入淡出切换（只动 opacity，尊重 prefers-reduced-motion） ── */
const fading = ref(false);
const prefersReduced = ref(false);

async function onToggleCategory(id: string | null) {
  if (store.categoryId === id) return;
  if (prefersReduced.value) {
    await store.setCategory(id);
    return;
  }
  fading.value = true;
  await new Promise((r) => setTimeout(r, 120));
  await store.setCategory(id);
  fading.value = false;
  await new Promise((r) => setTimeout(r, 200));
  fading.value = false;
}

/* ── 生命周期 ── */
onLoad(() => {
  prefersReduced.value = prefersReducedMotion();
  store.fetch(true);
});
onPullDownRefresh(async () => {
  await store.fetch(true);
  uni.stopPullDownRefresh();
});
onReachBottom(() => {
  store.loadMore();
});

/* ── 交互 ── */
function onRetry() {
  store.fetch(true);
}
function onLoadMore() {
  store.loadMore();
}
function onTapItem(item: LedgerRecord) {
  // 详情页 D8 接入；暂反馈
  uni.showToast({ title: `${categoryName(item.categoryId)} ${fenToYuan(item.amount)} 元`, icon: 'none' });
}
function onTapFab() {
  // 拍照页 D6 接入；触发轻微振动提示已响应
  // #ifdef MP-WEIXIN
  uni.vibrateShort({ type: 'light' });
  // #endif
  uni.showToast({ title: '拍照记账 D6 接入', icon: 'none' });
}
</script>

<style lang="scss">
@import '../../styles/tokens';

.page {
  position: relative;
  box-sizing: border-box;
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + #{$sp-8}) $sp-4 #{ $sp-8 * 3 };
  background-color: $color-bg-base;
}

/* 离线顶条 */
.offline-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44rpx;
  margin-bottom: $sp-4;
  background-color: $color-warning;
  border-radius: $r-sm;

  &__text {
    font-size: $fs-caption;
    color: $color-bg-surface;
  }
}

/* Hero */
.hero {
  display: flex;
  flex-direction: column;
  gap: $sp-2;
  padding: $sp-5;
  background-color: $color-bg-surface;
  border-radius: $r-lg;
  box-shadow: $sh-1;

  &__month {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }

  &__label {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }

  &__amount {
    font-size: $fs-display;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }
}

/* 前三分类速览 */
.top-cats {
  display: flex;
  flex-direction: column;
  gap: $sp-4;
  margin-top: $sp-5;
}

.top-cat {
  display: flex;
  flex-direction: column;
  gap: $sp-2;

  &__head {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  &__name {
    font-size: $fs-body;
    color: $color-text-primary;
  }

  &__amount {
    font-size: $fs-body;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__track {
    height: 8rpx;
    overflow: hidden;
    background-color: $color-line;
    border-radius: $r-full;
  }

  &__bar {
    height: 100%;
    background-color: $color-accent;
    border-radius: $r-full;
  }
}

/* 分类筛选胶囊 */
.chips {
  display: flex;
  flex-flow: row wrap;
  gap: $sp-2;
  margin-top: $sp-5;
}

.chip {
  padding: $sp-2 $sp-4;
  font-size: $fs-caption;
  color: $color-text-secondary;
  background-color: $color-bg-surface;
  border: 1rpx solid $color-line;
  border-radius: $r-full;

  &--active {
    color: $color-accent;
    background-color: $color-accent-soft;
    border-color: transparent;
  }
}

/* 内容淡入淡出 */
.content {
  margin-top: $sp-5;
  transition: opacity 200ms $ease-std;

  &--fading {
    opacity: 0;
  }
}

/* 日期分组 */
.group {
  margin-top: $sp-5;

  &__header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 0 $sp-1 $sp-2;
  }

  &__label {
    font-size: $fs-caption;
    font-weight: $font-weight-medium;
    color: $color-text-secondary;
  }

  &__count {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }
}

.item {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 112rpx;
  padding: 0 $sp-3;
  margin-bottom: $sp-2;
  background-color: $color-bg-surface;
  border-radius: $r-md;
  box-shadow: $sh-1;

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72rpx;
    height: 72rpx;
    border-radius: $r-full;
  }

  &__avatar-text {
    font-size: $fs-body;
    color: $color-bg-surface;
  }

  &__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: $sp-1;
    margin-left: $sp-3;
  }

  &__title {
    font-size: $fs-body;
    color: $color-text-primary;
  }

  &__sub {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }

  &--expense &__amount {
    color: $color-danger;
  }

  &--income &__amount {
    color: $color-success;
  }

  &__amount {
    font-size: $fs-body;
    font-weight: $font-weight-medium;
  }
}

/* 分页脚 */
.footer {
  margin-top: $sp-4;
}

/* 空态 / 错误态 */
.empty,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-3;
  padding: $sp-8 $sp-4;
  margin-top: $sp-8;

  &__title {
    font-size: $fs-h2;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__desc {
    font-size: $fs-body;
    color: $color-text-secondary;
  }

  &__emoji {
    font-size: $fs-display;
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

/* 骨架屏 */
.skeleton {
  display: flex;
  flex-direction: column;
  gap: $sp-4;
  margin-top: $sp-8;

  &__amount {
    width: 40%;
    height: 64rpx;
    background-color: $color-bg-surface;
    border-radius: $r-sm;
  }

  &__row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: $sp-3;
    padding: $sp-4;
    background-color: $color-bg-surface;
    border-radius: $r-md;
  }

  &__dot {
    width: 72rpx;
    height: 72rpx;
    background-color: $color-line;
    border-radius: $r-full;
  }

  &__line {
    flex: 1;
    height: 24rpx;
    background-color: $color-line;
    border-radius: $r-sm;
  }
}

/* 悬浮按钮 */
.fab {
  position: fixed;
  right: $sp-6;
  bottom: calc(env(safe-area-inset-bottom) + 40rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  background-color: $color-accent;
  border-radius: $r-full;
  box-shadow: $sh-2;

  &__icon {
    font-size: 56rpx;
    line-height: 1;
    color: $color-bg-surface;
  }
}

@media (prefers-reduced-motion: reduce) {
  .content {
    transition: none;
  }
}
</style>