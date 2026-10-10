<template>
  <view class="page">
    <!-- 类型切换：支出 / 收入 -->
    <view class="type">
      <view
        class="type__item"
        :class="{ 'type__item--active': type === 'expense' }"
        @tap="onType('expense')"
      >支出</view>
      <view
        class="type__item"
        :class="{ 'type__item--active': type === 'income' }"
        @tap="onType('income')"
      >收入</view>
    </view>

    <!-- 金额（分 → 元，失焦即存） -->
    <view class="field">
      <text class="field__label">金额（元）</text>
      <input
        class="field__input"
        type="digit"
        :value="amountYuan"
        placeholder="0.00"
        placeholder-class="field__ph"
        @blur="(e) => onAmountInput(e)"
      />
    </view>

    <!-- 商户名 -->
    <view class="field">
      <text class="field__label">商户</text>
      <input
        class="field__input"
        :value="merchant"
        placeholder="选填"
        placeholder-class="field__ph"
        @blur="(e) => onMerchantInput(e)"
      />
    </view>

    <!-- 分类（picker 选择完成即存） -->
    <view class="field">
      <text class="field__label">分类</text>
      <picker mode="selector" :range="CATEGORIES" range-key="name" :value="catIndex" @change="onCategory">
        <view class="field__select">
          <text>{{ catName }}</text>
          <text class="field__arrow">›</text>
        </view>
      </picker>
    </view>

    <!-- 日期 -->
    <view class="field">
      <text class="field__label">日期</text>
      <picker mode="date" :value="dateYmd" @change="onDate">
        <view class="field__select">
          <text>{{ dateYmd }}</text>
          <text class="field__arrow">›</text>
        </view>
      </picker>
    </view>

    <!-- 识别元信息 -->
    <view v-if="rec && rec.recognizeMeta" class="meta">
      <text class="meta__text">
        识别引擎：{{ rec.recognizeMeta.engine }}（置信 {{ (rec.recognizeMeta.confidence * 100).toFixed(0) }}%）
      </text>
    </view>

    <!-- 删除（二次确认走 Feedback 的 wd-message-box） -->
    <view class="danger" @tap="onDelete">
      <text class="danger__text">删除这笔账</text>
    </view>

    <Feedback ref="feedbackRef" />
  </view>
</template>

<script setup lang="ts">
/**
 * D9 详情页（普通分包 `pages-detail`）——「修改即保存」。
 *
 * - 首页经事件通道把初始记录透传过来（避免按 clientId 单独再拉一次，也没有单查接口）。
 * - 字段改动即写：`record.upsert` op:'update' + `baseVersion`（乐观并发，冲突交由服务端 LWW）。
 * - 删除：`record.remove`，前置 `wd-message-box` 二次确认（唯一宿主 Feedback 组件）。
 */
