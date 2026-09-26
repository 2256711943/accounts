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

    <view class="card">
      <text class="card__title">数据通道自检</text>

      <view class="row">
        <view class="dot" :class="dotModifier" />
        <text class="row__label">{{ channelText }}</text>
      </view>
    </view>

    <wd-button type="primary" @click="onCheck">组件库可用</wd-button>
    <wd-button :loading="pending" @click="onCheckChannel">数据通道自检</wd-button>
  </view>
</template>

<script setup lang="ts">
/**
 * D1 占位首页 —— 只用于验证双端脚手架、组件库与数据通道，D5 会换成真正的账单首页。
 */
import { computed, ref } from 'vue';
import { ApiCallError, call } from '@/api/client';

function onCheck() {
  uni.showToast({ title: 'wot-design-uni 已接入', icon: 'none' });
}

type ChannelStatus = 'idle' | 'pending' | 'ok' | 'fail';

const status = ref<ChannelStatus>('idle');
const detail = ref('');

const pending = computed(() => status.value === 'pending');

const dotModifier = computed(() => {
  if (status.value === 'ok') return 'dot--success';
  if (status.value === 'fail') return 'dot--fail';
  return '';
});

const channelText = computed(() => {
  switch (status.value) {
    case 'pending':
      return '检测中…';
    case 'ok':
      return `通道已打通。${detail.value}`;
    case 'fail':
      return `通道失败：${detail.value}`;
    default:
      return '未检测：点下方按钮验证「页面 → api/client → adapters/cloud → 云函数」整条链路。';
  }
});

/**
 * 数据通道自检。
 *
 * 故意调 `record.list` —— §6 已定义但 D4 才实现。此时**预期**拿到 `UNKNOWN_ACTION`：
 * 能拿到这个业务错误码本身就证明链路是通的（请求到了云函数、信封被正确解析）。
 * 若拿到 `NETWORK` 错误，才是真正的通道问题（SDK 未初始化 / 域名不通 / 路由未配）。
 */
async function onCheckChannel() {
  status.value = 'pending';
  detail.value = '';
  try {
    await call('record.list', { limit: 1 });
    // 走到这里说明 record.list 已实现（D4 之后）
    status.value = 'ok';
    detail.value = 'record.list 已返回数据。';
  } catch (err) {
    if (err instanceof ApiCallError && err.code === 'UNKNOWN_ACTION') {
      status.value = 'ok';
      detail.value = '云函数返回 UNKNOWN_ACTION（record.list 待 D4 实现），链路正常。';
      return;
    }
    status.value = 'fail';
    detail.value = err instanceof ApiCallError ? `${err.code} — ${err.message}` : String(err);
  }
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

  &--fail {
    background-color: var(--color-danger);
  }
}
</style>
