# UI_SPEC.md — 一拍记（SnapLedger）UI 设计规范

> 版本：v1.1 ｜ 日期：2026-09-22 ｜ 关联：`SPEC.md`、`ARCHITECTURE.md`、`DEV_PLAN.md`
> 配套交付：Figma 设计文件 + `design/tokens/tokens.json` + `src/styles/tokens.scss` + `src/styles/wot-theme.scss`
> **v1.1 修订**：§4 组件清单重构为「自研 7 / 外采 10 / 业务 6」三层 + 新增 §4.3 组件库主题变量映射表；新增 §2.7 变量命名约定（Figma → tokens.json → 代码）；§2、§5、§6、§7、§8 同步更新。

---

## 1. 设计基调

### 1.1 关键词
**暖白纸感 · 墨黑文字 · 赤陶橙单一强调 · 数字主角**

### 1.2 为什么这样选（这是要学到的设计判断，不是审美偏好）

| 决策 | 理由 |
|---|---|
| 底色用暖白 `#FAF9F5` 而非纯白 | 纯白在 OLED 屏上刺眼，长时间浏览记账流水会疲劳；暖白更像"纸质账本"，契合品类 |
| 文字用墨黑 `#2C2C2A` 而非 `#000` | 纯黑与背景对比度过高（>18:1），视觉生硬；墨黑 + 暖白约 12:1，可读性足够且更柔和 |
| 只用一个强调色（赤陶橙） | 多色强调 = 没有强调。一屏只有一个交互色，用户才知道该点哪里 |
| **刻意避开蓝紫渐变** | AI 生成的设计 90% 长这样（`#6366F1` → `#8B5CF6`）。暖橙系能让页面在同类作品里被一眼记住 |
| 层级靠「留白 + 字重 + 色阶」，不靠边框 | 满屏 1px 分割线是廉价感的头号来源。能用 24rpx 间距解决的就不要画线 |
| 数字是主角 | 记账 App 的核心信息是金额。金额用最大字阶 + `tabular-nums` 等宽数字，保证多行对齐 |
| 一屏一个视觉焦点 | 首页焦点只有一个：本月总支出。其余元素全部降级为辅助信息 |

### 1.3 视觉参考方向
- 参考品类：瑞士派排版（强网格、大留白、克制的色）、纸质票据的质感
- 不参考：主流记账 App 的高饱和糖果色、拟物化图标

---

## 2. Design Tokens

> **单一来源原则**：所有 token 定义在 Figma Variables 中，导出 `tokens.json` 后由脚本生成 `src/styles/tokens.scss`。
>
> **代码里禁止出现字面色值**——这条对第三方组件库同样成立：`src/styles/wot-theme.scss` 里的 `--wot-*` 变量必须引用 `tokens.scss` 的 SCSS 变量（`#{$color-accent}`），不得写字面量。
>
> 因此生成器需同时产出**两份形态**：**SCSS 变量**（`$color-accent: #E8663D`，供计算与组件库映射使用）+ **CSS 自定义属性**（`--color-accent`，供组件样式引用）。缺前者，组件库主题映射就得写字面量。

### 2.1 色彩

| Token | 值 | 用途 |
|---|---|---|
| `color/bg/base` | `#FAF9F5` | 页面底色（暖白） |
| `color/bg/surface` | `#FFFFFF` | 卡片、列表项 |
| `color/bg/subtle` | `#F2F0E9` | 次级块、标签底、骨架屏底 |
| `color/bg/mask` | `rgba(44,44,42,0.45)` | 弹层遮罩 |
| `color/line` | `rgba(44,44,42,0.08)` | 必要分割线（尽量少用） |
| `color/line/strong` | `rgba(44,44,42,0.16)` | 输入框边框、需强调的分隔 |
| `color/text/primary` | `#2C2C2A` | 主文案、支出金额 |
| `color/text/secondary` | `#6B6A64` | 辅助说明、时间、分类名 |
| `color/text/tertiary` | `#9C9A92` | 占位符、禁用态 |
| `color/text/inverse` | `#FFFFFF` | 深底上的文字 |
| `color/accent` | `#E8663D` | **唯一强调色**：主按钮、FAB、选中态、关键数字强调 |
| `color/accent/pressed` | `#C9502C` | 按压态 |
| `color/accent/soft` | `#FBEDE7` | 强调色的浅底（选中标签底） |
| `color/success` | `#2F8F7A` | 收入金额、同步成功 |
| `color/warning` | `#D9952B` | 待同步、识别降级提示 |
| `color/danger` | `#C4453C` | 删除、同步失败 |
| `color/info` | `#5B7A8C` | 中性提示（雾蓝，非品牌蓝） |

**图表配色（环形图，5 色循环，暖调）**：
`#E8663D` → `#D9952B` → `#2F8F7A` → `#B4566E` → `#5B7A8C`

### 2.2 字体与字阶

字体栈（**不使用 Inter**，中英文混排优先系统字体）：

```scss
$font-sans: -apple-system, "PingFang SC", "HarmonyOS Sans SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
```

