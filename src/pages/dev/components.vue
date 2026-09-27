<template>
  <view class="dev-page">
    <!-- Button：四类型三尺寸 + loading/disabled -->
    <view class="dev-sec">
      <text class="dev-sec__title">Button · 四类型三尺寸</text>
      <view class="dev-sec__row">
        <SgButton type="primary" label="主操作" />
        <SgButton type="ghost" label="次操作" />
        <SgButton type="text" label="文字" />
        <SgButton type="danger" label="删除" />
      </view>
      <view class="dev-sec__row">
        <SgButton size="sm" label="sm 56" />
        <SgButton label="md 72" />
        <SgButton size="lg" label="lg 88" />
      </view>
      <view class="dev-sec__row">
        <SgButton loading label="加载中" />
        <SgButton disabled label="禁用" />
      </view>
    </view>

    <!-- Cell：默认 / 箭头 / 可点击 -->
    <view class="dev-sec">
      <text class="dev-sec__title">Cell · 默认 / 箭头 / 可点击</text>
      <view class="dev-sec__card">
        <SgCell label="普通单元格" value="说明" />
        <SgCell label="带箭头" value="去往" arrow />
        <SgCell label="可点击" value="触达" clickable @click="onCellTap" />
      </view>
    </view>

    <!-- Card：flat / elevated -->
    <view class="dev-sec">
      <text class="dev-sec__title">Card · flat / elevated</text>
      <view class="dev-sec__card">
        <SgCard><text class="dev-sec__card-text">flat 卡片，无投影</text></SgCard>
        <SgCard type="elevated"><text class="dev-sec__card-text">elevated 卡片，sh-1</text></SgCard>
      </view>
    </view>

    <!-- Tag：soft / outline × 5 色 -->
    <view class="dev-sec">
      <text class="dev-sec__title">Tag · soft / outline × 5 色</text>
      <view class="dev-sec__row">
        <SgTag label="餐饮" />
        <SgTag color="success" label="收入" />
        <SgTag color="warning" label="待同步" />
        <SgTag color="danger" label="失败" />
        <SgTag color="info" label="提示" />
      </view>
      <view class="dev-sec__row">
        <SgTag variant="outline" label="餐饮" />
        <SgTag variant="outline" color="success" label="收入" />
        <SgTag variant="outline" color="warning" label="待同步" />
        <SgTag variant="outline" color="danger" label="失败" />
        <SgTag variant="outline" color="info" label="提示" />
      </view>
    </view>

    <!-- Avatar：md / sm，含分类色透传 -->
    <view class="dev-sec">
      <text class="dev-sec__title">Avatar · md / sm</text>
      <view class="dev-sec__row">
        <SgAvatar text="餐" />
        <SgAvatar text="交" bg-color="#6C4BFF" text-color="#FFFFFF" />
        <SgAvatar size="sm" text="购" />
      </view>
    </view>

    <!-- Skeleton：line / card / list -->
    <view class="dev-sec">
      <text class="dev-sec__title">Skeleton · line / card / list</text>
      <view class="dev-sec__card">
        <SgSkeleton type="line" />
        <SgSkeleton type="card" />
        <SgSkeleton type="list" :rows="3" />
      </view>
    </view>

    <!-- Empty：三态 + 主操作 -->
    <view class="dev-sec">
      <text class="dev-sec__title">Empty · 三态 + 主操作</text>
      <view class="dev-sec__card">
        <SgEmpty action-text="拍一张小票" @action="toastDemo" />
        <SgEmpty type="no-network" action-text="重试" @action="toastDemo" />
        <SgEmpty type="error" />
      </view>
    </view>

    <!-- 轻提示 / 二次确认宿主 -->
    <Feedback ref="feedbackRef" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Feedback from '@/components/biz/Feedback.vue';

const feedbackRef = ref<InstanceType<typeof Feedback> | null>(null);

function toastDemo() {
  feedbackRef.value?.toast.success('组件验收通过');
}

function onCellTap() {
  feedbackRef.value?.toast.show('Cell 可点击');
}
</script>

<style lang="scss">
.dev-page {
  padding: $sp-4;

  .dev-sec {
    margin-bottom: $sp-6;

    &__title {
      font-size: $fs-caption;
      color: $color-text-secondary;
    }

    &__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: $sp-3;
      margin-top: $sp-3;
    }

    &__card {
      display: flex;
      flex-direction: column;
      gap: $sp-3;
      margin-top: $sp-3;
    }

    &__card-text {
      font-size: $fs-body;
    }
  }
}
</style>
