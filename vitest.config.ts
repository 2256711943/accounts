import { defineConfig } from "vitest/config";

/**
 * Vitest 配置 —— 只测纯 Node 侧代码（云函数 + src 纯逻辑），不加载 uni-app 插件。
 *
 * 为什么单独一个文件而不是复用 vite.config.ts：
 * vite.config.ts 里挂了 @dcloudio/vite-plugin-uni 与一个自定义同步插件，
 * 它们依赖 uni-app 的编译环境（UNI_PLATFORM / UNI_OUTPUT_DIR），
 * 跑单测时加载它们没有意义，还可能把测试拖进 uni 的构建流程。
 *
 * 测试范围 = cloudfunctions 的 __tests__ 目录（CJS 云函数 + 其单测）
 *          + src 的 __tests__ 目录（自研组件预设等可脱离 uni 运行时单测的纯逻辑）。
 * 注意：块注释内不要写目录通配符（斜杠星），会提前闭合注释导致语法错误。
 */
export default defineConfig({
  test: {
    include: [
      "cloudfunctions/**/__tests__/**/*.spec.mjs",
      "src/**/__tests__/**/*.spec.ts",
    ],
    environment: "node",
  },
});