| Token | 字号(px) | rpx | 行高 | 字重 | 用途 |
|---|---|---|---|---|---|
| `--fs-display` | 34 | 68 | 1.15 | 500 | 首页本月总支出 |
| `--fs-h1` | 22 | 44 | 1.30 | 500 | 页面大标题 |
| `--fs-h2` | 17 | 34 | 1.40 | 500 | 区块标题、卡片主标题 |
| `--fs-body` | 15 | 30 | 1.50 | 400 | 列表主文案 |
| `--fs-caption` | 13 | 26 | 1.40 | 400 | 辅助说明、时间 |
| `--fs-tiny` | 11 | 22 | 1.30 | 400 | 标签、角标 |

**规则**：
- 全部金额必须加 `font-variant-numeric: tabular-nums;`（小程序端用 `font-feature-settings: "tnum"`），保证多行数字对齐
- 字重只用 **400 / 500** 两档。500 已是"重"，再粗就廉价的
- 中文正文行高不低于 1.5，标题不低于 1.3

### 2.3 间距（4 的倍数栅格）

| Token | px | rpx | 典型用途 |
|---|---|---|---|
| `--sp-1` | 4 | 8 | 图标与文字间隙 |
| `--sp-2` | 8 | 16 | 标签内边距、紧凑元素 |
| `--sp-3` | 12 | 24 | 卡片内元素间距 |
| `--sp-4` | 16 | 32 | **页面左右边距 / 卡片内边距** |
| `--sp-5` | 20 | 40 | 区块之间 |
| `--sp-6` | 24 | 48 | 大区块分隔 |
| `--sp-8` | 32 | 64 | 页面顶部大留白 |

### 2.4 圆角

| Token | px | rpx | 用途 |
|---|---|---|---|
| `--r-sm` | 8 | 16 | 标签、小角标 |
| `--r-md` | 12 | 24 | 输入框、小卡片 |
| `--r-lg` | 16 | 32 | 主卡片、FAB |
| `--r-xl` | 20 | 40 | 底部抽屉顶部两角 |
| `--r-full` | 999 | — | 药丸按钮、头像 |

### 2.5 阴影（极轻，仅两级）

| Token | 值 | 用途 |
|---|---|---|
| `--sh-1` | `0 1px 2px rgba(44,44,42,0.04)` | 列表卡片 |
| `--sh-2` | `0 4px 16px rgba(44,44,42,0.06)` | 悬浮 FAB、底部抽屉 |

禁止：彩色阴影、多层大扩散阴影、内阴影（除 Liquid Glass 效果外）。

### 2.6 动效

| Token | 值 | 用途 |
|---|---|---|
| `--dur-fast` | 120ms | 按压反馈、标签切换 |
| `--dur-base` | 200ms | 列表项入场、卡片展开 |
| `--dur-slow` | 320ms | 页面级转场、抽屉 |
| `--ease-std` | `cubic-bezier(0.16, 1, 0.3, 1)` | 通用减速 |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 小元素入场（FAB、角标） |

**硬性规则**：
- 只动画 `transform` / `opacity`。**禁止**动画 `width / height / top / left / margin / padding`
- H5 端必须处理 `@media (prefers-reduced-motion: reduce)`：全部过渡降为 0ms
- 小程序端不使用 CSS `filter` 动画（部分安卓机 GPU 掉帧）

### 2.7 变量命名约定（Figma → tokens.json → 代码）

三层命名必须一次说清，否则 D1 生成器无从下手。**Figma 变量名**是给人看的，**tokens.json 路径**是给工具看的，**代码变量名**是给构建用的：

| Figma 变量名 | tokens.json 路径 | CSS 自定义属性 | SCSS 变量 |
|---|---|---|---|
| `color/bg/base` | `color.bg.base` | `--color-bg-base` | `$color-bg-base` |
| `color/bg/subtle` | `color.bg.subtle` | `--color-bg-subtle` | `$color-bg-subtle` |
| `color/line` | `color.line.default` | `--color-line` | `$color-line` |
| `color/accent` | `color.accent.default` | `--color-accent` | `$color-accent` |
| `color/accent/soft` | `color.accent.soft` | `--color-accent-soft` | `$color-accent-soft` |
| `color/success` | `color.semantic.success` | `--color-success` | `$color-success` |
| `font/size/h2` | `font.size.h2` | `--fs-h2` | `$fs-h2` |
| `space/4` | `space.4` | `--sp-4` | `$sp-4` |
| `radius/lg` | `radius.lg` | `--r-lg` | `$r-lg` |
| `shadow/1` | `shadow.1` | `--sh-1` | `$sh-1` |
| `motion/duration/base` | `motion.duration.base` | `--dur-base` | `$dur-base` |
| `motion/easing/standard` | `motion.easing.standard` | `--ease-std` | `$ease-std` |

**生成规则**（写成脚本里的注释，别靠记）：

1. 路径末段为 `default` 时**省略**（`color.accent.default` → `--color-accent`）
2. `semantic` 段**省略**（`color.semantic.success` → `--color-success`）
3. 分组前缀缩写：`font.size` → `fs-`、`space` → `sp-`、`radius` → `r-`、`shadow` → `sh-`、`motion.duration` → `dur-`、`motion.easing` → `ease-`；其余按原路径用 `-` 连接
4. 每组同时产出 **SCSS 变量**与 **CSS 自定义属性**两份形态（§2 开头已说明原因）

