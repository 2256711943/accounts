<template>
  <view class="page">
    <!-- 虚拟列表压测沙箱（D13 DoD：5000 条仅渲染可视区 ±3 屏，滚动单次 setData 可控） -->
    <view class="card">
      <view class="card__title">虚拟列表压测沙箱（5000 条 · 滚动本页即压测）</view>
      <view class="row">
        <text class="row__label">数据量 / 虚拟化</text>
        <text class="row__value">{{ stressItems.length }} 条 · {{ virtualized ? '开启' : '关闭' }}</text>
      </view>
      <view class="row">
        <text class="row__label">容器总高（{{ STRESS_ROW_H }}px × {{ stressItems.length }}）</text>
        <text class="row__value">{{ totalHeightPx }} px</text>
      </view>
      <view class="row">
        <text class="row__label">当前可视节点</text>
        <text class="row__value">{{ visibleCount }}</text>
      </view>
      <view class="row">
        <text class="row__label">当前区间序列化</text>
        <text class="row__value">{{ fmtBytes(currentBytes) }}</text>
      </view>
      <view class="stress">
        <SgVirtualList
          ref="stressVlist"
          :items="stressItems"
          :item-height="STRESS_ROW_H"
          :scroll-top="scrollTop"
          :row-key="rowKey"
        >
          <template #row="{ item, index }">
            <view class="stress__row" :style="{ height: STRESS_ROW_H + 'px' }">
              <text class="stress__idx">{{ index }}</text>
              <text class="stress__label">{{ (item as LedgerRecord).merchant }}</text>
              <text class="stress__amount">{{ fenToYuan((item as LedgerRecord).amount) }}</text>
            </view>
          </template>
        </SgVirtualList>
      </view>
    </view>

    <!-- T1 / 采样规模 -->
    <view class="card">
      <view class="row">
        <text class="row__label">T1 启动 → 首页首屏</text>
        <text class="row__value">{{ stats.t1 != null ? stats.t1 + ' ms' : '—' }}</text>
      </view>
      <view class="row">
        <text class="row__label">采样事件数</text>
        <text class="row__value">{{ stats.totalEvents }}</text>
      </view>
    </view>

    <!-- setData 数据量 -->
    <view class="card">
      <view class="card__title">setData 数据量（虚拟列表滚动）</view>
      <view class="row">
        <text class="row__label">累计字节</text>
        <text class="row__value">{{ fmtBytes(stats.setdataBytes) }}</text>
      </view>
      <view class="row">
        <text class="row__label">次数 / 单次最大</text>
        <text class="row__value">{{ stats.setdataCount }} 次 / {{ fmtBytes(stats.setdataMax) }}</text>
      </view>
      <view class="row">
        <text class="row__label">平均单次</text>
        <text class="row__value">{{ stats.setdataCount ? fmtBytes(Math.round(stats.setdataBytes / stats.setdataCount)) : '—' }}</text>
      </view>
    </view>

    <!-- 接口耗时 TOP5 -->
    <view class="card">
      <view class="card__title">接口耗时 TOP5</view>
      <view v-if="stats.apiTop.length" class="list">
        <view v-for="a in stats.apiTop" :key="a.name" class="list__row">
          <text class="list__name">{{ a.name }}</text>
          <text class="list__value">{{ a.avgMs }} ms（{{ a.count }} 次）</text>
        </view>
      </view>
      <text v-else class="empty">暂无接口采样</text>
    </view>

    <!-- 错误 / 压缩 -->
    <view class="card">
      <view class="row">
        <text class="row__label">错误计数</text>
        <text class="row__value">{{ errorCount }}</text>
      </view>
      <view class="row">
        <text class="row__label">最近压缩</text>
        <text class="row__value">{{ compressLabel }}</text>
      </view>
    </view>

    <!-- 压测工具（灌快照 / 清空 / 刷新） -->
    <view class="card">
      <view class="card__title">压测工具</view>
      <view class="row" @tap="onSeed">
        <text class="row__label">灌 5000 条本地快照</text>
        <text class="row__arrow">›</text>
      </view>
      <view class="row" @tap="onClearSeed">
        <text class="row__label">清空压测数据</text>
        <text class="row__arrow">›</text>
      </view>
      <view class="row" @tap="onRefresh">
        <text class="row__label">刷新面板</text>
        <text class="row__arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * D13 性能开发面板（主包 pages/dev/perf）—— 我的页版本号连点 5 次进入。
 *
 * - 顶部「虚拟列表压测沙箱」：5000 条合成账单走与首页同款的 SgVirtualList，
 *   滚动本页面即驱动虚拟区间重算（16ms 节流），实时展示可视节点 / 区间序列化字节。
 *   数据在内存生成，不写快照、不入同步队列、不碰云端（压测不污染数据流）。
 * - 下方统计卡读取 `utils/perf` 本地聚合：T1 / setData 数据量 / 接口 TOP5 / 错误 / 压缩。
 * - 压测工具：灌 5000 条本地快照（sl:records:cache，供未连云端时验证首页快照直出）。
 */
import { computed, ref, watch } from 'vue';
import { onPageScroll, onShow } from '@dcloudio/uni-app';
import { snapshot as perfSnapshot, type PerfStats } from '@/utils/perf';
import { serializedBytes } from '@/components/VirtualList/virtual';
import { saveSnapshot, loadSnapshot } from '@/services/sync/snapshot';
import { fenToYuan } from '@/utils/format';
import type { LedgerRecord } from '@/types/model';

const stats = ref<PerfStats>(perfSnapshot());
const errorCount = computed(() => stats.value.errors.reduce((s, e) => s + e.count, 0));
const compressLabel = computed(() =>
  stats.value.compress
    ? `${fmtBytes(stats.value.compress.bytesIn)} → ${fmtBytes(stats.value.compress.bytesOut)}，${stats.value.compress.ms} ms`
    : '—'
);

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

