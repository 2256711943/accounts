<template>
  <view class="sg-empty">
    <text class="sg-empty__emoji">{{ preset.emoji }}</text>
    <text class="sg-empty__title">{{ title || preset.title }}</text>
    <text v-if="desc || preset.desc" class="sg-empty__desc">{{ desc || preset.desc }}</text>
    <view
      v-if="actionText"
      class="sg-empty__action"
      :hover-class="'sg-empty__action--hover'"
      @click="emit('action')"
    >
      {{ actionText }}
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { emptyPreset, normalizeEmptyType, type SgEmptyType } from '../presets';

const props = withDefaults(
  defineProps<{
    /** no-data / no-network / error */
    type?: SgEmptyType;
    /** 覆盖预设标题 */
    title?: string;
    /** 覆盖预设描述 */
    desc?: string;
    /** 主操作按钮文案；不传则不渲染按钮 */
    actionText?: string;
  }>(),
  { type: 'no-data', title: '', desc: '', actionText: '' }
);

const emit = defineEmits<{ (e: 'action'): void }>();

/** 预设文案见 presets.emptyPreset；页面可经 title/desc 覆盖 */
const preset = computed(() => emptyPreset(normalizeEmptyType(props.type)));
</script>

<style lang="scss">
.sg-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $sp-8 $sp-4;

  &__emoji {
    margin-bottom: $sp-4;
    font-size: 96rpx;
    line-height: 1;
  }

  &__title {
    margin-bottom: $sp-2;
    font-size: $fs-h2;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__desc {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }

  &__action {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 72rpx;
    margin-top: $sp-6;
    padding: 0 $sp-8;
    font-size: $fs-body;
    font-weight: $font-weight-medium;
    color: $color-text-inverse;
    background-color: $color-accent;
    border-radius: $r-full;
    transition: transform 120ms $ease-std;
  }

  &__action--hover {
    transform: scale(0.98);
  }
}
</style>
