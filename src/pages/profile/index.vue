<template>
  <view class="page">
    <!-- 登录态 -->
    <view class="card">
      <view class="row">
        <text class="row__label">账号</text>
        <text class="row__value">{{ uidLabel }}</text>
      </view>
      <view class="row" @tap="onSyncNow">
        <text class="row__label">立即同步</text>
        <text class="row__arrow">›</text>
      </view>
    </view>

    <!-- 提醒开关（D13 接真实订阅） -->
    <view class="card">
      <view class="row">
        <view class="row__aside">
          <text class="row__label">记账提醒</text>
          <text class="row__desc">开启后每周提醒记账</text>
        </view>
        <wd-switch :model-value="remindOn" size="24px" @change="onToggleRemind" />
      </view>
    </view>

    <!-- 清缓存 -->
    <view class="card">
      <view class="row" @tap="onClearCache">
        <text class="row__label">清空本地缓存</text>
        <text class="row__value">{{ cacheSize }}</text>
      </view>
    </view>

    <!-- 版本号隐藏入口 → 开发面板占位（连点 5 次） -->
    <view class="version" @tap="onVersionTap">
      <text class="version__text">一拍记 v{{ VERSION }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * D9 我的页（主包 `pages/profile`）—— 登录态 / 提醒开关 / 清缓存 / 版本隐藏入口。
 * 登录：`user.login`（H5 走 demo 身份，MP 由云开发注入 OPENID；无云 SDK 时回退 demo UID，不阻塞）。
 */
import { ref } from 'vue';
import { call } from '@/api/client';
import { getStorageSizeLabel } from '@/utils/storage';

const VERSION = '0.1.0';

const uidLabel = ref('未登录');
const remindOn = ref(true);
const cacheSize = ref('');
const versionTaps = ref(0);

async function initLogin(): Promise<void> {
  try {
    const res = await call('user.login', {});
    uidLabel.value = res?.uid || '已登录';
  } catch {
    uidLabel.value = 'demo（未连接云端）';
  }
}

function refreshCache(): void {
  cacheSize.value = getStorageSizeLabel();
}
function onToggleRemind(e: { detail: boolean }): void {
  remindOn.value = e.detail;
  uni.showToast({ title: remindOn.value ? '已开启提醒' : '已关闭提醒', icon: 'none' });
}
function onSyncNow(): void {
  uni.showToast({ title: '离线队列 D10 接入', icon: 'none' });
}
function onClearCache(): void {
  uni.clearStorageSync();
  refreshCache();
  uni.showToast({ title: '已清空缓存', icon: 'success' });
}
function onVersionTap(): void {
  versionTaps.value += 1;
  if (versionTaps.value >= 5) {
    versionTaps.value = 0;
    uni.navigateTo({ url: '/pages/dev/components' });
  }
}

initLogin();
refreshCache();
</script>

<style lang="scss">
@import '../../styles/tokens';

.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: $sp-5 $sp-4 $sp-8;
  background-color: $color-bg-base;
}

.card {
  padding: 0 $sp-4;
  margin-bottom: $sp-4;
  background-color: $color-bg-surface;
  border-radius: $r-lg;
  box-shadow: $sh-1;
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: 88rpx;

  &__aside {
    display: flex;
    flex-direction: column;
    gap: $sp-1;
  }

  &__label {
    font-size: $fs-body;
    color: $color-text-primary;
  }

  &__desc {
    font-size: $fs-caption;
    color: $color-text-secondary;
  }

  &__value {
    font-size: $fs-body;
    color: $color-text-secondary;
  }

  &__arrow {
    font-size: $fs-h2;
    color: $color-text-tertiary;
  }
}

.version {
  margin-top: $sp-8;
  text-align: center;

  &__text {
    font-size: $fs-caption;
    color: $color-text-tertiary;
  }
}
</style>