onShow(() => {
  // 统计卡每次进入页面刷新；压测沙箱指标由 watch(stressVlist / scrollTop) 维护
  stats.value = perfSnapshot();
});

/* ── 虚拟列表压测沙箱 ── */

/** 压测行高（px），与首页 ROW_HEIGHT 一致，保证区间计算可比。 */
const STRESS_ROW_H = 64;

/** 压测数据：5000 条合成账单（内存生成，不碰快照/队列/云端）。 */
function createStressItems(): LedgerRecord[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const cats = ['food', 'transport', 'shopping', 'entertainment', 'other'];
  const list: LedgerRecord[] = [];
  for (let i = 0; i < 5000; i += 1) {
    list.push({
      clientId: `stress-${i}`,
      type: i % 4 === 0 ? 'income' : 'expense',
      amount: 500 + ((i * 37) % 9500),
      categoryId: cats[i % cats.length],
      merchant: `压测商家 ${i}`,
      happenedAt: now - (i % 30) * day - (i % 86400000),
      source: 'manual',
      version: 1,
      deleted: false,
    });
  }
  return list;
}
const stressItems = ref<LedgerRecord[]>(createStressItems());

const rowKey = (_item: unknown, index: number) => String(index);

/** 滚动位置（px，onPageScroll 节流 16ms 后写入，驱动虚拟区间重算）。 */
const scrollTop = ref(0);
let lastScrollAt = 0;
onPageScroll((e) => {
  const now = Date.now();
  if (now - lastScrollAt < 16) return;
  lastScrollAt = now;
  scrollTop.value = e.scrollTop;
});

/** 组件暴露的可视区间指标（defineExpose 的 computed 经模板 ref 访问时自动解包）。 */
const stressVlist = ref<{
  visibleCount: number;
  range: { start: number; end: number };
  totalHeightPx: number;
  virtualized: boolean;
} | null>(null);

const visibleCount = ref(0);
const totalHeightPx = ref(0);
const virtualized = ref(false);
const currentBytes = ref(0);

/** 读取组件当前可视区间指标（组件挂载/滚动节流后调用）。 */
function readStress(): void {
  const vl = stressVlist.value;
  if (!vl) return;
  visibleCount.value = vl.visibleCount;
  totalHeightPx.value = vl.totalHeightPx;
  virtualized.value = vl.virtualized;
  const { start, end } = vl.range;
  currentBytes.value = serializedBytes(stressItems.value.slice(start, end));
}

// 组件挂载后 ref 才有值：监听赋值（而非 onShow 时读取，onShow 早于组件挂载）
watch(stressVlist, () => readStress(), { flush: 'post' });
watch(scrollTop, () => readStress());

/* ── 压测工具（灌快照，供首页快照直出场景验证） ── */

/** 灌 5000 条本月账单快照（压测虚拟列表；不碰服务端）。 */
function onSeed(): void {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const cats = ['food', 'transport', 'shopping', 'entertainment', 'other'];
  const records: LedgerRecord[] = [];
  for (let i = 0; i < 5000; i += 1) {
    records.push({
      clientId: `seed-${i}`,
      type: 'expense',
      amount: 500 + ((i * 37) % 9500),
      categoryId: cats[i % cats.length],
      merchant: `压测商家 ${i}`,
      happenedAt: now - (i % 30) * day - (i % 86400000),
      source: 'manual',
      version: 1,
      deleted: false,
    });
  }
  saveSnapshot(records);
  uni.showToast({ title: `已灌 ${records.length} 条，回首页查看`, icon: 'none' });
}

/** 清空压测数据（回到真实快照） */
function onClearSeed(): void {
  saveSnapshot(loadSnapshot().filter((r) => !r.clientId.startsWith('seed-')));
  uni.showToast({ title: '已清空压测数据', icon: 'none' });
}

function onRefresh(): void {
  stats.value = perfSnapshot();
  readStress();
}
</script>

<style lang="scss">
@import '../../styles/tokens';

.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: $sp-5 $sp-4 $sp-8;
  background-color: $color-bg-base;
}

.card {
  padding: 0 $sp-4;
  margin-bottom: $sp-4;
  background-color: $color-bg-surface;
  border-radius: $r-lg;
  box-shadow: $sh-1;

  &__title {
    padding: $sp-4 0 $sp-2;
    font-size: $fs-caption;
    font-weight: $font-weight-medium;
    color: $color-text-secondary;
  }
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: 88rpx;

  &__label {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }

  &__value {
    font-size: $fs-caption;
    color: $color-text-primary;
  }

  &__arrow {
    font-size: $fs-h2;
    color: $color-text-tertiary;
  }
}

/* 压测沙箱画布：页面滚动模式，行由组件绝对定位 */
.stress {
  margin: 0 (-$sp-4);
  padding: 0 $sp-4 $sp-4;

  &__row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: $sp-3;
    box-sizing: border-box;
    padding: 0 $sp-2;
    border-bottom: 1rpx solid $color-line;
  }

  &__idx {
    width: 96rpx;
    font-size: $fs-tiny;
    color: $color-text-tertiary;
  }

  &__label {
    flex: 1;
    overflow: hidden;
    font-size: $fs-caption;
    color: $color-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__amount {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }
}

.list {
  padding-bottom: $sp-3;

  &__row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: $sp-2 0;
  }

  &__name {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }

  &__value {
    font-size: $fs-caption;
    color: $color-text-primary;
  }
}

.empty {
  display: block;
  padding-bottom: $sp-4;
  font-size: $fs-caption;
  color: $color-text-tertiary;
}
</style>
