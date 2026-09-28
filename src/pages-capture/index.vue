<template>
  <view class="cap">
    <!-- 顶栏：关闭 -->
    <view class="cap__bar">
      <view class="cap__close" hover-class="cap__close--hover" @tap="onClose">
        <text class="cap__close-icon">✕</text>
      </view>
    </view>

    <!-- 取景框：相机未授权 → Empty 降级；否则占位框 + 已选图预览 -->
    <view class="cap__viewport">
      <SgEmpty
        v-if="auth === 'denied'"
        type="error"
        title="相机权限未开启"
        desc="授权相机后才能拍照，也可以从相册选择或手动录入"
        action-text="去开启"
        @action="onOpenSetting"
      />
      <view v-else class="cap__frame">
        <image v-if="preview" class="cap__preview" :src="preview" mode="aspectFill" />
        <view class="cap__corner cap__corner--tl" />
        <view class="cap__corner cap__corner--tr" />
        <view class="cap__corner cap__corner--bl" />
        <view class="cap__corner cap__corner--br" />
        <view v-if="!preview" class="cap__frame-hint-box">
          <text class="cap__frame-icon">📷</text>
          <text class="cap__frame-tip">对准小票，按下快门</text>
        </view>
      </view>
    </view>

    <text class="cap__hint">把小票放进框里，光线亮一点</text>

    <!-- 底部操作：相册 / 快门 / 手输 -->
    <view class="cap__actions">
      <view class="cap__text-action" hover-class="cap__text-action--hover" @tap="onAlbum">
        <text class="cap__text-action-gap">相册</text>
      </view>
      <view class="cap__shutter" hover-class="cap__shutter--hover" @tap="onShutter">
        <view class="cap__shutter-inner" />
      </view>
      <view class="cap__text-action" hover-class="cap__text-action--hover" @tap="onManual">
        <text class="cap__text-action-gap">手输</text>
      </view>
    </view>

    <!-- 隐私指引弹窗 -->
    <view v-if="privacy.shown" class="cap__mask">
      <view class="cap__privacy">
        <text class="cap__privacy-title">隐私保护指引</text>
        <text class="cap__privacy-desc">
          使用相机、相册前，请你仔细阅读并同意《用户隐私保护指引》。我们仅在为你记账时使用图片。
        </text>
        <view class="cap__privacy-link" @tap="onOpenPrivacyContract">查看《用户隐私保护指引》</view>
        <view class="cap__privacy-btns">
          <view
            class="cap__privacy-btn cap__privacy-btn--ghost"
            hover-class="cap__privacy-btn--hover"
            @tap="privacy.refuse"
          >不同意</view>
          <view class="cap__privacy-btn" hover-class="cap__privacy-btn--hover" @tap="privacy.agree">同意</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * D6 拍照页（普通分包 `pages-capture`）。
 *
 * 职责：相机授权降级闭环 + 拍照 / 相册选图入口 + 《隐私保护指引》弹窗。
 * - 相机未授权：取景框替换为 `SgEmpty` + 「去开启」，并**保留下方相册 / 手输入口**（授权被拒必须有出路）
 * - 拍照 / 相册：走 `adapters/media`（MP `chooseMedia`，H5 程序化 `input[type=file]`），拿到临时路径存入 `preview`
 * - 手输：D6 为 stub，D8 接真实表单
 * - 识别 / 上传 / 确认卡：D8-D9 接入，本页不阻塞
 */
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { pickImage } from '@/adapters/media';
import { getCameraAuthStatus, openPrivacyContract, openSetting } from '@/adapters/privacy';
import { vibrateShort } from '@/adapters/system';
import { usePrivacyStore } from '@/stores/privacy';
import type { MediaPickResult } from '@/adapters/media';
import type { CameraAuthStatus } from '@/adapters/privacy';

const privacy = usePrivacyStore();

/** 相机授权状态：denied → Empty 降级；其余 → 取景框 + 快门 */
const auth = ref<CameraAuthStatus>('not-determined');
/** 选中图片的临时路径；非空时在取景框内预览 */
const preview = ref('');
/** 是否正在选择（防连点） */
const picking = ref(false);

async function refreshAuth() {
  const s = await getCameraAuthStatus();
  if (auth.value !== s) auth.value = s;
}

function handlePick(res: MediaPickResult) {
  picking.value = false;
  if (res.ok && res.tempFilePath) {
    preview.value = res.tempFilePath;
    return;
  }
  if (res.hasDenied) {
    refreshAuth(); // 相机被拒 → 翻转为 Empty + 去开启
    uni.showToast({ title: '相机权限被拒，可从相册或手输', icon: 'none' });
    return;
  }
  if (!res.canceled) {
    uni.showToast({ title: res.errMsg || '选择失败，请重试', icon: 'none' });
  }
}

async function onShutter() {
  if (picking.value) return;
  picking.value = true;
  vibrateShort('light');
  const res = await pickImage('camera');
  handlePick(res);
}

async function onAlbum() {
  if (picking.value) return;
  picking.value = true;
  const res = await pickImage('album');
  handlePick(res);
}

function onManual() {
  // D8 接手动录入表单；此处 stub
  uni.showToast({ title: '手输表单 D8 接入', icon: 'none' });
}

