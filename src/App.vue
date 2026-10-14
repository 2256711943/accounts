<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
import { usePrivacyStore } from '@/stores/privacy';
import { useRecordStore } from '@/stores/record';
import { markLaunch } from '@/utils/perf';

/**
 * 应用级生命周期。
 *
 * 刻意不写 console.log：启动埋点统一走 `utils/perf.ts`（D13），
 * 免得开发日志混进生产包（D14 交付检查项「无 console.log 残留」）。
 */
onLaunch(() => {
  // D13：T1 起点（首页 onReady 时 markTiming('t1') 计算相对耗时）
  markLaunch();
  // D6：注册《隐私保护指引》回调（H5 端为空实现，恒不弹）
  usePrivacyStore().init();
  // D10：账单缓存直出 + 网络监听（恢复网络自动补传离线队列）
  useRecordStore().init();
});
</script>

<style lang="scss">
@import './styles/tokens';
@import './styles/wot-theme';

/* ─────────────────────────────────────────────────────────────────────────────
 * 全局入口：CSS 自定义属性形态在这里落**唯一一次**
 *
 * tokens.scss 顶层零 CSS 输出（import 任意次都不会产生重复样式），
 * 但 `sg-css-vars` mixin 只能 include 一次，否则 `:root, page` 块会重复输出。
 * ───────────────────────────────────────────────────────────────────────────── */
@include sg-css-vars;

page {
  background-color: $color-bg-base;
  color: $color-text-primary;
  font-family: $font-family-sans;
  font-size: $fs-body;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* D14 打磨：H5 桌面浏览器把页面收敛为 480px「手机壳」居中，避免拉满全屏（DoD）。
   MP 端无视口媒体查询语义，此块不产生任何影响；仅动背景/布局，不触发动效。 */
@media (width >= 481px) {
  body {
    background-color: $color-bg-subtle;
  }

  uni-app,
  uni-page {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
    background-color: $color-bg-base;
    box-shadow: $sh-2;
  }
}

/* D14 动效治理：H5 端 prefers-reduced-motion 全局兜底（页面级已逐处处理，这里做最后一层保险）。
   时长压到近 0 而非置 none，避免破坏组件内「必须完成」的状态复位。
   MP 端无此媒体查询语义，整块被忽略。 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
