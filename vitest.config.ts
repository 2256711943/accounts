import { defineConfig } from "vitest/config";

/**
 * Vitest 配置 —— 只测纯 Node 侧代码（云函数），不加载 uni-app 插件。
 *
 * 为什么单独一个文件而不是复用 vite.config.ts：
 * vite.config.ts 里挂了 @dcloudio/vite-plugin-uni 与一个自定义同步插件，
 * 它们依赖 uni-app 的编译环境（UNI_PLATFORM / UNI_OUTPUT_DIR），
 * 跑单测时加载它们没有意义，还可能把测试拖进 uni 的构建流程。
 *
 * 当前测试范围 = cloudfunctions/**（CJS 云函数 + 其 __tests__）。
 * 未来 src/services 这类纯逻辑若加测试，把 include 扩到这里即可。
 */
export default defineConfig({
  test: {
    include: ["cloudfunctions/**/__tests__/**/*.spec.mjs"],
    environment: "node",
  },
});
