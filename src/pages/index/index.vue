<template>
  <view class="page">
    <view class="brand">
      <text class="brand__name">一拍记</text>
      <text class="brand__sub">SnapLedger · 拍照记账 · 双端自检</text>
    </view>

    <view class="card">
      <text class="card__title">D1 脚手架自检</text>

      <view class="row">
        <view class="dot" />
        <text class="row__label">Design Token 管线：SCSS 变量 + CSS 自定义属性</text>
      </view>

      <view class="row">
        <view class="dot dot--success" />
        <text class="row__label">easycom：下方按钮来自 wot-design-uni（此时仍是默认蓝紫，D3 做主题映射）</text>
      </view>
    </view>

    <wd-button type="primary" @click="onCheck">组件库可用</wd-button>
  </view>
</template>

<script setup lang="ts">
/**
 * D1 占位首页 —— 只用于验证双端脚手架与组件库，D5 会换成真正的账单首页。
 */
function onCheck() {
  uni.showToast({ title: 'wot-design-uni 已接入', icon: 'none' });
}
</script>

<style lang="scss">
/* 页面级 import：D3 会把 tokens.scss 注入 uni.scss，届时这一行可以去掉 */
@import '../../styles/tokens';

.page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: $sp-6;
  min-height: 100vh;
  padding: $sp-8 $sp-4;
  background-color: $color-bg-base;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: $sp-1;

  &__name {
    font-size: $fs-display;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__sub {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }
}

.card {
  display: flex;
  flex-direction: column;
  gap: $sp-3;
  padding: $sp-4;
  background-color: $color-bg-surface;
  border-radius: $r-lg;
  box-shadow: $sh-1;

  &__title {
    font-size: $fs-h2;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;

  &__label {
    flex: 1;
    font-size: $fs-caption;
    color: $color-text-secondary;
  }
}

.dot {
  width: 16rpx;
  height: 16rpx;

  /* 用 CSS 自定义属性形态，验证 App.vue 里的 sg-css-vars 已生效 */
  background-color: var(--color-accent);
  border-radius: $r-full;

  &--success {
    background-color: var(--color-success);
  }
}
</style>