async function onOpenSetting() {
  const ok = await openSetting();
  if (ok) refreshAuth();
  else uni.showToast({ title: '未打开系统设置', icon: 'none' });
}

function onOpenPrivacyContract() {
  openPrivacyContract();
}

function onClose() {
  uni.navigateBack({
    fail: () => uni.reLaunch({ url: '/pages/index/index' }),
  });
}

onLoad(() => {
  privacy.init(); // 确保隐私回调已注册（App 启动也会注册，此处幂等）
  refreshAuth();
});
onShow(() => {
  refreshAuth(); // 从系统设置返回后重查授权状态
});
</script>

<style lang="scss">
@import '../styles/tokens';

.cap {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + #{$sp-2}) $sp-4 0;
  background-color: $color-bg-base;

  &__bar {
    display: flex;
    align-items: center;
    height: 88rpx;
  }

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88rpx;
    height: 88rpx;
    margin-left: -#{$sp-2};
    border-radius: $r-full;
    transition: transform 120ms $ease-std;

    &--hover {
      transform: scale(0.92);
    }
  }

  &__close-icon {
    font-size: 32rpx;
    color: $color-text-secondary;
  }

  /* 取景框区域 */
  &__viewport {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 600rpx;
    padding: $sp-3 0;
  }

  &__frame {
    position: relative;
    width: 622rpx;
    height: 822rpx;
    overflow: hidden;
    background-color: $color-bg-subtle;
    border-radius: $r-lg;
  }

  &__preview {
    width: 100%;
    height: 100%;
  }

  /* 取景框四角描边（accent 色） */
  &__corner {
    position: absolute;
    width: 64rpx;
    height: 64rpx;
    border-color: $color-accent;
    border-style: solid;
    border-width: 0;
    pointer-events: none;

    &--tl {
      top: $sp-3;
      left: $sp-3;
      border-top-width: 6rpx;
      border-left-width: 6rpx;
      border-top-left-radius: $r-sm;
    }

    &--tr {
      top: $sp-3;
      right: $sp-3;
      border-top-width: 6rpx;
      border-right-width: 6rpx;
      border-top-right-radius: $r-sm;
    }

    &--bl {
      bottom: $sp-3;
      left: $sp-3;
      border-bottom-width: 6rpx;
      border-left-width: 6rpx;
      border-bottom-left-radius: $r-sm;
    }

    &--br {
      right: $sp-3;
      bottom: $sp-3;
      border-right-width: 6rpx;
      border-bottom-width: 6rpx;
      border-bottom-right-radius: $r-sm;
    }
  }

  &__frame-hint-box {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $sp-3;
  }

  &__frame-icon {
    font-size: 96rpx;
  }

  &__frame-tip {
    font-size: $fs-caption;
    color: $color-text-tertiary;
  }

  &__hint {
    margin: $sp-2 0;
    font-size: $fs-caption;
    text-align: center;
    color: $color-text-secondary;
  }

  /* 底部操作 */
  &__actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: $sp-5 $sp-8 calc(env(safe-area-inset-bottom) + #{$sp-5});
  }

  &__text-action {
    min-width: 160rpx;
    text-align: center;
    transition: transform 120ms $ease-std;

    &--hover {
      transform: scale(0.96);
    }
  }

  &__text-action-gap {
    padding: $sp-2 $sp-3;
    font-size: $fs-body;
    color: $color-text-secondary;
  }

  /* 快门 144rpx */
  &__shutter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 144rpx;
    height: 144rpx;
    background-color: $color-bg-surface;
    border: 8rpx solid $color-line-strong;
    border-radius: $r-full;
    box-shadow: $sh-2;
    transition: transform 120ms $ease-std;

    &--hover {
      transform: scale(0.94);
    }
  }

  &__shutter-inner {
    width: 112rpx;
    height: 112rpx;
    background-color: $color-accent;
    border-radius: $r-full;
  }

  /* 隐私弹窗 */
  &__mask {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background-color: $color-bg-mask;
  }

  &__privacy {
    width: 100%;
    padding: $sp-6 $sp-5 calc(env(safe-area-inset-bottom) + #{$sp-6});
    background-color: $color-bg-surface;
    border-radius: $r-xl $r-xl 0 0;
  }

  &__privacy-title {
    font-size: $fs-h2;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__privacy-desc {
    margin-top: $sp-3;
    font-size: $fs-body;
    line-height: $font-line-height-body;
    color: $color-text-secondary;
  }

  &__privacy-link {
    margin-top: $sp-3;
    font-size: $fs-caption;
    color: $color-accent;
  }

  &__privacy-btns {
    display: flex;
    flex-direction: row;
    gap: $sp-3;
    margin-top: $sp-6;
  }

  &__privacy-btn {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    height: 88rpx;
    font-size: $fs-body;
    font-weight: $font-weight-medium;
    color: $color-text-inverse;
    background-color: $color-accent;
    border-radius: $r-full;
    transition: transform 120ms $ease-std;

    &--ghost {
      color: $color-accent;
      background-color: transparent;
      border: 1rpx solid $color-accent-soft;
    }

    &--hover {
      transform: scale(0.98);
    }
  }
}
</style>