> 组件库主题映射（§4.3）消费的是 **SCSS 变量**那一份。

---

## 3. 适配规则

### 3.1 设计稿基准

- **画板尺寸：375 × 812（iPhone X 逻辑像素，1x）**
- **换算：设计稿 1px = 代码 2rpx**（uni-app 中 750rpx = 屏幕宽度）
- 间距必须落在 4px 的倍数上，否则换算后会出现 0.5rpx 的碎值

### 3.2 安全区

| 区域 | 小程序 | H5 | 统一方案 |
|---|---|---|---|
| 顶部 | 状态栏（`getSystemInfoSync().statusBarHeight`） | 无 | 自定义导航页面用 `padding-top: calc(var(--status-bar-h) + 44px)` |
| 底部 | home indicator（`safeArea.bottom`） | `env(safe-area-inset-bottom)` | 统一产出 CSS 变量 `--safe-bottom`，底部固定元素 `padding-bottom: var(--safe-bottom)` |

FAB、底部抽屉、自定义 tabBar 三个位置**必须**处理底部安全区，这是"是否做过真机适配"的最直接判断点。

### 3.3 H5 宽屏

- 内容容器 `max-width: 480px; margin: 0 auto;`
- 两侧露出底色 `#F2F0E9`，并加 `box-shadow: 0 0 24px rgba(44,44,42,0.06)` 制造"手机壳"感
- uni-app 需配置 `rpxCalcMaxDeviceWidth`（默认 960），超过后按最大宽度换算，避免大屏上间距被拉爆

### 3.4 经典移动端坑位（必须处理）

| 问题 | 解法 |
|---|---|
| 1px 边框在 2x/3x 屏变粗 | `::after` + `transform: scaleY(0.5)`，`transform-origin: 0 0` |
| 弹层滚动穿透 | 小程序：`@touchmove.stop.prevent` / `page-meta` 的 `page-style="overflow:hidden"`；H5：给 `body` 加 `overflow:hidden` 并记录滚动位置 |
| 长文本溢出 | 单行 `text-overflow: ellipsis`；多行用 `-webkit-line-clamp: 2` |
| 按钮点击无反馈 | 全局 `hover-class`（小程序）/ `:active { transform: scale(0.98) }`（H5） |
| iOS 键盘顶起页面 | `input` 用 `adjust-position`，或改用 `cursor-spacing` 控制间距 |
| canvas 高清屏模糊 | `canvas.width = cssWidth * dpr`，再 `ctx.scale(dpr, dpr)` |

---

## 4. 组件清单

> 来源分三层：**自研（视觉型）** / **外采（交互型，Wot Design Uni）** / **自研（亮点型，绝不外采）**。
> 判定口径：价值在「视觉表达」就自研，价值在「交互复杂度」就外采。完整论证见 `ARCHITECTURE.md` §1.2。

### 4.1 自研原子组件（7 个）

| 组件 | 变体 | 规格要点 |
|---|---|---|
| `Button` | `primary` / `ghost` / `text` / `danger`；尺寸 `lg`(88rpx高) / `md`(72rpx) / `sm`(56rpx) | 圆角 `--r-full`，按压 `scale(0.98)`，`loading` 态内置 |
| `Cell` | `default` / `clickable` / `with-arrow` | 左侧 label（`--fs-body`）+ 右侧 value（次要色），最小高度 88rpx |
| `Card` | `flat` / `elevated` | 圆角 `--r-lg`，内边距 `--sp-4`，`elevated` 用 `--sh-1` |
| `Tag` | `soft` / `outline`；语义色 5 种 | 圆角 `--r-sm`，字号 `--fs-tiny`，内边距 4×8 |
| `Avatar` | 尺寸 `md`(80rpx) / `sm`(56rpx) | 圆角 `--r-full`，用于分类图标 |
| `Skeleton` | `line` / `card` / `list` | 底色 `--color-bg-subtle`，shimmer 动画 1.6s 循环 |
| `Empty` | `no-data` / `no-network` / `error` | 插画 + 一句说明 + 一个主操作按钮 |

> 原清单中的 `Popup` 已**移出**：浮层涉及遮罩、进出动画、滚动穿透、层级管理，属典型「交互复杂度」组件，改由 `wd-popup` / `wd-action-sheet` / `wd-message-box` 承担。

### 4.2 外采组件（Wot Design Uni 1.14.0，按需引入）

接入方式：`pages.json → easycom.custom` 配置 `"^wd-(.*)": "wot-design-uni/components/wd-$1/wd-$1.vue"`，**只有模板里真实出现过的组件才会进包**。

