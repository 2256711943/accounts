<template>
  <view class="card">
    <!-- 降级琥珀条：识别走了降级路径/置信不足时提示核对 -->
    <view v-if="showDegraded" class="card__amber">
      <text class="card__amber-text">识别置信度较低，请核对下列字段后再保存</text>
    </view>

    <!-- 金额（元） -->
    <view class="card__field">
      <text class="card__label">金额</text>
      <view class="card__amount">
        <text class="card__currency">¥</text>
        <input
          class="card__amount-input"
          type="digit"
          :value="amountYuan"
          placeholder="0.00"
          @input="onAmountInput"
        />
      </view>
    </view>

    <!-- 商户 -->
    <view class="card__field">
      <text class="card__label">商户</text>
      <input class="card__input" :value="merchant" placeholder="（可选）" @input="onMerchantInput" />
    </view>

    <!-- 分类 -->
    <view class="card__field card__field--block">
      <text class="card__label">分类</text>
      <view class="card__cats">
        <view
          v-for="c in categories"
          :key="c.key"
          class="card__cat"
          :class="{ 'card__cat--on': c.key === categoryKey }"
          @click="categoryKey = c.key"
        >
          <text>{{ c.icon }}</text>
          <text class="card__cat-name">{{ c.name }}</text>
        </view>
      </view>
    </view>

    <!-- 时间 -->
    <view class="card__field">
      <text class="card__label">时间</text>
      <picker mode="date" :value="dateStr" @change="onDateChange">
        <view class="card__input card__input--picker">{{ dateStr }}</view>
      </picker>
    </view>

    <!-- 操作 -->
    <view class="card__actions">
      <button class="card__btn card__btn--ghost" @tap="emit('cancel')">取消</button>
      <button class="card__btn card__btn--primary" @tap="onConfirm">确认记账</button>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 识别结果确认卡（D8 交付物）。props 接收识别候选，字段可编辑，确认时把组装好的
 * 记账载荷（单位分 / 分类 key / 时间）向上 emit。`degraded` 时展示琥珀条。
 *
 * 业务组件规则（AGENTS）：不发请求、不读全局 store，严格 props in / emit out。
 */
import { computed, ref } from 'vue';
import { CATEGORIES } from '@/services/recognize/categories';
import type { RecognizeCandidate } from '@/services/recognize/orchestrator';

const props = defineProps<{ result: RecognizeCandidate }>();
const emit = defineEmits<{
  (e: 'confirm', payload: { amountFen: number; merchant?: string; categoryKey: string; happenedAt: number }): void;
  (e: 'cancel'): void;
}>();

const categories = CATEGORIES;

// ---- 可编辑字段（从识别结果预填） ----
const amountYuan = ref(props.result.amount != null ? (props.result.amount / 100).toFixed(2) : '');
const merchant = ref(props.result.merchant ?? '');
const categoryKey = ref(props.result.categoryKey ?? 'other');
const dateStr = ref(todayStr());

const showDegraded = computed(() => !!props.result.degraded || (props.result.confidence ?? 0) < 0.5);

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// uni-app `<input>` 的事件类型与 DOM InputEvent 冲突（vue-tsc 按 DOM 原生 input 推断），
// 但运行时两端都是 `e.detail.value`。用 `unknown` + 窄化，避免显式 any 与类型纠纷。
function onAmountInput(e: unknown): void {
  amountYuan.value = (e as { detail?: { value?: string } }).detail?.value ?? '';
}
function onMerchantInput(e: unknown): void {
  merchant.value = (e as { detail?: { value?: string } }).detail?.value ?? '';
}
function onDateChange(e: { detail: { value: string } }): void {
  dateStr.value = e.detail.value;
}

function onConfirm(): void {
  const yuan = Number(amountYuan.value);
  if (!Number.isFinite(yuan) || yuan <= 0) {
    // 金额必填：轻提示（native uni 接口，组件内可用；非 wd-toast）
    uni.showToast({ title: '请填写有效金额', icon: 'none' });
    return;
  }
  const happenedAt = new Date(`${dateStr.value}T00:00:00`).getTime();
  emit('confirm', {
    amountFen: Math.round(yuan * 100),
    merchant: merchant.value.trim() || undefined,
    categoryKey: categoryKey.value,
    happenedAt,
  });
}
</script>

<style lang="scss">
@import '../../styles/tokens';

.card {
  padding: $sp-4;
  background: $color-bg-surface;
  border-radius: $r-lg;

  &__amber {
    padding: $sp-3 $sp-3;
    margin-bottom: $sp-3;
    background: rgb(240 163 43 / 12%);
    border-radius: $r-md;
    border: 1rpx solid rgb(240 163 43 / 40%);

    &-text {
      font-size: $fs-caption;
      color: $color-warning;
    }
  }

  &__field {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: $sp-3 0;
    border-bottom: 1rpx solid $color-line;

    &--block {
      flex-direction: column;
      align-items: flex-start;
      gap: $sp-3;
    }
  }

  &__label {
    width: 120rpx;
    font-size: $fs-body;
    color: $color-text-secondary;
  }

  &__amount {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    gap: $sp-1;

    &-input {
      flex: 1;
      font-size: $fs-h1;
      font-weight: $font-weight-medium;
      color: $color-accent;
    }
  }

  &__currency {
    font-size: $fs-h1;
    color: $color-text-tertiary;
  }

  &__input {
    flex: 1;
    font-size: $fs-body;
    color: $color-text-primary;

    &--picker {
      padding: $sp-2 0;
    }
  }

  &__cats {
    display: flex;
    flex-flow: row wrap;
    gap: $sp-2;
  }

  &__cat {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: $sp-1;
    padding: $sp-1 $sp-3;
    border: 1rpx solid $color-line;
    border-radius: $r-full;

    &--on {
      border-color: $color-accent;
      background: rgb(47 128 237 / 8%);
    }

    &-name {
      font-size: $fs-caption;
      color: $color-text-primary;
    }
  }

  &__actions {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    gap: $sp-3;
    margin-top: $sp-5;
  }

  &__btn {
    flex: 1;
    height: 88rpx;
    line-height: 88rpx;
    border-radius: $r-md;
    font-size: $fs-body;

    &--ghost {
      border: 1rpx solid $color-line;
      color: $color-text-primary;
      background: transparent;
    }

    &--primary {
      color: $color-bg-base;
      background: $color-accent;
    }
  }
}
</style>