<template>
  <button
    class="sg-btn"
    :class="[`sg-btn--${normalizeButtonType(type)}`, `sg-btn--${normalizeButtonSize(size)}`, { 'sg-btn--disabled': disabled || loading }]"
    :disabled="disabled || loading"
    hover-class="sg-btn--hover"
    :hover-stay-time="80"
    @click="onClick"
  >
    <view v-if="loading" class="sg-btn__spinner" />
    <text v-else-if="label" class="sg-btn__label">{{ label }}</text>
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
import { normalizeButtonSize, normalizeButtonType, type SgButtonSize, type SgButtonType } from '../presets';

const props = withDefaults(
  defineProps<{
    /** primary / ghost / text / danger */
    type?: SgButtonType;
    /** lg 88rpx / md 72rpx / sm 56rpx */
    size?: SgButtonSize;
    /** 内置 loading 态：展示旋转指示并屏蔽点击 */
    loading?: boolean;
    disabled?: boolean;
    /** 按钮文字；不传时走默认插槽 */
    label?: string;
  }>(),
  { type: 'primary', size: 'md', loading: false, disabled: false, label: '' }
);

const emit = defineEmits<{ (e: 'click'): void }>();

function onClick() {
  if (props.loading || props.disabled) return;
  emit('click');
}
</script>

<style lang="scss">
.sg-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 #{$sp-6};
  margin: 0;
  font-family: $font-family-sans;
  font-weight: $font-weight-medium;
  line-height: 1;
  color: $color-text-inverse;
  background-color: $color-accent;
  border: none;
  border-radius: $r-full;
  transition:
    transform 120ms $ease-std,
    opacity 120ms $ease-std;

  /* 去掉 uni-app button 默认的 ::after 发丝边框 */
  &::after {
    border: none;
  }

  &--hover {
    transform: scale(0.98);
  }

  /* 按压态再加深主色（primary 专属） */
  &--primary.sg-btn--hover {
    background-color: $color-accent-pressed;
  }

  &--disabled {
    opacity: 0.5;
  }

  &--loading {
    opacity: 0.75;
  }

  &--lg {
    height: 88rpx;
    font-size: $fs-h2;
  }

  &--md {
    height: 72rpx;
    font-size: $fs-body;
  }

  &--sm {
    height: 56rpx;
    padding: 0 #{$sp-4};
    font-size: $fs-caption;
  }

  &--ghost {
    color: $color-accent;
    background-color: transparent;
    border: 1rpx solid $color-accent;
  }

  &--text {
    color: $color-accent;
    background-color: transparent;
  }

  &--danger {
    background-color: $color-danger;
  }

  &__label {
    line-height: inherit;
  }

  &__spinner {
    width: 32rpx;
    height: 32rpx;
    border: 4rpx solid currentcolor;
    border-top-color: transparent;
    border-radius: $r-full;
    animation: sg-btn-spin 0.8s linear infinite;
  }
}

@keyframes sg-btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
