<template>
  <view class="sg-card" :class="`sg-card--${normalizeCardType(type)}`">
    <slot />
  </view>
</template>

<script setup lang="ts">
import { normalizeCardType, type SgCardType } from '../presets';

withDefaults(
  defineProps<{
    /** flat 无投影 / elevated 用 --sh-1 */
    type?: SgCardType;
  }>(),
  { type: 'flat' }
);
</script>

<style lang="scss">
.sg-card {
  padding: $sp-4;
  background-color: $color-bg-surface;
  border-radius: $r-lg;

  &--elevated {
    box-shadow: $sh-1;
  }
}
</style>
