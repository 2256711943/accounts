# AGENTS.md — 一拍记（SnapLedger）前端项目宪法

> **工程根：`D:\projects\accounts`**
> 本文件是 Coding Agent 的行为边界。与 `docs/` 下四份文档冲突时，**以本文件为准**；
> 本文件未覆盖的细节，按 Context Routing 查到对应文档，不要凭记忆推断。

---

## 角色

你是本仓库的 Coding Agent，负责在明确边界内完成代码修改、测试与文档更新。

- 项目目标：**uni-app 一套代码出微信小程序 + H5** 的 AI 拍照记账应用，交付物要能写进简历
- 默认姿态：先读懂既有分层与约定再动手；**控制改动半径**，不为「顺手优化」扩大 diff
- 判断标准：一个改动如果既不能补齐技术空缺、也不能产出可量化数据，就不做

---

## 技术栈

- **uni-app CLI 工程**（Vue 3 + Vite 5）+ TypeScript 5.x（`strict: true`）
- **包管理器：npm**（工程内不混用 pnpm / yarn）
- **样式**：SCSS + Design Tokens；`sass` 锁死 **1.78.0**，禁升 1.79+
- **状态**：Pinia 2.x
- **UI**：**分层策略** —— 视觉型组件自研 7 个；交互密集型外采 `wot-design-uni` 1.14.0（easycom 按需）
- **请求**：`@/api/client.ts` 的 `call<T>(action, payload)` 统一入口
- **后端**：微信云开发（云函数 + 云数据库 + 云存储），代码在 `cloudfunctions/`
- **图表**：canvas 2d 自绘，**不引** uCharts / ec-canvas
- **提交规范**：Conventional Commits（`feat` / `fix` / `perf` / `docs` / `refactor`）

---

## 目录约定

| 类型 | 路径 |
|---|---|
| 主包页面 | `src/pages/{pageName}/index.vue` |
| 分包页面 | `src/pages-capture/` · `src/pages-stats/` · `src/pages-detail/` |
| 自研原子组件 | `src/components/{Name}/index.vue` |
| 业务组件 | `src/components/biz/{Name}.vue` |
| 跨端适配 | `src/adapters/{capability}.ts`（+ `types.ts` / `index.ts`）——**单文件 + 函数体内 `#ifdef`**；禁拆 `.mp.ts` / `.h5.ts`（uni-app 不解析平台后缀文件，见 `ARCHITECTURE.md §3.3`） |
| 业务流程服务 | `src/services/{domain}/{file}.ts` |
| 状态 | `src/stores/{name}.ts` |
| 接口模块 | `src/api/modules/{domain}.ts` |
| 云函数 | `cloudfunctions/{name}/index.js` |
| 类型 | `src/types/{api\|model}.ts` |
| 样式 | `src/styles/{tokens,wot-theme,mixins,theme}.scss` |
| 测试 | 与源文件同域：`src/**/__tests__/{name}.spec.ts` |
| 文档 / 设计资产 | `docs/` · `design/` |

---

## 架构红线（lint 抓不到，只能靠自觉）

1. **依赖方向单向**：`pages → components → stores → services → api → adapters`。
   `adapters/` 是最底层，**不得引用任何上层模块**。
2. **`#ifdef` / `#ifndef` 只允许出现在 `src/adapters/` 内**。
   业务代码出现条件编译 = 架构违规，应改为在适配层暴露统一接口。
3. **`components/` 不发请求、不读全局 store**，严格 props in / emit out。
4. `services/` 不出现 UI 代码；`api/` 不含业务判断逻辑。
5. **客户端不直连云数据库**（不写 `wx.cloud.database()`），一律经 `call()` 走云函数；
   云函数内所有查询**强制注入 `_openid`**。
6. **适配层方法永不抛未捕获异常**：能力缺失时返回带降级标记的结果（如 `{ denied: true }`），
   由 `services/` 决定业务降级路径。

---

## 样式与设计红线

1. **禁止字面色值与字面间距**：颜色 / 字号 / 间距 / 圆角 / 阴影 / 时长一律走 token 变量
   （`$color-accent`、`--sp-4`）。
2. **Token 单一来源**：只改 `design/tokens/tokens.json`，再跑 `npm run gen:scss`。
   **禁止手改 `src/styles/tokens.scss`**（它是产物）。
3. 组件库的视觉由**我们**决定：Wot 变量覆盖只写在 `src/styles/wot-theme.scss`；
   选择器必须写 `:root, page { … }`（只写一个会单端失效）；
   `--wot-color-white` / `--wot-color-black` **禁改**（参与组件内部 `mix()` 混色）。
