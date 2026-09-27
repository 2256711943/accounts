<template>
  <view class="sg-skeleton" :class="`sg-skeleton--${normalizeSkeletonType(type)}`">
    <!-- line：单条骨架线（首页总支出等） -->
    <template v-if="type === 'line'">
      <view
        v-for="i in rowCount"
        :key="i"
        class="sg-skeleton__line"
        :class="`sg-skeleton__line--${i === rowCount ? 'short' : 'full'}`"
      />
    </template>

    <!-- card：整卡骨架（详情页） -->
    <view v-else-if="type === 'card'" class="sg-skeleton__card">
      <view class="sg-skeleton__avatar" />
      <view class="sg-skeleton__card-body">
        <view class="sg-skeleton__line sg-skeleton__line--full" />
        <view class="sg-skeleton__line sg-skeleton__line--short" />
      </view>
    </view>

    <!-- list：列表骨架（首页列表 / 统计明细） -->
    <view v-else class="sg-skeleton__list">
      <view
        v-for="i in rowCount"
        :key="i"
        class="sg-skeleton__item"
      >
        <view class="sg-skeleton__avatar" />
        <view class="sg-skeleton__item-body">
          <view class="sg-skeleton__line sg-skeleton__line--full" />
          <view class="sg-skeleton__line sg-skeleton__line--half" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { normalizeSkeletonType, type SgSkeletonType } from '../presets';

const props = withDefaults(
  defineProps<{
    /** line 单条 / card 整卡 / list 列表 */
    type?: SgSkeletonType;
    /** line 与 list 模式的重复行数（默认 3） */
    rows?: number;
  }>(),
  { type: 'line', rows: 3 }
);

/** 行数夹在 1~8，避免非法 prop 撑爆页面 */
const rowCount = Math.min(Math.max(props.rows, 1), 8);
</script>

<style lang="scss">
.sg-skeleton {
  width: 100%;

  &__line {
    position: relative;
    height: 32rpx;
    overflow: hidden;
    background-color: $color-bg-subtle;
    border-radius: $r-sm;

    &--full {
      width: 100%;
    }

    /* 80% 宽短行：用于标题下第二行 */
    &--short {
      width: 80%;
    }

    /* 60% 宽：列表右侧时间位 */
    &--half {
      width: 60%;
    }

    /* shimmer 扫光：透明 → 半透明白 → 透明，只动 translateX */
    &::after {
      position: absolute;
      inset: 0;
      background: linear-gradient(100deg, transparent, rgba($color-bg-surface, 0.55), transparent);
      content: '';
      animation: sg-skeleton-shimmer 1.6s $ease-std infinite;
    }
  }

  &__card {
    display: flex;
    gap: $sp-3;
    padding: $sp-4;
    background-color: $color-bg-surface;
    border-radius: $r-lg;
    box-shadow: $sh-1;
  }

  &__card-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $sp-3;
  }

  &__list {
    display: flex;
    flex-direction: column;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: $sp-3;
    min-height: 88rpx;
    padding: $sp-3 $sp-4;

    + .sg-skeleton__item {
      border-top: 1rpx solid $color-line;
    }
  }

  &__item-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $sp-2;
  }

  &__avatar {
    width: 80rpx;
    height: 80rpx;
    background-color: $color-bg-subtle;
    border-radius: $r-full;
  }
}

@keyframes sg-skeleton-shimmer {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(100%);
  }
}
</style>
