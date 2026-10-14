<template>
  <view class="page">
    <!-- 自定义导航（D14 打磨：滚动超阈值淡入，只动 opacity） -->
    <view class="top-nav" :class="{ 'top-nav--visible': navVisible }">
      <text class="top-nav__title">一拍记</text>
      <view class="top-nav__links">
        <text class="top-nav__link" hover-class="top-nav__link--hover" @tap="onTapStats">统计</text>
        <text class="top-nav__link" hover-class="top-nav__link--hover" @tap="onTapProfile">我的</text>
      </view>
    </view>

    <!-- 离线顶条 -->
    <view v-if="store.offline" class="offline-bar">
      <text class="offline-bar__text">当前无网络，记账会先存在本地</text>
    </view>

    <!-- 待同步条（D10 离线队列）：有待同步账单时展示，点击手动触发补传 -->
    <view v-if="store.pendingCount > 0" class="pending-bar" hover-class="pending-bar--hover" @tap="onTapSyncNow">
      <text class="pending-bar__text">{{ store.pendingCount }} 条账单待同步</text>
      <text class="pending-bar__action">{{ store.online ? '立即同步 ›' : '联网后自动同步' }}</text>
    </view>

    <!-- 顶部 Hero：月份 + 本月总支出 + 跳统计/我的入口 -->
    <view class="hero">
      <view class="hero__top">
        <text class="hero__month">{{ monthLabel }}</text>
        <view class="hero__links">
          <text class="hero__link" hover-class="hero__link--hover" @tap="onTapStats">统计</text>
          <text class="hero__link" hover-class="hero__link--hover" @tap="onTapProfile">我的</text>
        </view>
      </view>
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
        hover-class="chip--hover"
        @tap="onToggleCategory(null)"
      >全部</view>
      <view
        v-for="cat in availableChips"
        :key="cat"
        class="chip"
        :class="{ 'chip--active': store.categoryId === cat }"
        hover-class="chip--hover"
        @tap="onToggleCategory(cat)"
      >{{ categoryName(cat) }}</view>
    </view>

    <!-- 列表：分组（D13 虚拟列表化，5000 条仅渲染可视区 ±3 屏） -->
    <view v-if="!store.loading && !store.error && !isNoData" class="content" :class="{ 'content--fading': fading }">
      <view class="content__list">
        <SgVirtualList
          ref="vlistRef"
          :items="flatRows"
          :item-height="ROW_HEIGHT"
          :scroll-top="scrollTop"
          :row-key="rowKey"
        >
          <template #row="{ item }">
            <view v-if="item.kind === 'header'" class="group__header" :style="{ height: ROW_HEIGHT + 'px' }">
              <text class="group__label">{{ item.label }}</text>
              <text class="group__count">{{ item.count }} 笔</text>
            </view>
            <view
              v-else
              :key="item.item.clientId"
              class="item"
              :class="'item--' + item.item.type"
              hover-class="item--hover"
              @tap="onTapItem(item.item)"
            >
              <view class="item__avatar" :style="{ backgroundColor: categoryColor(item.item.categoryId) }">
                <text class="item__avatar-text">{{ categoryName(item.item.categoryId).slice(0, 1) }}</text>
              </view>
              <view class="item__body">
                <text class="item__title">{{ item.item.merchant || categoryName(item.item.categoryId) }}</text>
                <text class="item__sub">{{ categoryName(item.item.categoryId) }} · {{ timeText(item.item.happenedAt) }}</text>
              </view>
              <view class="item__right">
                <view
                  v-if="store.failedIds.has(item.item.clientId)"
                  class="item__badge item__badge--fail"
                  hover-class="item__badge--fail-hover"
                  @tap.stop="onTapRetry(item.item.clientId)"
                >同步失败·重试</view>
                <text v-else-if="store.pendingIds.has(item.item.clientId)" class="item__badge">待同步</text>
                <text class="item__amount">{{ (item.item.type === 'expense' ? '-' : '+') + fenToYuan(item.item.amount) }}</text>
              </view>
            </view>
          </template>
        </SgVirtualList>
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
      <view class="empty__btn" hover-class="empty__btn--hover" @tap="onTapFab">拍一张开始记账</view>
    </view>

    <view v-if="store.error && !store.loading" class="error">
      <text class="error__title">加载失败</text>
      <text class="error__desc">{{ store.error?.message }}</text>
      <view class="error__btn" hover-class="error__btn--hover" @tap="onRetry">重试</view>
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
    <view class="fab" hover-class="fab--hover" @tap="onTapFab">
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
import { onLoad, onPageScroll, onPullDownRefresh, onReady, onReachBottom } from '@dcloudio/uni-app';
import { useRecordStore } from '@/stores/record';
import { fenToYuan, groupByDay } from '@/utils/format';
import { prefersReducedMotion, vibrateShort } from '@/adapters/system';
import { markTiming, measureApi } from '@/utils/perf';
import type { LedgerRecord } from '@/types/model';

const store = useRecordStore();

/** D13 虚拟列表行高（px）：分组头与账单行统一固定高度（item 56px + 行距 8px），保证区间计算一致。 */
const ROW_HEIGHT = 64;
/** 滚动位置（px，onPageScroll 节流 16ms 后写入，驱动虚拟区间重算）。 */
const scrollTop = ref(0);
let lastScrollAt = 0;
let t1Marked = false;
const vlistRef = ref<{ visibleCount: number } | null>(null);