| 组件 | 用在哪 | 我们依赖它的什么 |
|---|---|---|
| `wd-datetime-picker` | 详情页「时间」、确认卡时间字段 | 三段式滚轮 + 惯性滚动 + 闰月/范围等边界，跨端一致 |
| `wd-action-sheet` | 分类选择「更多」底部抽屉 | 底部面板 + 遮罩 + 滚动穿透治理 |
| `wd-popup` | 通用浮层容器（如识别结果覆盖层） | 定位、进出动画、遮罩、层级管理 |
| `wd-message-box` | 删除账单 / 清理缓存二次确认 | 居中对话框 + Promise 式 API + 键盘避让 |
| `wd-toast` | 轻提示（「已保存」「已复制」） | 自动消失、可重复调用、图标态 |
| `wd-img` | 详情页小票原图预览 | 点击放大 + 双指缩放 + 多图切换 + 关闭手势 |
| `wd-swipe-action` | 首页列表左滑删除（**可选**，与详情页删除并存） | 惯性滑动 + 点击收回 + 同时只开一个 |
| `wd-switch` | 我的页「提醒 / 性能上报」开关 | 受控状态 + 动画 + 禁用态 |
| `wd-loadmore` | 首页上拉加载更多 | 加载中 / 无更多 / 失败重试三态 |
| `wd-number-keyboard` | 金额输入（详情页、手动录入表单） | 自带数字键盘 + 小数点校验，避免系统键盘顶起页面 |

**四条硬约束**：

1. **禁止**直接用未做主题映射的组件库组件——所有 `wd-*` 的主色/文字/背景必须来自 §4.3 的映射。
2. 组件库默认是 Vant 风（主色 `#4D80F0` 蓝紫），**不做映射就会与本设计稿「精神分裂」**。
3. `wd-toast` / `wd-message-box` 在 uni-app 中**无法全局挂载**，必须在页面模板里写标签 → 统一走 `components/biz/Feedback.vue`，每个页面只引一次。
4. 引入前须确认 `sass` 版本 **≤ 1.78.0**（Dart Sass 3.x 废弃 API，组件库未适配）。

**预算与取舍**：主包内组件库增量 **≤ 150KB**；超标时按上表**从后往前砍**（先 `wd-swipe-action` / `wd-number-keyboard`）。

### 4.3 组件库主题变量映射（Design Token → `--wot-*`）

**机制**：Wot 的组件级变量**全部从基础变量派生**，因此覆盖基础变量即可让绝大多数组件自动贴合设计稿。落点 `src/styles/wot-theme.scss`。

**一级映射**（已对照 1.14.0 源码 `components/common/abstracts/variable.scss` 逐条核对）：

| Wot 变量 | 默认值 | 映射到我们的 token |
|---|---|---|
| `--wot-color-theme` | `#4D80F0` | `color/accent` `#E8663D` |
| `--wot-color-success` | `#34d19d` | `color/success` `#2F8F7A` |
| `--wot-color-warning` | `#f0883a` | `color/warning` `#D9952B` |
| `--wot-color-danger` | `#fa4350` | `color/danger` `#C4453C` |
| `--wot-color-info` | `#909399` | `color/info` `#5B7A8C` |
| `--wot-color-title` | `#000000` | `color/text/primary` `#2C2C2A` |
| `--wot-color-content` | `#262626` | `color/text/primary` `#2C2C2A` |
| `--wot-color-secondary` | `#595959` | `color/text/secondary` `#6B6A64` |
| `--wot-color-aid` | `#8c8c8c` | `color/text/secondary` `#6B6A64` |
| `--wot-color-tip` | `#bfbfbf` | `color/text/tertiary` `#9C9A92` |
| `--wot-color-border` | `#d9d9d9` | `color/line/strong` `rgba(44,44,42,.16)` |
| `--wot-color-border-light` | `#e8e8e8` | `color/line` `rgba(44,44,42,.08)` |
| `--wot-color-bg` | `#f5f5f5` | `color/bg/subtle` `#F2F0E9` |
| `--wot-overlay-bg` | `rgba(0,0,0,.65)` | `color/bg/mask` `rgba(44,44,42,.45)` |
| `--wot-fs-big` | 24px | `--fs-h1` 22px |
| `--wot-fs-title` | 16px | `--fs-h2` 17px |
| `--wot-fs-content` | 14px | `--fs-body` 15px |
| `--wot-fs-secondary` | 12px | `--fs-caption` 13px |
| `--wot-fs-aid` | 10px | `--fs-tiny` 11px |
| `--wot-size-side-padding` | 15px | `--sp-4` 16px |
| `--wot-size-side-padding-small` | 6px | `--sp-1` 4px |

**不要覆盖**：`--wot-color-white` / `--wot-color-black` —— 它们参与组件内部 `mix()` 混色计算，改了会出现脏色。
**未列出的变量保持默认**：只映射我们实际引入的组件会用到的变量；后续新增引入组件时再补。

**二级映射**（按实际引入的组件逐条覆盖）——Wot 有部分组件变量是硬编码 rgba，不随基础变量变化，必须单独覆盖：

