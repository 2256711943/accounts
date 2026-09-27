<template>
  <!--
    轻提示 / 二次确认的**唯一**宿主（AGENTS.md 组件引入红线）：
    wd-toast / wd-message-box 在 uni-app 中无法全局挂载，页面不得直接写这两个标签，
    只能通过本组件的 ref 调用 useToast()/useMessage()。
  -->
  <wd-toast />
  <wd-message-box />
</template>

<script setup lang="ts">
// 从 wot-design-uni 子路径导入，绕开包入口 `export *`（会把无关的 wd-notify
// 等源码拉进 vue-tsc 检查范围，暴露第三方库自身的 noUnusedLocals 错误）。
import { useMessage } from 'wot-design-uni/components/wd-message-box';
import { useToast } from 'wot-design-uni/components/wd-toast';

/**
 * 薄封装：暴露业务页面只需要的两个能力
 * - toast.show(msg)            轻提示，1.5s 自动消失
 * - toast.loading() / .success() 等便捷方法仍可用（继承自 useToast）
 * - message.confirm({...})     二次确认，返回 Promise<MessageResult>
 * - message.alert({...})       信息弹框
 *
 * 页面用法：`<Feedback ref="feedbackRef" />` 后 `feedbackRef.toast.show('已保存')`。
 */
const toast = useToast();
const message = useMessage();

defineExpose({ toast, message });
</script>
