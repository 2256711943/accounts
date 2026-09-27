<template>
  <view
    class="sg-avatar"
    :class="`sg-avatar--${normalizeAvatarSize(size)}`"
    :style="bgStyle"
  >
    <image v-if="src" class="sg-avatar__img" :src="src" mode="aspectFill" />
    <text v-else-if="text" class="sg-avatar__text" :style="textStyle">{{ text }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { normalizeAvatarSize, type SgAvatarSize } from '../presets';

const props = withDefaults(
  defineProps<{
    /** md 80rpx / sm 56rpx */
    size?: SgAvatarSize;
    /** 图片地址；有图优先渲染图 */
    src?: string;
    /** 无图时显示的首字（分类图标等） */
    text?: string;
    /** 底色（分类色来自数据、非 token，故走 prop 透传） */
    bgColor?: string;
    /** 文字色；缺省用样式里的 token 默认值 */
    textColor?: string;
  }>(),
  { size: 'md', src: '', text: '', bgColor: '', textColor: '' }
);

/** 仅在有值时才注入内联样式，缺省颜色由 CSS token 兜底（避免代码写死色值） */
const bgStyle = computed(() => (props.bgColor ? { backgroundColor: props.bgColor } : undefined));
const textStyle = computed(() => (props.textColor ? { color: props.textColor } : undefined));
</script>

<style lang="scss">
.sg-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: $color-bg-subtle;
  border-radius: $r-full;

  &--md {
    width: 80rpx;
    height: 80rpx;
  }

  &--sm {
    width: 56rpx;
    height: 56rpx;
  }

  &__img {
    width: 100%;
    height: 100%;
  }

  &__text {
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &--md &__text {
    font-size: $fs-body;
  }

  &--sm &__text {
    font-size: $fs-caption;
  }
}
</style>