| Wot 变量 | 默认值 | 覆盖为 |
|---|---|---|
| `--wot-action-sheet-color` | `rgba(0,0,0,.85)` | `color/text/primary` |
| `--wot-action-sheet-subname-color` | `rgba(0,0,0,.45)` | `color/text/secondary` |
| `--wot-action-sheet-active-color` | `$-color-bg` | `color/accent-soft` `#FBEDE7` |
| `--wot-action-sheet-cancel-bg` | `rgba(240,240,240,1)` | `color/bg/subtle` |
| `--wot-action-sheet-radius` | 16px | `--r-xl` 20px（对齐底部抽屉规格） |
| `--wot-message-box-title-color` | `rgba(0,0,0,.85)` | `color/text/primary` |
| `--wot-message-box-content-color` | `#666666` | `color/text/secondary` |
| `--wot-toast-radius` | 8px | `--r-md` 12px |
| `--wot-toast-fs` | 14px | `--fs-body` 15px |
| `--wot-switch-border-color` | `#e5e5e5` | `color/line/strong` |
| `--wot-switch-inactive-color` | `#eaeaea` | `color/bg/subtle` |
| `--wot-loadmore-color` | `rgba(0,0,0,.45)` | `color/text/tertiary` |
| `--wot-input-border-color` | `#dadada` | `color/line/strong` |
| `--wot-input-bg` | `#ffffff` | `color/bg/surface` |
| `--wot-popup-close-color` | `#666666` | `color/text/secondary` |

> 上表是**已核对到的部分**，不是穷举。D3 实施时以 `node_modules/wot-design-uni/components/common/abstracts/variable.scss` 为准补齐，**只补我们实际引入的那几个组件**，避免无谓的 override 债。

**写法**（`src/styles/wot-theme.scss`）：

```scss
@import './tokens';        // 提供 SCSS 变量：$color-accent / $fs-h2 / $sp-4 …

:root,                     // H5：组件库默认值挂在 :root
page {                     // 小程序：组件库默认值挂在 page
  // —— 一级映射 ——          （两个选择器都要写，只写一个会单端失效）
  --wot-color-theme:   #{$color-accent};
  --wot-color-success: #{$color-success};
  --wot-color-danger:  #{$color-danger};
  --wot-color-bg:      #{$color-bg-subtle};
  --wot-fs-title:      #{$fs-h2};
  --wot-size-side-padding: #{$sp-4};

  // —— 二级映射 ——（只覆盖实际引入的组件，逐条注释原因）
  --wot-action-sheet-radius: #{$r-xl};
  --wot-toast-radius:        #{$r-md};
}
```

**生效性验收（必做，否则等于没映射）**：改 `design/tokens/tokens.json` 的 `color/accent` → 跑 `npm run gen:scss` → **双端**确认 `wd-button`(primary) / `wd-action-sheet` 选中态 / `wd-switch` 打开态主色同步变化。

**备选路径**：若小程序端全局覆盖被组件库样式加载顺序压制，改用 `wd-config-provider` 的 `theme-vars` + `@uni-ku/root` 虚拟根组件（多一个构建期插件，代价可接受）。

### 4.4 业务组件（6 个）

| 组件 | 说明 |
|---|---|
| `RecordItem` | 账单列表项：左侧 Avatar（分类色）+ 分类名/备注/时间，右侧金额（支出墨黑 / 收入青绿），右下角 `SyncBadge` |
| `SyncBadge` | 同步状态：`待同步`(琥珀点) / `同步中`(旋转) / `失败`(陶红点，可点重试) / 已同步(不显示) |
| `CategoryPicker` | 分类选择：横向滚动的分类胶囊 + 「更多」唤起 `wd-action-sheet` |
| `ConfirmCard` | 识别结果确认卡：图片缩略 + 4 个可编辑字段 + 置信度提示条（降级时显示琥珀条）+ 确认/重拍 |
| `DonutChart` | canvas 2d 环形图：中心显示总额，外环按分类占比着色，扇区点击可高亮对应分类 |
| `Feedback` | 全局反馈载体：内含 `<wd-toast />` + `<wd-message-box />` 标签 + `useToast/useMessage` 薄封装。**每个页面模板引入一次**（uni-app 不支持全局挂载组件） |

---

## 5. 页面规格

### 5.1 页面清单

| 页面 | 路由 | 分包 | 导航 |
|---|---|---|---|
| 首页（账单） | `pages/index/index` | 主包 | 自定义导航（标题随滚动淡入） |
| 统计 | `pages-stats/index` | 分包 + 预下载 | 自定义导航 |
| 我的 | `pages/profile/index` | 主包 | 自定义导航 |
| 拍照识别 | `pages-capture/index` | **独立分包** | 无导航（全屏取景器） |
| 账单详情 | `pages-detail/index` | 分包 | 返回 + 更多（删除） |
| 分类选择 | 组件内抽屉 | — | — |

tabBar：**首页 / 统计 / 我的**（3 项，图标用 iconfont 字体，选中态用 `color/accent`）

### 5.2 首页