/** 虚拟列表行：分组头 或 账单。 */
interface FlatRow {
  kind: 'header' | 'item';
  key: string;
  label?: string;
  count?: number;
  item?: LedgerRecord;
}
const rowKey = (_item: unknown, index: number) => String(index);
/** 把按天分组扁平化为定高行序列（header 行 + 账单行），供虚拟列表渲染。 */
const flatRows = computed<FlatRow[]>(() => {
  const rows: FlatRow[] = [];
  for (const g of groups.value) {
    rows.push({ kind: 'header', key: `h-${g.label}`, label: g.label, count: g.items.length });
    for (const it of g.items) rows.push({ kind: 'item', key: `i-${it.clientId}`, item: it });
  }
  return rows;
});

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
/** D14 打磨：自定义导航滚动淡入——滚动超阈值时展示（只动 opacity）。 */
const navVisible = ref(false);
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
  const stop = measureApi('record.list');
  void store.fetch(true).finally(stop);
});
onReady(() => {
  // D13 T1：launch → 首页首屏 onReady（只标记一次）
  if (!t1Marked) {
    t1Marked = true;
    markTiming('t1');
    markTiming('pageReady');
  }
});
onPageScroll((e) => {
  // 16ms 节流：高频滚动只驱动虚拟区间重算与导航淡入，不直接 setData
  const now = Date.now();
  if (now - lastScrollAt < 16) return;
  lastScrollAt = now;
  scrollTop.value = e.scrollTop;
  navVisible.value = e.scrollTop > 120;
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
/** D11：列表项「同步失败·重试」→ 重试计数归零并立即补传。 */
function onTapRetry(clientId: string) {
  store.retry(clientId);
  uni.showToast({ title: '已重新加入同步队列', icon: 'none' });
}
function onLoadMore() {
  store.loadMore();
}
function onTapItem(item: LedgerRecord) {
  // 详情页（D9）：事件通道把当前记录透传，详情页「修改即保存」
  uni.navigateTo({
    url: `/pages-detail/index?clientId=${item.clientId}`,
    events: { init: () => undefined },
    success: (res) => {
      res.eventChannel.emit('init', item);
    },
  });
}
function onTapStats() {
  uni.navigateTo({ url: '/pages-stats/index' });
}
function onTapProfile() {
  uni.navigateTo({ url: '/pages/profile/index' });
}
function onTapSyncNow() {
  void store.flush().then((summary) => {
    if (!summary) return;
    if (summary.interrupted) {
      uni.showToast({ title: '网络不可用，稍后再试', icon: 'none' });
      return;
    }
    // D11 冲突提示：LWW 采纳服务端文档后告知用户（冲突详情见 ARCHITECTURE.md §4.2）
    if (summary.conflicts > 0) {
      uni.showToast({
        title: `${summary.conflicts} 条已在其他设备更新，已采用最新版本`,
        icon: 'none',
      });
      return;
    }
    if (summary.failed > 0) {
      uni.showToast({ title: `已同步 ${summary.synced} 条，${summary.failed} 条稍后重试`, icon: 'none' });
    }
  });
}
function onTapFab() {
  // 拍照页 D6 接入：轻震反馈 + 跳分包页面（平台差异收敛在 adapters/system）
  vibrateShort('light');
  uni.navigateTo({ url: '/pages-capture/index' });
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

/* 自定义导航（D14 打磨：滚动超阈值淡入，只动 opacity；reduced-motion 由 App.vue 全局兜底） */
.top-nav {
  position: fixed;
  top: calc(var(--status-bar-height, 0px) + #{$sp-2});
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  height: 88rpx;
  padding: 0 $sp-5;
  opacity: 0;
  pointer-events: none;
  background-color: $color-bg-base;
  transition: opacity $dur-base $ease-std;

  &--visible {
    opacity: 1;
    pointer-events: auto;
  }

  &__title {
    font-size: $fs-body;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__links {
    display: flex;
    flex-direction: row;
    gap: $sp-3;
  }

  &__link {
    font-size: $fs-caption;
    color: $color-accent;

    &--hover {
      opacity: 0.7;
    }
  }
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

/* 待同步条（D10） */
.pending-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 48rpx;
  padding: 0 $sp-3;
  margin-bottom: $sp-4;
  background-color: $color-accent-soft;
  border-radius: $r-sm;

  &__text {
    font-size: $fs-caption;
    color: $color-accent;
  }

  &__action {
    font-size: $fs-caption;
    color: $color-accent;
  }

  &--hover {
    opacity: 0.85;
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

  &__top {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  &__links {
    display: flex;
    flex-direction: row;
    gap: $sp-3;
  }

  &__link {
    font-size: $fs-caption;
    color: $color-accent;

    &--hover {
      opacity: 0.7;
    }
  }

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

  &--hover {
    opacity: 0.8;
  }
}

/* 内容淡入淡出（D14：入场只动 transform/opacity，200ms $ease-std） */
.content {
  margin-top: $sp-5;
  transition: transform $dur-base $ease-std, opacity $dur-base $ease-std;

  &--fading {
    opacity: 0;
    transform: translateY(8rpx);
  }
}

/* 日期分组（D13 虚拟列表行：header 行高由内联 ROW_HEIGHT 控制） */
.group {
  &__header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    padding: 0 $sp-1;
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

  &--hover {
    opacity: 0.85;
  }

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

  &__right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: $sp-1;
  }

  &__badge {
    font-size: $fs-tiny;
    color: $color-warning;

    &--fail {
      padding: $sp-1 $sp-2;
      color: $color-bg-surface;
      background-color: $color-danger;
      border-radius: $r-full;
    }

    &--fail-hover {
      opacity: 0.75;
    }
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

    &--hover {
      opacity: 0.85;
    }
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

/* 悬浮按钮（D14：点按弹簧，按下 120ms 缩放、松开 $ease-spring 回弹；只动 transform） */
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
  transition: transform $dur-fast $ease-spring;

  &--hover,
  &:active {
    transform: scale(0.9);
  }

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