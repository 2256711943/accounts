<template>
  <view class="sg-tag" :class="[`sg-tag--${normalizeTagVariant(variant)}`, `sg-tag--${normalizeTagColor(color)}`]">
    <text v-if="label" class="sg-tag__label">{{ label }}</text>
    <slot v-else />
  </view>
</template>

<script setup lang="ts">
import { normalizeTagColor, normalizeTagVariant, type SgTagColor, type SgTagVariant } from '../presets';

withDefaults(
  defineProps<{
    label?: string;
    /** soft 浅底 / outline 描边 */
    variant?: SgTagVariant;
    /** primary / success / warning / danger / info */
    color?: SgTagColor;
  }>(),
  { label: '', variant: 'soft', color: 'primary' }
);
</script>

<style lang="scss">
.sg-tag {
  display: inline-flex;
  align-items: center;
  padding: $sp-1 $sp-2;
  font-size: $fs-tiny;
  font-weight: $font-weight-medium;
  line-height: 1.3;
  border-radius: $r-sm;

  &__label {
    line-height: inherit;
  }

  /* soft：浅底 + 语义色文字 */
  &--soft {
    color: $color-text-secondary;
    background-color: $color-bg-subtle;
  }

  &--soft.sg-tag--primary {
    color: $color-accent;
    background-color: $color-accent-soft;
  }

  &--soft.sg-tag--success {
    color: $color-success;
  }

  &--soft.sg-tag--warning {
    color: $color-warning;
  }

  &--soft.sg-tag--danger {
    color: $color-danger;
  }

  &--soft.sg-tag--info {
    color: $color-info;
  }

  /* outline：透明底 + 1rpx 描边 + 语义色文字 */
  &--outline {
    color: $color-text-secondary;
    background-color: transparent;
    border: 1rpx solid $color-line-strong;
  }

  &--outline.sg-tag--primary {
    color: $color-accent;
    border-color: $color-accent;
  }

  &--outline.sg-tag--success {
    color: $color-success;
    border-color: $color-success;
  }

  &--outline.sg-tag--warning {
    color: $color-warning;
    border-color: $color-warning;
  }

  &--outline.sg-tag--danger {
    color: $color-danger;
    border-color: $color-danger;
  }

  &--outline.sg-tag--info {
    color: $color-info;
    border-color: $color-info;
  }
}
</style>
