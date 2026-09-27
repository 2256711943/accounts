<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';

/**
 * 应用级生命周期。
 *
 * 刻意不写 console.log：启动埋点统一走 `utils/perf.ts`（D13），
 * 免得开发日志混进生产包（D14 交付检查项「无 console.log 残留」）。
 */
onLaunch(() => {
  // TODO(D13): perf.mark('launch')
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
</style>
