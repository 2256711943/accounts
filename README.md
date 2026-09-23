# 一拍记 SnapLedger

> 拍照记账，一拍即记。**uni-app 一套代码出微信小程序 + H5** 的 AI 拍照记账应用。

一个个人项目，目标是把「跨端适配层 / 图片处理管线 / 离线优先同步 / 小程序性能治理」四件事
做扎实并留下可复现的实测数据。设计与架构文档在 `docs/`，工程约束在 `AGENTS.md`。

---

## 当前进度

| 阶段 | 状态 |
|---|---|
| **D1 环境 + 设计基建** | ✅ 双端脚手架跑通 · 依赖就位 · easycom 配好 · Token 管线可用 · Figma 插件可用 |
| D2–D15 | 见 `docs/DEV_PLAN.md` |

---

## 技术栈

### 运行时依赖

| 依赖 | 版本 | 说明 |
|---|---|---|
| `@dcloudio/uni-app` 等 | `3.0.0-5020420260813003` | 只装 **H5 + 微信小程序** 两个平台包；模板自带的 14 个其他平台包已移除 |
| `vue` | `^3.4.21` | uni-app 内置，也是 Wot 的 peer 要求 |
| `pinia` | `^2.2.6` | 状态管理（2.x） |
| `wot-design-uni` | **`1.14.0`**（精确） | 交互密集型组件，**仅经 easycom 按需引入** |
| `vue-i18n` | `^9.1.9` | uni-app H5 端运行时的间接依赖，保留 |

### 构建 / 开发工具

| 依赖 | 版本 | 说明 |
|---|---|---|
| `vite` | `5.2.8` | uni-app CLI 工程 |
| `typescript` | `^5.6.3` | `tsconfig` 开 `strict` |
| `vue-tsc` | `^2.1.10` | `npm run type-check` |
| `sass` | **`1.78.0`（锁死，不带 `^`）** | >1.78 的新版 Dart Sass 废弃了一批 API，会让组件库样式编译报错 |
| `eslint` + `@typescript-eslint` + `eslint-plugin-vue` | 8.x / 7.x / 9.x | `npm run lint:js` |
| `stylelint` + `stylelint-config-standard-scss` | 16.x / 13.x | `npm run lint:style`，`postcss-html` 负责解析 `.vue` |

> ⚠️ **`sass` 必须是精确的 `1.78.0`**。这是 `AGENTS.md` 与 `ARCHITECTURE.md §3.5` 的硬约束，
> `docs/DEV_PLAN.md §7` 的交付检查清单里也有一项单独核对它。

---

## 快速开始

```bash
npm install

# 微信小程序：产物在 dist/dev/mp-weixin，用微信开发者工具导入该目录
npm run dev:mp-weixin

# H5
npm run dev:h5
```

质量门禁（提交前跑一遍，等价于 `AGENTS.md` 的「修改后必须执行」）：

```bash
npm run check        # = type-check + lint
npm run type-check   # vue-tsc --noEmit
npm run lint         # = lint:js + lint:style
```

---

## npm scripts

| 脚本 | 作用 |
|---|---|
| `dev:h5` / `dev:mp-weixin` | 双端开发模式 |
| `build:h5` / `build:mp-weixin` | 双端生产构建 |
| `type-check` | `vue-tsc --noEmit`（`strict: true`） |
| `lint` / `lint:js` / `lint:style` | ESLint + stylelint（`--max-warnings 0`） |
| `check` | `type-check` + `lint` |
| `gen:scss` | `tokens.json` → `src/styles/tokens.scss` |
| `gen:figma` | `tokens.json` → 注入 Figma 插件的 token 区 |
| `gen:tokens` | 上面两个一起跑 |
| `gen:tokens:check` | 校验两份产物是否与 `tokens.json` 同步（CI 用，不同步 exit 1） |
| `check:figma` | 在 Node 里用 mock 跑一遍 Figma 插件，抓运行时错误 |

---

## 设计系统：单一来源管线

```
design/tokens/tokens.json          ← 唯一来源（Figma Variables 导出）
        │
        ├─ npm run gen:scss ──► src/styles/tokens.scss   【产物，禁止手改】
        │                           ├─ SCSS 变量      $color-accent
        │                           └─ CSS 自定义属性  --color-accent（由 sg-css-vars mixin 控制）
        │
        └─ npm run gen:figma ─► design/figma-plugin/code.js 的 TOKENS 标记区
```

- **`tokens.scss` 顶层零 CSS 输出**：因为它会被多个 `.vue` import（换取 SCSS 变量），
  若把 `:root, page { … }` 写在顶层，每 import 一次就重复输出一份样式。
  所以 CSS 变量块放在 `sg-css-vars` mixin 里，**只在 `App.vue` 的全局 style 里 include 一次**。
- `tokens.scss` 里还有 `$sg-tokens` 查询表与 `sg-token("color-accent")` 取用函数。
- 命名规则（`color.accent.default → --color-accent` 等）唯一实现在
  `scripts/lib/token-naming.mjs`，SCSS 生成器与 Figma 生成器共用同一份，
  改规则只改这一个文件。规则原文见 `docs/UI_SPEC.md §2.7`。

**唯一的字面色值例外**：`src/pages.json` 的 `globalStyle` 导航底色。
平台只接受字面量，无法引用变量，修改 token 时需手工同步（文件内有注释标注）。

---

## Figma 插件（设计稿一键生成）

`design/figma-plugin/` 是一个本地 Figma 插件，运行后生成 5 个 Page：
`00 Cover` / `01 Foundations` / `02 Components` / `03 Screens` / `04 Prototype`。

1. Figma → `Plugins` → `Development` → `Import plugin from manifest…`
2. 选择 `design/figma-plugin/manifest.json`
3. 打开设计文件 → 运行 **SnapLedger UI Kit Generator**

插件是**幂等**的：会先清空同名 Page 再重建。**请只在专用设计文件里运行**
（不要在有手工成果的文件里跑，会丢掉这 5 个 Page 上的内容）。

生成前先跑一次 `npm run gen:figma`（或在 Figma 里改动设计变量后跑），
保证插件里的 token 与 `tokens.json` 同步 —— `npm run check:figma` 会在执行前校验这一点。

---

## 目录结构

```
accounts/
├─ docs/          SPEC / ARCHITECTURE / UI_SPEC / DEV_PLAN
├─ design/
│  ├─ tokens/tokens.json          设计 Token 单一来源
│  ├─ figma-plugin/               设计稿生成插件（manifest.json + code.js）
│  └─ screenshots/                双端对照截图
├─ scripts/
│  ├─ lib/token-naming.mjs        三层命名唯一实现
│  ├─ gen-scss.mjs                tokens.json → tokens.scss
│  ├─ gen-figma-tokens.mjs        tokens.json → 插件 TOKENS 区
│  └─ check-figma-plugin.mjs      mock 运行插件，抓运行时错误
└─ src/
   ├─ styles/tokens.scss          【自动生成，禁止手改】
   ├─ pages/ pages.json manifest.json main.ts App.vue uni.scss
   └─ …（页面 / 组件 / 适配层 / 服务 / 状态，按 DEV_PLAN 逐日补齐）
```

---

## 约定

- 提交信息用 Conventional Commits（`feat` / `fix` / `perf` / `docs` / `refactor`）。
- 每天双端都要能跑；任何只在一端可用的提交视为未完成。
- 组件库只能经 `pages.json` 的 easycom 引入，**禁止 `import` 整包**。
- 业务代码里禁止 `#ifdef`，条件编译只允许出现在 `src/adapters/`。