```
┌─────────────────────────────────┐  ← 375 宽，页面边距 16px
│  9月                       ⌄    │  ← 月份切换，--fs-h2，右侧箭头
│                                 │
│  ¥ 3,842.50          [68rpx]    │  ← 本月总支出，--fs-display，焦点
│  较上月 ↓ 12.4%                  │  ← 环比，--fs-caption，下降用 success
│                                 │
│  ┌───────────────────────────┐  │  ← Card, --sh-1, --r-lg
│  │ ● 餐饮  ¥1,280  33%       │  │  ← 前三分类速览（Progress 条）
│  │ ● 交通  ¥620    16%       │  │
│  │ ● 购物  ¥540    14%       │  │
│  └───────────────────────────┘  │
│                                 │
│  [全部] [餐饮] [交通] [购物] →  │  ← 分类筛选胶囊，选中 accent/soft 底
│                                 │
│  今天                           │  ← 日期分组标题，--fs-caption 次要色
│  ├ Avatar 餐饮   ¥38.50         │  ← RecordItem，行高 112rpx
│  │  肯德基 · 12:30              │
│  ├ Avatar 交通   ¥12.00         │
│  │  地铁 · 08:15                │
│                                 │
│  昨天                           │
│  ├ ...                          │
│                                 │
│                          ╭────╮ │  ← FAB 112rpx 圆，accent 色，--sh-2
│                          │ 相机│ │     距右 16px，距底 safe-area + 24px
│                          ╰────╯ │
├─────────────────────────────────┤
│    ▣ 首页      ◎ 统计    ○ 我的  │  ← tabBar 100rpx + safe-area
└─────────────────────────────────┘
```

**状态**：
- 加载中：总支出区显示 `Skeleton(line, 48rpx高)`，列表显示 3 条 `Skeleton(list)`
- 空态：`Empty(no-data)` + 「拍一张开始记账」按钮，隐藏筛选条
- 离线：顶部出现 44rpx 高琥珀条「当前无网络，记账会先存在本地」
- 同步失败：对应列表项右侧 `SyncBadge(失败)`，点击弹「重试 / 查看详情」
- 下拉刷新：自定义刷新头，转圈用 accent 色

**交互**：
- 列表滚动时顶部月份标题缩为 0 高，浮出一行细标题（滚动 120rpx 触发）
- 筛选胶囊切换：列表淡出 120ms → 换数据 → 淡入 200ms（`--ease-std`）
- FAB 点击 → `uni.navigateTo` 到拍照页，触发 `uni.vibrateShort`（轻震）
- 列表项左滑 → `wd-swipe-action` 露出「删除」（**可选**：与详情页删除并存；若启用则计入 §4.2 的体积预算）

### 5.3 拍照识别（独立分包）

```
┌─────────────────────────────────┐
│  ✕                              │  ← 左上角关闭，距安全区 16px
│                                 │
│      ┌───────────────────┐      │  ← 取景框 311×411，圆角 --r-lg
│      │                   │      │     四角描边用 accent 色
│      │   相机实时预览     │      │
│      │                   │      │
│      └───────────────────┘      │
│   把小票放进框里，光线亮一点     │  ← 提示，--fs-caption
│                                 │
│        [ 相册 ]   ◉    [ 手输 ]  │  ← 相册 / 快门 144rpx / 手动录入
│                                 │
└─────────────────────────────────┘

识别中（同页覆盖）：
       ◐ 三条骨架线循环                        ← 不阻塞，可点「取消」
       正在识别… 最长 8 秒

识别完成（同页覆盖，ConfirmCard）：
┌─────────────────────────────────┐
│  ⚠ 自动识别不完全准，请确认      │  ← 降级时琥珀条；正常时不显示
│  ┌──────┐                       │
│  │ 缩略 │  ¥ 38.50      ← 可编辑 │
│  └──────┘  肯德基              │
│            餐饮 ▾  [今天 12:30] │
│            备注……              │
│                                 │
│  [ 重拍 ]        [ 确认保存 ]    │  ← 主按钮 accent，88rpx 高
└─────────────────────────────────┘
```

**状态**：
- 未授权相机：取景框替换为 `Empty` + 「去开启相机权限」按钮（`openSetting`）；同时保留下方「相册 / 手输」入口 —— **授权被拒必须有出路**
- 识别超时：ConfirmCard 显示 L0 规则识别结果 + 琥珀条
- 识别全失败：直接跳到手动录入表单（字段全空），不弹错误

**浮层策略**：结果确认卡在页内覆盖，用自研绝对定位 `view`（轻量、无需引组件）；分类抽屉与通用弹层统一走 `wd-popup` / `wd-action-sheet`（自带滚动穿透治理）；二次确认走 `wd-message-box`。

### 5.4 统计

```
│  2026年9月                  ⌄    │
│  ┌───────────────────────────┐  │
│  │      ╭───────╮            │  │  ← canvas 环图 400rpx
│  │     ╱  3,842  ╲           │  │     中心：总额 --fs-h2
│  │    │   本月    │           │  │
│  │     ╲         ╱            │  │
│  │      ╰───────╯            │  │
│  │  日均 ¥128  较上月 ↓12.4%  │  │
│  └───────────────────────────┘  │
│                                 │
│  分类明细                        │
│  ├ ● 餐饮    ¥1,280  33%  12笔  │  ← 占比条：底色 subtle，填充分类色
│  ├ ● 交通    ¥620    16%   8笔  │
│  ├ ● 购物    ¥540    14%   5笔  │
│  └ ...                          │
```

**状态**：空态 → `Empty(no-data)` + 「本月还没有记账」；环图数据为 0 时画一个 100% 的 `color/bg/subtle` 灰环，不显示"0%"标签。