import { computed, getCurrentInstance, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { call } from '@/api/client';
import { CATEGORIES } from '@/services/recognize/categories';
import Feedback from '@/components/biz/Feedback.vue';
import type { LedgerRecord } from '@/types/model';
import type { RecordType } from '@/types/model';

interface EventChannel {
  on(evt: string, cb: (payload: unknown) => void): void;
}

const feedbackRef = ref<InstanceType<typeof Feedback> | null>(null);

const rec = ref<LedgerRecord | null>(null);
const saving = ref(false);
const amountYuan = ref('');
const merchant = ref('');
const type = ref<RecordType>('expense');
const dateYmd = ref('');
const catIndex = ref(0);

function ymd(ts: number | undefined): string {
  const d = new Date(ts ?? Date.now());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function apply(r: LedgerRecord): void {
  rec.value = r;
  amountYuan.value = r.amount >= 0 ? (r.amount / 100).toFixed(2) : '';
  merchant.value = r.merchant ?? '';
  type.value = r.type ?? 'expense';
  dateYmd.value = ymd(r.happenedAt);
  catIndex.value = Math.max(0, CATEGORIES.findIndex((c) => c.key === r.categoryId));
}
const catName = computed(() => CATEGORIES[catIndex.value]?.name ?? '未分类');

/** 统一保存：字段级 patch → upsert(update)，冲突交给服务端已返回的文档 LWW。 */
async function save(patch: Partial<LedgerRecord>): Promise<void> {
  const r = rec.value;
  if (!r || saving.value) return;
  saving.value = true;
  try {
    const res = await call('record.upsert', {
      clientId: r.clientId,
      op: 'update',
      baseVersion: r.version ?? 0,
      payload: patch,
    });
    rec.value = res.record;
    // 若冲突（服务端版本更新），以服务端文档为准整字段回写
    if (res.conflict) {
      apply(res.record);
    }
    feedbackRef.value?.toast.show('已保存');
  } catch (err) {
    feedbackRef.value?.toast.show(err instanceof Error ? err.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

function toFen(yuan: string): number | undefined {
  const n = Number.parseFloat(yuan);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100);
}

function onAmountInput(e: unknown): void {
  const value = (e as { detail?: { value?: string } }).detail?.value ?? '';
  amountYuan.value = value;
  const fen = toFen(value);
  if (fen) void save({ amount: fen });
}
function onMerchantInput(e: unknown): void {
  const value = (e as { detail?: { value?: string } }).detail?.value ?? '';
  merchant.value = value;
  void save({ merchant: value });
}
function onType(t: RecordType): void {
  if (type.value === t) return;
  type.value = t;
  void save({ type: t });
}
function onCategory(e: { detail: { value: number } }): void {
  const idx = Number(e.detail.value);
  catIndex.value = idx;
  void save({ categoryId: CATEGORIES[idx]?.key });
}
function onDate(e: { detail: { value: string } }): void {
  dateYmd.value = e.detail.value;
  const ts = new Date(e.detail.value).getTime();
  if (Number.isFinite(ts)) void save({ happenedAt: ts });
}

function onDelete(): void {
  feedbackRef.value?.message
    .confirm({ title: '删除这笔账', msg: '删除后不可恢复', confirmButtonText: '删除' })
    .then((res) => {
      if (!(res as { confirm?: boolean }).confirm || !rec.value) return;
      void remove();
    })
    .catch(() => undefined);
}
async function remove(): Promise<void> {
  const r = rec.value;
  if (!r) return;
  try {
    await call('record.remove', { clientId: r.clientId });
    feedbackRef.value?.toast.show('已删除');
    setTimeout(() => uni.navigateBack(), 500);
  } catch (err) {
    feedbackRef.value?.toast.show(err instanceof Error ? err.message : '删除失败');
  }
}

onLoad(() => {
  const proxy = getCurrentInstance()?.proxy as { getOpenerEventChannel?: () => EventChannel };
  const ec = proxy?.getOpenerEventChannel?.();
  if (ec?.on) {
    ec.on('init', (payload) => apply(payload as LedgerRecord));
  }
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

.type {
  display: flex;
  flex-direction: row;
  gap: $sp-3;

  &__item {
    flex: 1;
    padding: $sp-3;
    text-align: center;
    font-size: $fs-body;
    color: $color-text-secondary;
    background-color: $color-bg-surface;
    border-radius: $r-md;

    &--active {
      color: $color-accent;
      background-color: $color-accent-soft;
    }
  }
}

.field {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: $sp-4;
  margin-top: $sp-3;
  background-color: $color-bg-surface;
  border-radius: $r-md;

  &__label {
    font-size: $fs-body;
    color: $color-text-secondary;
  }

  &__input {
    flex: 1;
    margin-left: $sp-4;
    font-size: $fs-h2;
    color: $color-text-primary;
    text-align: right;
  }

  &__ph {
    color: $color-text-tertiary;
  }

  &__select {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: $sp-2;
    font-size: $fs-body;
    color: $color-text-primary;
  }

  &__arrow {
    color: $color-text-tertiary;
  }
}

.meta {
  padding: $sp-3 $sp-4;
  margin-top: $sp-3;

  &__text {
    font-size: $fs-caption;
    color: $color-text-tertiary;
  }
}

.danger {
  padding: $sp-4;
  margin-top: $sp-6;
  text-align: center;
  background-color: $color-bg-surface;
  border-radius: $r-md;

  &__text {
    font-size: $fs-body;
    color: $color-danger;
  }
}
</style>