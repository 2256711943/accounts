<template>
  <view
    class="sg-cell"
    :class="{ 'sg-cell--clickable': isClickable }"
    hover-class="sg-cell--hover"
    :hover-stay-time="80"
    @tap="onTap"
  >
    <slot name="icon" />
    <text v-if="label" class="sg-cell__label">{{ label }}</text>
    <view class="sg-cell__spacer" />
    <text v-if="value" class="sg-cell__value">{{ value }}</text>
    <view v-if="arrow" class="sg-cell__arrow" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 左侧 label（--fs-body） */
    label?: string;
    /** 右侧 value（次要色） */
    value?: string;
    /** 右侧箭头；会同时让整行可点 */
    arrow?: boolean;
    /** 显式声明可点击 */
    clickable?: boolean;
  }>(),
  { label: '', value: '', arrow: false, clickable: false }
);

const emit = defineEmits<{ (e: 'click'): void }>();

const isClickable = computed(() => props.clickable || props.arrow);

function onTap() {
  if (isClickable.value) emit('click');
}
</script>

<style lang="scss">
.sg-cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  min-height: 88rpx;
  padding: 0 $sp-4;
  background-color: $color-bg-surface;
  border-radius: $r-md;

  &--clickable.sg-cell--hover {
    background-color: $color-bg-subtle;
  }

  &__label {
    font-size: $fs-body;
    color: $color-text-primary;
  }

  &__spacer {
    flex: 1;
  }

  &__value {
    margin-left: $sp-2;
    font-size: $fs-body;
    color: $color-text-secondary;
  }

  &__arrow {
    width: 16rpx;
    height: 16rpx;
    margin-left: $sp-2;
    border-top: 2rpx solid $color-text-tertiary;
    border-right: 2rpx solid $color-text-tertiary;
    transform: rotate(45deg);
  }
}
</style>
