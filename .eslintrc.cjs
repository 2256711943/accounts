/* eslint-env node */
/**
 * ESLint 配置（ESLint 8 传统格式 —— 与 uni-app + Vue3 + TS 的组合最稳）。
 *
 * 定位：只抓**真问题**（未定义变量、未使用变量、Vue 用法错误、TS 反模式）。
 * 纯格式化规则（max-attributes-per-line / html-self-closing / attributes-order 等）
 * 一律不开 —— 这个项目没有引入 Prettier，开一堆纯格式规则只会制造噪音。
 * 后续若接 Prettier，再把 plugin:vue/vue3-recommended 加上并按需覆盖即可。
 *
 * 由 `npm run lint:js` 调用；`npm run lint` 会连带跑 stylelint。
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2022,
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:vue/vue3-essential', 'plugin:@typescript-eslint/recommended'],
  // uni-app / 小程序平台注入的全局对象
  globals: {
    uni: 'readonly',
    wx: 'readonly',
    plus: 'readonly',
    getApp: 'readonly',
    getCurrentPages: 'readonly',
    App: 'readonly',
    Page: 'readonly',
    Component: 'readonly',
    UniApp: 'readonly',
  },
  rules: {
    // 单文件组件就叫 index.vue，这条规则对本项目无意义
    'vue/multi-word-component-names': 'off',
    // 类型由 src/types 把关，这里允许在必要处使用 any（但不鼓励）
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    // utils/perf.ts 需要写日志，统一放行 warn/error，堵住 console.log
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    eqeqeq: ['error', 'always', { null: 'ignore' }],
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'src/static/',
    'design/',
    'scripts/',
    '*.cjs',
    '*.mjs',
    'src/styles/tokens.scss',
  ],
};