**交互**：点击环图扇区 → 该分类在明细列表高亮（背景闪一次 `accent/soft`）；明细列表行点击 → 跳到首页并带上该分类筛选。

### 5.5 账单详情

```
│  ←                               │
│  ┌───────────────────────────┐  │  ← 有图片时展示，否则整块不出现
│  │        小票原图            │  │     点击可全屏预览（预览后 3s 自动收起）
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 金额          ¥ 38.50     │  │  ← 数字用 tabular-nums 右对齐
│  │ 类型          支出 ▾      │  │
│  │ 分类          餐饮 ▾      │  │
│  │ 商家          肯德基      │  │
│  │ 时间          今天 12:30  │  │
│  │ 备注          点击填写    │  │
│  └───────────────────────────┘  │
│  识别信息  多模态识别 · 置信 0.92 │  ← --fs-tiny 次要色，可展开看耗时
│                                 │
│  ┌───────────────────────────┐  │
│  │         删除这笔账单       │  │  ← 文字按钮，danger 色，居中
│  └───────────────────────────┘  │
```

**字段控件映射**：金额 → `wd-number-keyboard`（自带数字键盘，避免系统键盘顶起页面）；时间 → `wd-datetime-picker`；分类 → `CategoryPicker`（内含 `wd-action-sheet`）；小票原图 → `wd-img` 预览（点击放大 + 双指缩放）。

**修改即保存**（无"保存"按钮）：字段失焦或选择完成即写入本地 → 入同步队列 → 顶部出现「已保存」轻提示 1.5s 后消失。
**删除**：二次确认走 `wd-message-box`（措辞含金额），确认后返回首页并播放列表项收起动画。

### 5.6 我的

```
│  ┌───────────────────────────┐  │
│  │ ◯  记账小能手              │  │  ← 小程序：微信头像昵称；H5：默认头像 + "本机用户"
│  │    已记账 128 笔 · 92 天   │  │     H5 端提供「绑定手机号」入口（可选）
│  └───────────────────────────┘  │
│  数据                            │
│  ├ 每日记账提醒           [开关] │  ← 开关时申请一次性订阅消息
│  ├ 数据同步               已同步 │
│  └ 清理本地缓存           12.4MB │
│  隐私与关于                       │
│  ├ 隐私保护指引              →   │
│  ├ 性能数据上报          [开关] │
│  └ 版本号 v1.0.0  (连点 5 次)   │  ← 隐藏入口 → 开发面板
```

**控件**：两个开关用 `wd-switch`（受控 + 主题映射后的 accent 色）；「版本号连点 5 次」的隐藏入口用自研 `Cell` 实现。

**开发面板**（隐藏页）：T1 冷启动耗时、本页 setData 数据量、接口耗时 TOP5、错误日志——面试演示用。

---

## 6. 全局交互规范

| 场景 | 规范 |
|---|---|
| 主按钮 | 一屏最多 1 个 `primary` 按钮 |
| 轻提示 | `wd-toast` 居中，1.5s 自动消失，不用 alert；统一经 `Feedback` 组件的 `useToast()` 调用 |
| 二次确认 | 破坏性操作（删除、清缓存）必须走 `wd-message-box`，措辞含对象名（"删除这笔 ¥38.50 的账单？"） |
| 浮层 | 一律用 `wd-popup` / `wd-action-sheet`（滚动穿透已由组件库治理）；禁止自己写遮罩层 |
| 金额输入 | 用 `wd-number-keyboard` 或带 `type="digit"` 的输入框，不用 `type="number"`（iOS 无小数点） |
| 数字格式 | 金额 `¥ 1,280.00`（千分位 + 2 位小数）；统计页大数字可省略小数 |
| 时间格式 | 今天 `12:30`；昨天 `昨天 12:30`；本年 `9月20日`；跨年 `2025/9/20` |
| 空态文案 | 说明现状 + 给出下一步动作，不写"暂无数据" |
| 错误文案 | 说清楚发生了什么 + 用户能做什么，不暴露技术细节 |
| 加载 | 超过 300ms 才显示 Loading（避免闪烁）；超过 8s 显示"网络较慢，仍在努力" |
| 组件库使用 | 页面里不得出现未做主题映射的 `wd-*` 组件；新增引入前先确认主包预算（§4.2） |

---

## 7. Figma 工作流（本项目重点）

### 7.1 账号与文件设置

1. 注册 Figma 免费版（Starter，够用：个人可建 3 个文件）
2. 新建 1 个 Design File，命名 `一拍记 SnapLedger — Design System & Screens`
3. 页面（左侧 Pages 面板）固定 5 个：

| 页面 | 内容 |
|---|---|
| `00 Cover` | 项目名、版本、日期、设计说明三行 |
| `01 Foundations` | 色板、字阶、间距标尺、圆角、阴影、图标集 |
| `02 Components` | 自研 7 个原子组件 + 6 个业务组件（每组带 Variants）+ 实际引入的 `wd-*` 组件按映射后的观感示意 |
| `03 Screens` | 5 个页面 + 每个页面的状态变体（加载/空/错误） |
| `04 Prototype` | 首页 → 拍照 → 确认卡 → 首页 的主流程连线 |