4. 动效**只动 `transform` / `opacity`**，禁动 `width` / `height` / `top` / `left`；
   时长与缓动取 token。H5 端必须处理 `prefers-reduced-motion`。
5. 设计稿基准 **375×812（1x）**，**1px = 2rpx**；间距必须落在 4px 栅格上。

---

## 组件引入红线

- `wot-design-uni` **只经 `pages.json` 的 easycom 引入**。
  禁止 `import` 整包、禁止在 `main.ts` 全局 `app.use` 注册。
- **外采白名单**（新增需先更新 `ARCHITECTURE.md §1.2` 并说明理由）：
  `wd-datetime-picker` · `wd-action-sheet` · `wd-popup` · `wd-message-box` · `wd-toast`
  · `wd-img` · `wd-swipe-action` · `wd-switch` · `wd-loadmore` · `wd-number-keyboard`
- **既不外采也不许被替换**：`DonutChart`（canvas 2d 自绘）、自研虚拟列表 —— 这两个是简历亮点本体。
- `wd-toast` / `wd-message-box` 在 uni-app 中**无法全局挂载**，
  只允许出现在 `components/biz/Feedback.vue` 内，**页面不得直接写这两个标签**。
- ⚠️ 改 `pages.json` 的 `easycom` **不会触发重编译**，改完要顺手改动一个页面文件。

---

## 禁止事项

- 禁止 `git push --force` / `git reset --hard`（会覆盖他人工作）
- 禁止提交密钥：`MODEL_API_KEY`、`envId` 敏感配置、`cloudfunctions/*/config.json` 中的凭据
- 禁止在业务代码里写云开发 SDK 调用（见架构红线 5）
- 禁止新增第三方依赖而不先更新 `ARCHITECTURE.md §5` 依赖清单
- 禁止「单端可用」的提交：任何功能提交前，**小程序与 H5 都要能跑**
- 涉及**生产配置变更**（云函数环境变量、`manifest.json` 的 `envId`、小程序后台隐私指引）
  → **先输出 dry-run 方案待确认**，不得直接改
- 代码层面的禁令（内联样式、`any` 滥用、未使用变量、直接 `fetch`）
  不写在这里，由 **ESLint + `tsc --strict`** 硬约束，见 `package.json` 的 lint 配置

---

## 修改后必须执行

- `npm run type-check`（`vue-tsc --noEmit`）
- `npm run lint`（eslint + stylelint）
- 双端各起一次确认不白屏：`npm run dev:mp-weixin` / `npm run dev:h5`
- 新增组件必须附带 `__tests__/{name}.spec.ts`
- 新增或改动云函数 action，必须同步 `src/types/api.ts` 的入出参类型
- 改动样式 / 动效后，过一遍 H5 的 `prefers-reduced-motion`
- 每日收尾：Git 提交 + 写一行「今天能写进简历的句子」（写不出来说明当天在做无价值的活）

---

## Context Routing

- **改视觉 / 组件规格前** → 先读 `docs/UI_SPEC.md`（§2 Tokens、§2.7 变量命名约定、§4 组件清单）
- **做架构决策、动分层 / 适配层 / 分包前** → 先读 `docs/ARCHITECTURE.md`
  （§1.2 关键决策与被否方案、§3.5 组件库主题桥接、§4 关键子系统设计）
- **判断某功能是否在范围内** → 查 `docs/SPEC.md`（能力补齐矩阵 + 验收标准）
- **确认今天做什么、做到什么程度** → 查 `docs/DEV_PLAN.md`（当日任务与 DoD）
- **排查组件库问题** → 直读 `node_modules/wot-design-uni/components/common/abstracts/variable.scss`，**不要猜变量名**
- **执行发布 / 交付流程** → 走 `docs/DEV_PLAN.md §7` 交付检查清单，逐项打勾
- **涉及接口变更** → 同步 `ARCHITECTURE.md §6` action 表 + `src/types/api.ts`
- **改设计 Token / 样式变量前** → 先读 `docs/UI_SPEC.md §2.7`（三层命名），
  命名规则的唯一实现在 `scripts/lib/token-naming.mjs`。
  改 `design/tokens/tokens.json` 后跑 `npm run gen:tokens`；提交前跑 `npm run gen:tokens:check`
- **改 Figma 插件 / 重新生成设计稿** → `design/figma-plugin/`。
  插件 token 区由 `npm run gen:figma` 注入，**勿手改**；
  改完先跑 `npm run check:figma`（mock 运行时）再进 Figma 跑真正的插件
- **沉淀新 Skill / 工具脚本** → 仓库内工具放 `scripts/`（生成器统一支持 `--check`）并登记到
  `ARCHITECTURE.md §5`；可复用的方法论沉淀为用户级 Skill，`.agents/skills/{name}/SKILL.md`