### 7.2 命名规范（面试官会看，体现专业度）

| 对象 | 规范 | 正例 | 反例 |
|---|---|---|---|
| 页面 Frame | `P/页面名` | `P/首页` | `Frame 427` |
| 组件 | `C/组件名/变体` | `C/Button/Primary` | `Rectangle 12` |
| 变量 | `分组/名称` | `color/accent`、`space/4` | `#E8663D` |
| 图层组 | 语义化 | `Header`、`TotalAmount` | `Group 8` |

### 7.3 设计稿生成加速（关键：省 1–2 天手工拖拽）

我提供 **Figma 插件脚本**（`design/figma-plugin/`），在 Figma 里一键生成：

- `01 Foundations` 的全部色板卡片、字阶示例、间距标尺
- `02 Components` 的自研 7 个原子组件（含 Variants，Auto Layout 已配好）**+ 外采组件的"映射后观感"示意图**——外采组件的最终外观由 §4.3 的主题映射决定，因此设计稿里必须把它按映射后的样子画出来，否则 §7.6 的还原度对比没有基准
- `03 Screens` 的 5 个页面骨架（Auto Layout 结构 + 真实文案，无图片占位）

你的工作从「从零拖拽」变成「在生成结果上改细节」——**而改细节的过程正好是你学 Auto Layout / Variables / Variants 的过程**。

插件使用方式（D1 交付时会给完整说明）：
1. Figma → `Plugins` → `Development` → `Import plugin from manifest…`
2. 选择 `design/figma-plugin/manifest.json`
3. 打开设计文件 → 运行 `SnapLedger UI Kit Generator` → 等待生成

插件技术要点：Figma Plugin API 的 `createFrame` / `layoutMode` / `createText` / `createComponent` + `figma.variables.createVariable`；新版 API 需要 `await figma.setCurrentPageAsync()` 与 `documentAccess: "dynamic-page"`。

### 7.4 Tokens 单一来源 → 代码

```
Figma Variables
   └─(导出 JSON)─► design/tokens/tokens.json
        └─(脚本 gen:scss)─► src/styles/tokens.scss   ← 代码里唯一允许写值的地方
             └─► 组件只引用 var(--color-accent)，不写死色值
```

`tokens.json` 结构示例：

```json
{
  "color": { "accent": { "$value": "#E8663D", "$type": "color" },
             "bg": { "base": { "$value": "#FAF9F5", "$type": "color" } } },
  "space": { "4": { "$value": "16px", "$type": "dimension" } },
  "radius": { "lg": { "$value": "16px", "$type": "dimension" } }
}
```

改一次设计稿颜色 → 跑一次脚本 → 全端生效。**这就是"设计系统与代码单一来源"，是可写进简历的工程化点**。

### 7.5 设计稿 → 代码（三条路，按推荐度排序）

| 方式 | 工具 | 适用 | 注意 |
|---|---|---|---|
| ① 对照手写（推荐主力） | Figma Dev Mode 面板（免费版可查尺寸/色值/间距） | 复杂交互页面 | 最可控，且能真正学到设计规范 |
| ② AI 转码（提效） | 已确认可用技能 `figma-to-code` | 结构规整的静态区块 | 输出是 `div/span`，**需二次适配为 uni-app 的 `view/text`**；这个「转码适配」本身可以作为一个技术点写 |
| ③ MCP 直读 | `figma-developer-mcp`（Personal Access Token，免费可用）或官方 Dev Mode MCP（需付费 Seat） | 批量读取设计变量 | 网络依赖，仅作辅助 |

> **注意**：官方 Figma Dev Mode MCP 需要 Dev/Full 付费席位；免费的 Starter 账号请走方式 ① 或第三方 MCP。

### 7.6 还原度验收（形成工程闭环）

每完成一个页面，用已确认可用的 `ui-review` 技能，输入「设计稿图片 + 真机截图」，产出：

- 七类问题的检查报告（乱版 / 错位 / 圆角边框边距 / 溢出 / 叠加 / 未展示完全 / 颜色偏差）
- 五级严重度的 `fix-task.md` 任务书

把这个报告截图存档到 `design/screenshots/`，是「我做过设计稿还原」的硬证据。

---

## 8. UI 相关交付物清单

| # | 交付物 | 位置 |
|---|---|---|
| 1 | Figma 设计文件（可只读分享） | Figma 链接，写进 README |
| 2 | Figma 插件脚本 | `design/figma-plugin/` |
| 3 | Design Tokens 源文件 | `design/tokens/tokens.json` |
| 4 | 主题样式（自动生成，含 SCSS 变量 + CSS 自定义属性两份形态） | `src/styles/tokens.scss` |
| 5 | **组件库主题映射**（Design Token → `--wot-*`） | `src/styles/wot-theme.scss` |
| 6 | 自研 7 个原子组件 + 6 个业务组件 | `src/components/` |
| 7 | 外采组件清单与体积账（含砍掉的组件及原因） | `docs/PERF_REPORT.md` |
| 8 | 双端页面截图对照 | `design/screenshots/` |
| 9 | 还原度验收报告 | `design/screenshots/ui-review-*.md` |
