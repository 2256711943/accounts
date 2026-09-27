/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SnapLedger UI Kit Generator —— 一拍记 Figma 设计稿生成插件
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 作用：在 Figma 里一键生成设计基建，把「从零拖拽」变成「在生成结果上改细节」
 *      （UI_SPEC.md §7.3）。生成内容：
 *        00 Cover          项目名 / 版本 / 设计说明
 *        01 Foundations    色板 · 字阶 · 间距标尺 · 圆角 · 阴影 · 图标集
 *        02 Components     自研 7 个原子组件（含 Variants）+ 外采组件「映射后观感」示意
 *        03 Screens        5 个页面 + 状态变体（加载 / 空 / 错误 / 离线）
 *        04 Prototype       首页 → 拍照 → 确认卡 → 首页 主流程连线
 *
 * 命名规范见 UI_SPEC.md §7.2：`P/页面名`、`C/组件名/变体`、`分组/名称`。
 *
 * ── 文件结构 ──────────────────────────────────────────────────────────────────
 *   ① TOKENS:[BEGIN..END]   自动生成区，由 `npm run gen:figma` 从
 *                           design/tokens/tokens.json 注入（勿手改）
 *   ② 以下全部手写：工具函数 → 节点工厂 → 变量 → 各页面生成器
 *
 * ── 为什么 Token 是注入的 ──────────────────────────────────────────────────────
 *   Figma 插件（无打包器）只能加载单个 JS 文件，读不到磁盘上的 tokens.json。
 *   若手写一份色值副本，"单一来源" 立刻破裂且无从发现。所以绘制逻辑手写、
 *   Token 数据注入，改名/改值只改 tokens.json。
 *
 * ── 重新运行 ──────────────────────────────────────────────────────────────────
 *   本插件**幂等**：会先清空同名页面再重建。请在专用文件里运行，
 *   不要在有手工成果的文件里跑（会丢掉那 5 个 Page 上的所有内容）。
 *
 * 需要 Figma Plugin API 的 `documentAccess: "dynamic-page"`（见 manifest.json）。
 */

/* eslint-disable */
// @ts-nocheck

// >>> TOKENS:BEGIN
// ⚠️ 本区块由 `npm run gen:figma` 从 design/tokens/tokens.json 自动注入，请勿手改！
//    手改会在下次生成时被覆盖；要改数据请改 tokens.json。
//    源版本：1.2.0　导出日期：2026-09-26

const TOKENS_META = {
  name: "SnapLedger Design Tokens",
  version: "1.2.0",
  updatedAt: "2026-09-26",
  source: "视觉方向 C（亮白现代感 · 紫罗兰）定稿；Figma Variables 需按本文件回写",
};

const TOKENS = [
  { path: "color.bg.base", figmaName: "color/bg/base", name: "color-bg-base", value: "#FAFAFC", type: "color", description: "页面底色（近白微冷；刻意不用纯白，让纯白卡片有边界）" },
  { path: "color.bg.surface", figmaName: "color/bg/surface", name: "color-bg-surface", value: "#FFFFFF", type: "color", description: "卡片、列表项" },
  { path: "color.bg.subtle", figmaName: "color/bg/subtle", name: "color-bg-subtle", value: "#F0F0F5", type: "color", description: "次级块、标签底、骨架屏底" },
  { path: "color.bg.mask", figmaName: "color/bg/mask", name: "color-bg-mask", value: "rgba(24,16,56,0.46)", type: "color", description: "弹层遮罩" },
  { path: "color.line.default", figmaName: "color/line", name: "color-line", value: "rgba(24,16,56,0.07)", type: "color", description: "必要分割线，尽量少用" },
  { path: "color.line.strong", figmaName: "color/line/strong", name: "color-line-strong", value: "rgba(24,16,56,0.14)", type: "color", description: "输入框边框、需强调的分隔" },
  { path: "color.text.primary", figmaName: "color/text/primary", name: "color-text-primary", value: "#17141F", type: "color", description: "主文案、支出金额" },
  { path: "color.text.secondary", figmaName: "color/text/secondary", name: "color-text-secondary", value: "#5E5A6E", type: "color", description: "辅助说明、时间、分类名" },
  { path: "color.text.tertiary", figmaName: "color/text/tertiary", name: "color-text-tertiary", value: "#9793A3", type: "color", description: "占位符、禁用态" },
  { path: "color.text.inverse", figmaName: "color/text/inverse", name: "color-text-inverse", value: "#FFFFFF", type: "color", description: "深底上的文字" },
  { path: "color.accent.default", figmaName: "color/accent", name: "color-accent", value: "#6C4BFF", type: "color", description: "唯一强调色：主按钮、FAB、选中态" },
  { path: "color.accent.pressed", figmaName: "color/accent/pressed", name: "color-accent-pressed", value: "#5433DB", type: "color", description: "按压态" },
  { path: "color.accent.soft", figmaName: "color/accent/soft", name: "color-accent-soft", value: "#EEE9FF", type: "color", description: "强调色浅底（选中标签）" },
  { path: "color.semantic.success", figmaName: "color/success", name: "color-success", value: "#12A594", type: "color", description: "收入金额、同步成功" },
  { path: "color.semantic.warning", figmaName: "color/warning", name: "color-warning", value: "#F0A32B", type: "color", description: "待同步、识别降级" },
  { path: "color.semantic.danger", figmaName: "color/danger", name: "color-danger", value: "#E0464B", type: "color", description: "删除、同步失败" },
  { path: "color.semantic.info", figmaName: "color/info", name: "color-info", value: "#6C7B99", type: "color", description: "中性提示（雾蓝）" },
  { path: "color.chart.c1", figmaName: "color/chart/c1", name: "color-chart-c1", value: "#6C4BFF", type: "color" },
  { path: "color.chart.c2", figmaName: "color/chart/c2", name: "color-chart-c2", value: "#12A594", type: "color" },
  { path: "color.chart.c3", figmaName: "color/chart/c3", name: "color-chart-c3", value: "#F0A32B", type: "color" },
  { path: "color.chart.c4", figmaName: "color/chart/c4", name: "color-chart-c4", value: "#FF6B9A", type: "color" },
  { path: "color.chart.c5", figmaName: "color/chart/c5", name: "color-chart-c5", value: "#7C8AA5", type: "color" },
  { path: "font.family.sans", figmaName: "font/family/sans", name: "font-family-sans", value: "-apple-system, \"PingFang SC\", \"HarmonyOS Sans SC\", \"Noto Sans SC\", \"Microsoft YaHei\", sans-serif", type: "fontFamily" },
  { path: "font.size.display", figmaName: "font/size/display", name: "fs-display", value: "40px", type: "dimension", description: "80rpx 首页本月总支出" },
  { path: "font.size.h1", figmaName: "font/size/h1", name: "fs-h1", value: "25px", type: "dimension", description: "50rpx 页面大标题" },
  { path: "font.size.h2", figmaName: "font/size/h2", name: "fs-h2", value: "18px", type: "dimension", description: "36rpx 区块标题" },
  { path: "font.size.body", figmaName: "font/size/body", name: "fs-body", value: "15px", type: "dimension", description: "30rpx 列表主文案" },
  { path: "font.size.caption", figmaName: "font/size/caption", name: "fs-caption", value: "13px", type: "dimension", description: "26rpx 辅助说明" },
  { path: "font.size.tiny", figmaName: "font/size/tiny", name: "fs-tiny", value: "11px", type: "dimension", description: "22rpx 标签、角标" },
  { path: "font.weight.regular", figmaName: "font/weight/regular", name: "font-weight-regular", value: 400, type: "fontWeight" },
  { path: "font.weight.medium", figmaName: "font/weight/medium", name: "font-weight-medium", value: 500, type: "fontWeight", description: "只有两档，再粗就廉价" },
  { path: "font.lineHeight.display", figmaName: "font/lineHeight/display", name: "font-line-height-display", value: 1.15, type: "number" },
  { path: "font.lineHeight.h1", figmaName: "font/lineHeight/h1", name: "font-line-height-h1", value: 1.3, type: "number" },
  { path: "font.lineHeight.h2", figmaName: "font/lineHeight/h2", name: "font-line-height-h2", value: 1.4, type: "number" },
  { path: "font.lineHeight.body", figmaName: "font/lineHeight/body", name: "font-line-height-body", value: 1.5, type: "number" },
  { path: "font.lineHeight.caption", figmaName: "font/lineHeight/caption", name: "font-line-height-caption", value: 1.4, type: "number" },
  { path: "space.1", figmaName: "space/1", name: "sp-1", value: "4px", type: "dimension", description: "8rpx 图标与文字间隙" },
  { path: "space.2", figmaName: "space/2", name: "sp-2", value: "8px", type: "dimension", description: "16rpx 标签内边距" },
  { path: "space.3", figmaName: "space/3", name: "sp-3", value: "12px", type: "dimension", description: "24rpx 卡片内元素间距" },
  { path: "space.4", figmaName: "space/4", name: "sp-4", value: "16px", type: "dimension", description: "32rpx 页面左右边距 / 卡片内边距" },
  { path: "space.5", figmaName: "space/5", name: "sp-5", value: "20px", type: "dimension", description: "40rpx 区块之间" },
  { path: "space.6", figmaName: "space/6", name: "sp-6", value: "24px", type: "dimension", description: "48rpx 大区块分隔" },
  { path: "space.8", figmaName: "space/8", name: "sp-8", value: "32px", type: "dimension", description: "64rpx 页面顶部大留白" },
  { path: "radius.sm", figmaName: "radius/sm", name: "r-sm", value: "10px", type: "dimension", description: "20rpx 标签、角标" },
  { path: "radius.md", figmaName: "radius/md", name: "r-md", value: "16px", type: "dimension", description: "32rpx 输入框、小卡片" },
  { path: "radius.lg", figmaName: "radius/lg", name: "r-lg", value: "22px", type: "dimension", description: "44rpx 主卡片、FAB" },
  { path: "radius.xl", figmaName: "radius/xl", name: "r-xl", value: "28px", type: "dimension", description: "56rpx 底部抽屉顶部" },
  { path: "radius.full", figmaName: "radius/full", name: "r-full", value: "999px", type: "dimension", description: "药丸按钮、头像" },
  { path: "shadow.1", figmaName: "shadow/1", name: "sh-1", value: "0 1px 2px rgba(30,20,70,0.06), 0 2px 8px rgba(30,20,70,0.05)", type: "shadow", description: "列表卡片（两层叠加，比单层更贴合）" },
  { path: "shadow.2", figmaName: "shadow/2", name: "sh-2", value: "0 12px 30px rgba(70,45,160,0.16)", type: "shadow", description: "悬浮 FAB、底部抽屉（带主色倾向）" },
  { path: "motion.duration.fast", figmaName: "motion/duration/fast", name: "dur-fast", value: "120ms", type: "duration", description: "按压反馈、标签切换" },
  { path: "motion.duration.base", figmaName: "motion/duration/base", name: "dur-base", value: "200ms", type: "duration", description: "列表项入场" },
  { path: "motion.duration.slow", figmaName: "motion/duration/slow", name: "dur-slow", value: "320ms", type: "duration", description: "页面转场、抽屉" },
  { path: "motion.easing.standard", figmaName: "motion/easing/standard", name: "ease-std", value: "cubic-bezier(0.16, 1, 0.3, 1)", type: "cubicBezier", description: "通用减速" },
  { path: "motion.easing.spring", figmaName: "motion/easing/spring", name: "ease-spring", value: "cubic-bezier(0.34, 1.56, 0.64, 1)", type: "cubicBezier", description: "小元素入场" },
  { path: "layout.designWidth", figmaName: "layout/designWidth", name: "layout-design-width", value: 375, type: "number", description: "Figma 画板宽度（1x）" },
  { path: "layout.rpxRatio", figmaName: "layout/rpxRatio", name: "layout-rpx-ratio", value: 2, type: "number", description: "设计稿 1px = 代码 2rpx" },
  { path: "layout.h5MaxWidth", figmaName: "layout/h5MaxWidth", name: "layout-h5-max-width", value: "480px", type: "dimension", description: "H5 宽屏内容容器上限" },
  { path: "layout.pagePadding", figmaName: "layout/pagePadding", name: "layout-page-padding", value: "16px", type: "dimension", description: "页面左右边距 32rpx" },
  { path: "layout.tabBarHeight", figmaName: "layout/tabBarHeight", name: "layout-tab-bar-height", value: "50px", type: "dimension", description: "100rpx，另加 --safe-bottom" },
  { path: "layout.navBarHeight", figmaName: "layout/navBarHeight", name: "layout-nav-bar-height", value: "44px", type: "dimension", description: "另加 statusBarHeight" },
  { path: "layout.fabSize", figmaName: "layout/fabSize", name: "layout-fab-size", value: "56px", type: "dimension", description: "112rpx" },
  { path: "layout.cellMinHeight", figmaName: "layout/cellMinHeight", name: "layout-cell-min-height", value: "44px", type: "dimension", description: "88rpx" },
];
// <<< TOKENS:END

/* ═══════════════════════════════════════════════════════════════════════════════
 * 1. 配置
 * ═══════════════════════════════════════════════════════════════════════════════ */

const PAGES = {
  cover: '00 Cover',
  foundations: '01 Foundations',
  components: '02 Components',
  screens: '03 Screens',
  prototype: '04 Prototype',
};

const SCREEN_W = 375; // 设计稿基准 1x（UI_SPEC §3.1）
const SCREEN_H = 812;
const TABBAR_H = 50;
const PAGE_PAD = 16;

/** 字体候选。Windows 优先「微软雅黑」，macOS 优先「苹方」；Inter 是 Figma 内置兜底（无中文）。 */
const FONT_CANDIDATES = [
  { family: 'Microsoft YaHei', regular: 'Regular', medium: 'Bold' },
  { family: 'PingFang SC', regular: 'Regular', medium: 'Medium' },
  { family: 'HarmonyOS Sans SC', regular: 'Regular', medium: 'Medium' },
  { family: 'Noto Sans SC', regular: 'Regular', medium: 'Medium' },
  { family: 'Source Han Sans SC', regular: 'Regular', medium: 'Medium' },
  { family: 'Inter', regular: 'Regular', medium: 'Medium' },
];

let FONT = { family: 'Inter', regular: 'Regular', medium: 'Medium' };

/** 运行时填充：token 名 → Figma Variable（变量创建失败时为空对象，生成照常进行） */
let COLOR_VARS = {};
let FLOAT_VARS = {};
let VARIABLES_AVAILABLE = true;

/** 运行时填充：组件集注册表，供 03 Screens 造实例用 */
const SETS = {};

/* ═══════════════════════════════════════════════════════════════════════════════
 * 2. 工具：Token 取用 / 颜色 / 提示
 * ═══════════════════════════════════════════════════════════════════════════════ */

const TOKEN_MAP = {};
for (const t of TOKENS) TOKEN_MAP[t.name] = t;

/** 取 token 原始值。取不到直接抛错（生成出来的稿子错色比崩溃更糟） */
function tk(name) {
  const t = TOKEN_MAP[name];
  if (!t) throw new Error('未知 design token: ' + name + '（检查 design/tokens/tokens.json）');
  return t.value;
}

/** 取 token 数值（dimension 形如 "16px" → 16） */
function tkNum(name) {
  return parseFloat(tk(name));
}

/** 按顶层分组取 token 列表，用于逐组绘制 Foundations */
function tokensOfGroup(group) {
  return TOKENS.filter((t) => t.path.split('.')[0] === group);
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/** "#6C4BFF" → {r,g,b}（0..1） */
function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

/** "rgba(44,44,42,0.45)" / "#2C2C2A" → {r,g,b,a} */
function parseColor(value) {
  const v = String(value).trim();
  if (v.startsWith('#')) return { ...hexToRgb(v), a: 1 };
  const m = v.match(/^rgba?\(([^)]+)\)$/);
  if (!m) throw new Error('无法解析的颜色值: ' + v);
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  return {
    r: clamp01(parts[0] / 255),
    g: clamp01(parts[1] / 255),
    b: clamp01(parts[2] / 255),
    a: parts.length > 3 ? clamp01(parts[3]) : 1,
  };
}

/** token 名 → SolidPaint；opacity 覆盖 token 自带 alpha 时传第二个参数 */
function paint(name, opacity) {
  const c = parseColor(tk(name));
  const p = { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } };
  const a = opacity != null ? opacity : c.a;
  if (a < 1) p.opacity = a;
  return p;
}

/**
 * 同 paint，但尽量把颜色**绑定到 Figma Variable**——
 * 这样改了变量稿子会跟着变，也证明 §7.4 的「Variables 是单一来源」真的成立。
 */
function paintVar(name, opacity) {
  const p = paint(name, opacity);
  const v = COLOR_VARS[name];
  if (!v) return p;
  try {
    return figma.variables.setBoundVariableForPaint(p, 'color', v);
  } catch (e) {
    return p;
  }
}

/** 把数值属性绑定到 FLOAT 变量（itemSpacing / cornerRadius / paddingLeft …） */
function bindFloat(node, prop, tokenName) {
  const v = FLOAT_VARS[tokenName];
  if (!v) return;
  try {
    node.setBoundVariable(prop, v);
  } catch (e) {
    /* 该属性不支持绑定 —— 静默跳过，不影响生成 */
  }
}

/** "0 1px 2px rgba(44,44,42,0.04)" → Figma DROP_SHADOW effect
 *  两个坑：① CSS 零值可以不带单位（0 而非 0px）→ 单位用 (?:px)? 而非 px?；
 *          ② `px?` 的语义是「p + 可选 x」，会把 p 变成必填，写法是错的
 *  v1.2 起 token 允许两层叠加（"a, b"）→ 返回效果数组；
 *  拆层时必须忽略括号内的逗号（rgba(30,20,70,0.06) 自带 3 个逗号）。 */
const SHADOW_LAYER_RE =
  /^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?(?:\s+(-?[\d.]+)(?:px)?)?\s+(rgba?\([^)]+\))$/;

function shadowEffect(tokenName) {
  const raw = String(tk(tokenName));
  const layers = [];
  let depth = 0;
  let buf = '';
  for (const ch of raw) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      layers.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  layers.push(buf);

  return layers.map((layer) => {
    const m = layer.trim().match(SHADOW_LAYER_RE);
    if (!m) throw new Error('无法解析的阴影 token: ' + raw);
    const c = parseColor(m[5]);
    return {
      type: 'DROP_SHADOW',
      color: { r: c.r, g: c.g, b: c.b, a: c.a },
      offset: { x: parseFloat(m[1]), y: parseFloat(m[2]) },
      radius: parseFloat(m[3]),
      spread: m[4] ? parseFloat(m[4]) : 0,
      visible: true,
      blendMode: 'NORMAL',
    };
  });
}

/** 像素高度 → rpx 文案（1px = 2rpx，UI_SPEC §3.1） */
function rpx(px) {
  return Math.round(px * 2) + 'rpx';
}

function log(msg) {
  figma.notify(msg, { timeout: 1500 });
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 3. 节点工厂
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** 自动布局尺寸固定 */
function fixed(node, w, h) {
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    node.primaryAxisSizingMode = 'FIXED';
    node.counterAxisSizingMode = 'FIXED';
  }
  node.resize(w, h);
  return node;
}

/* ── 尺寸意图延迟应用 ──────────────────────────────────────────────────────────
 * Figma 规定：把 layoutSizingHorizontal 设为 'FILL'（以及 layoutAlign='STRETCH'、
 * layoutGrow=1）时，节点**必须已经**挂在自动布局父级下，否则**直接抛错**。
 * 而写代码的自然顺序是「先造节点 → 设意图 → 最后才 append」，两者天然冲突。
 * 所以这里只登记意图，等整棵树建好后由 applySizeIntents() 统一应用。
 * 若不走这一步，插件会在创建 Cell / 屏幕骨架时随机报
 * 「node doesn't have a parent with auto layout」。
 * ──────────────────────────────────────────────────────────────────────────── */
const SIZE_INTENTS = [];
let SIZE_INTENT_FAILURES = 0;

function markFill(node) {
  SIZE_INTENTS.push({ node, kind: 'fill' });
  return node;
}
function markStretch(node) {
  SIZE_INTENTS.push({ node, kind: 'stretch' });
  return node;
}
function markGrow(node) {
  SIZE_INTENTS.push({ node, kind: 'grow' });
  return node;
}

/** 应用已登记的尺寸意图；返回失败数（失败 = 节点没真正挂到自动布局父级下） */
function applySizeIntents() {
  let failed = 0;
  for (const { node, kind } of SIZE_INTENTS) {
    try {
      if (kind === 'fill') node.layoutSizingHorizontal = 'FILL';
      else if (kind === 'stretch') node.layoutAlign = 'STRETCH';
      else node.layoutGrow = 1;
    } catch (e) {
      failed++;
      console.warn('[SnapLedger] 尺寸意图应用失败：' + kind + ' @ ' + (node && node.name));
    }
  }
  SIZE_INTENTS.length = 0;
  SIZE_INTENT_FAILURES += failed;
  return failed;
}

/**
 * 造一个 Frame。
 * opt: { dir, gap, pad, padX, padY, fill, fillOpacity, radius, stroke, strokeWeight,
 *        w, h, align, justify, wrap, clip, shadow, name }
 */
function frame(name, opt) {
  opt = opt || {};
  const f = figma.createFrame();
  f.name = name;
  f.fills = opt.fill ? [paintVar(opt.fill, opt.fillOpacity)] : [];
  if (opt.radius != null) f.cornerRadius = opt.radius;
  if (opt.stroke) {
    f.strokes = [paintVar(opt.stroke)];
    f.strokeWeight = opt.strokeWeight || 1;
    f.strokeAlign = 'INSIDE';
  }
  if (opt.shadow) f.effects = shadowEffect(opt.shadow);
  if (opt.clip) f.clipsContent = true;

  if (opt.dir) {
    f.layoutMode = opt.dir;
    f.itemSpacing = opt.gap || 0;
    f.paddingTop = opt.padY != null ? opt.padY : opt.pad || 0;
    f.paddingBottom = opt.padY != null ? opt.padY : opt.pad || 0;
    f.paddingLeft = opt.padX != null ? opt.padX : opt.pad || 0;
    f.paddingRight = opt.padX != null ? opt.padX : opt.pad || 0;
    if (opt.align) f.counterAxisAlignItems = opt.align;
    if (opt.justify) f.primaryAxisAlignItems = opt.justify;
    if (opt.wrap) {
      try {
        f.layoutWrap = 'WRAP';
        f.counterAxisSpacing = opt.gap || 0;
      } catch (e) {
        /* 旧版 API 不支持 wrap → 退化为单行 */
      }
    }
  }
  /* 尺寸策略：自动布局里「主轴 / 交叉轴」是哪个方向，取决于 VERTICAL 还是 HORIZONTAL。
   * resize() 会把两轴都锁成 FIXED，所以每次 resize 之后都要把该放开的那个轴改回 AUTO。 */
  const isVertical = opt.dir === 'VERTICAL';
  const wantW = opt.w != null;
  const wantH = opt.h != null;

  if (opt.dir && wantW && wantH) {
    fixed(f, opt.w, opt.h);
  } else if (opt.dir && wantW) {
    // 固定宽、高自适应
    if (isVertical) {
      f.counterAxisSizingMode = 'FIXED';
      f.resize(opt.w, Math.max(1, f.height));
      f.primaryAxisSizingMode = 'AUTO';
    } else {
      f.primaryAxisSizingMode = 'FIXED';
      f.resize(opt.w, Math.max(1, f.height));
      f.counterAxisSizingMode = 'AUTO';
    }
  } else if (opt.dir && wantH) {
    // 固定高、宽自适应（宽度稍后常被 markFill 改成 FILL）
    if (isVertical) {
      f.primaryAxisSizingMode = 'FIXED';
      f.resize(Math.max(1, f.width), opt.h);
      f.counterAxisSizingMode = 'AUTO';
    } else {
      f.counterAxisSizingMode = 'FIXED';
      f.resize(Math.max(1, f.width), opt.h);
      f.primaryAxisSizingMode = 'AUTO';
    }
  } else if (wantW || wantH) {
    // 非自动布局：直接给尺寸
    f.resize(wantW ? opt.w : Math.max(1, f.width), wantH ? opt.h : Math.max(1, f.height));
  }
  return f;
}

/** 横向：宽度自适应内容，高度固定 */
function hugWidthFixedHeight(node, h) {
  node.resize(node.width, h);
  node.counterAxisSizingMode = 'FIXED';
  node.primaryAxisSizingMode = 'AUTO';
  return node;
}

/** 纵向：宽度固定，高度自适应内容 */
function fixedWidthHugHeight(node, w) {
  node.resize(w, node.height);
  node.counterAxisSizingMode = 'FIXED';
  node.primaryAxisSizingMode = 'AUTO';
  return node;
}

/** 造一个 Text。opt: { size, medium, color, lineHeight, width, align, name }
 *
 *  属性顺序有讲究：**先定字体/字号/尺寸策略，最后写 characters**。
 *  反过来的话，height 还是 0，后面的 resize(width, height) 会拿到非法尺寸。 */
function text(chars, opt) {
  opt = opt || {};
  const t = figma.createText();
  t.name = opt.name || String(chars).replace(/\n/g, ' ').slice(0, 16);
  t.fontName = { family: FONT.family, style: opt.medium ? FONT.medium : FONT.regular };
  t.fontSize = opt.size != null ? opt.size : tkNum('fs-body');
  t.fills = [paintVar(opt.color || 'color-text-primary')];
  t.lineHeight = opt.lineHeight
    ? { unit: 'PIXELS', value: Math.round((opt.size || 15) * opt.lineHeight) }
    : { unit: 'AUTO' };
  if (opt.align) t.textAlignHorizontal = opt.align;

  t.textAutoResize = 'HEIGHT';
  t.characters = chars;

  if (opt.width) {
    t.resize(opt.width, Math.max(1, t.height));
    t.textAutoResize = 'HEIGHT'; // 固定宽度 + 高度自适应
  }
  return t;
}

/** 造一个矩形 */
function rect(name, w, h, opt) {
  opt = opt || {};
  const r = figma.createRectangle();
  r.name = name;
  r.resize(w, h);
  r.fills = opt.fill ? [paintVar(opt.fill, opt.fillOpacity)] : [];
  if (opt.radius != null) r.cornerRadius = opt.radius;
  if (opt.stroke) {
    r.strokes = [paintVar(opt.stroke)];
    r.strokeWeight = opt.strokeWeight || 1;
    r.strokeAlign = 'INSIDE';
  }
  return r;
}

/** 造一个圆 / 圆环扇区 */
function ellipse(name, w, h, opt) {
  opt = opt || {};
  const e = figma.createEllipse();
  e.name = name;
  e.resize(w, h);
  e.fills = opt.fill ? [paintVar(opt.fill, opt.fillOpacity)] : [];
  if (opt.stroke) {
    // 环图扇区：用描边画环比叠 two 个圆更可控
    e.strokes = [paintVar(opt.stroke, opt.strokeOpacity)];
    e.strokeWeight = opt.strokeWeight || 1;
  }
  return e;
}

/** 撑开剩余空间 */
function spacer() {
  const f = figma.createFrame();
  f.name = 'Spacer';
  f.fills = [];
  f.resize(1, 1);
  markGrow(f);
  return f;
}

/** 固定宽度的横向间隙 */
function gap(w) {
  const f = figma.createFrame();
  f.name = 'Gap';
  f.fills = [];
  f.resize(w, 1);
  return f;
}

/** 1px 发丝线 */
function hairline(w, opt) {
  opt = opt || {};
  return rect(opt.name || 'Hairline', w, 1, { fill: opt.color || 'color-line' });
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 4. 组件实例小工具（03 Screens 复用 02 Components 的产物）
 * ═══════════════════════════════════════════════════════════════════════════════ */

function findChild(root, name) {
  if (!('children' in root)) return null;
  for (const c of root.children) {
    if (c.name === name) return c;
    const deeper = findChild(c, name);
    if (deeper) return deeper;
  }
  return null;
}

/** 覆写实例内某个文本节点的文案（节点须在组件里预先命名好） */
function setText(node, name, chars) {
  const t = findChild(node, name);
  if (t && t.type === 'TEXT') t.characters = chars;
}

/** 取组件集里指定变体 */
function variant(setName, variantName) {
  const set = SETS[setName];
  if (!set) return null;
  return set.children.find((c) => c.name === variantName) || set.defaultVariant || null;
}

/** 造实例；组件尚未生成时返回 null，调用方负责降级 */
function instance(setName, variantName) {
  const v = variant(setName, variantName);
  if (!v) return null;
  const inst = v.createInstance();
  inst.name = setName + ' · ' + variantName;
  return inst;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 5. 启动：字体 + 页面 + 变量
 * ═══════════════════════════════════════════════════════════════════════════════ */

async function loadFont() {
  for (const c of FONT_CANDIDATES) {
    try {
      await figma.loadFontAsync({ family: c.family, style: c.regular });
      let medium = c.regular;
      try {
        await figma.loadFontAsync({ family: c.family, style: c.medium });
        medium = c.medium;
      } catch (e) {
        /* 该字族没有 Medium/Bold → 用 Regular 顶，字重差异靠字号/颜色区分 */
      }
      FONT = { family: c.family, regular: c.regular, medium };
      return c.family;
    } catch (e) {
      /* 换下一个候选字族 */
    }
  }
  FONT = { family: 'Inter', regular: 'Regular', medium: 'Medium' };
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  return 'Inter (兜底)';
}

/** 找到同名页面则清空复用，否则新建（幂等） */
async function ensurePage(name) {
  let page = figma.root.children.find((p) => p.name === name);
  if (!page) {
    page = figma.createPage();
    page.name = name;
  }
  for (const child of [...page.children]) child.remove();
  return page;
}

async function setPage(page) {
  if (typeof figma.setCurrentPageAsync === 'function') {
    await figma.setCurrentPageAsync(page);
  } else {
    figma.currentPage = page;
  }
}

/** 建 Design Token 变量集合。失败则整体降级（Variables API 在部分账号/版本有差异） */
function createVariables() {
  try {
    const collection = figma.variables.createVariableCollection('SnapLedger Tokens');
    const modeId = collection.defaultModeId;

    for (const t of TOKENS) {
      const isColor = t.type === 'color';
      const isFloat = t.type === 'dimension' && /^-?[\d.]+px$/.test(String(t.value));
      if (!isColor && !isFloat && t.type !== 'number') continue;

      const v = collection.createVariable(t.figmaName, isColor ? 'COLOR' : 'FLOAT');
      if (isColor) {
        const c = parseColor(t.value);
        v.setValueForMode(modeId, { r: c.r, g: c.g, b: c.b, a: c.a });
        // 作用域按语义收窄，避免变量面板里全是「ALL_SCOPES」的噪音
        if (t.name.indexOf('text-') === 0) v.scopes = ['TEXT_FILL'];
        else if (t.name.indexOf('bg-') === 0) v.scopes = ['FRAME_FILL', 'SHAPE_FILL'];
        else if (t.name.indexOf('line') === 0) v.scopes = ['STROKE_COLOR'];
        else v.scopes = ['ALL_SCOPES'];
        COLOR_VARS[t.name] = v;
      } else {
        v.setValueForMode(modeId, parseFloat(String(t.value)));
        v.scopes = ['WIDTH_HEIGHT', 'GAP', 'CORNER_RADIUS', 'STROKE_FLOAT'];
        FLOAT_VARS[t.name] = v;
      }
    }
    return true;
  } catch (e) {
    VARIABLES_AVAILABLE = false;
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 6. 00 Cover
 * ═══════════════════════════════════════════════════════════════════════════════ */

function genCover(page) {
  const f = frame('P/Cover', {
    dir: 'VERTICAL',
    gap: tkNum('sp-6'),
    pad: 80,
    fill: 'color-bg-base',
    w: 1200,
    h: 760,
  });
  f.x = 0;
  f.y = 0;
  page.appendChild(f);

  f.appendChild(text('一拍记 SnapLedger', { size: tkNum('fs-display'), medium: true }));
  f.appendChild(
    text('Design System & Screens　·　v' + (TOKENS_META.version || '1.0.0') + '　·　' + (TOKENS_META.updatedAt || ''), {
      size: tkNum('fs-h2'),
      color: 'color-text-secondary',
    })
  );
  f.appendChild(rect('Rule', 320, 2, { fill: 'color-accent', radius: 1 }));
  f.appendChild(spacer());

  const lines = [
    '近白底 + 唯一强调色（紫罗兰）：克制、可信，不做「记账工具」的刻板样子。',
    '视觉型组件自研、交互型组件外采，两者由同一套 Design Token 驱动，双端零风格分裂。',
    '所有色值 / 字阶 / 间距 / 圆角 / 阴影均来自 Figma Variables，单向生成代码侧 tokens.scss。',
  ];
  for (const line of lines) {
    f.appendChild(text(line, { size: tkNum('fs-body'), color: 'color-text-secondary', width: 620 }));
  }

  f.appendChild(spacer());
  f.appendChild(hairline(1040, { name: 'Divider' }));
  f.appendChild(
    text('Token 单一来源：design/tokens/tokens.json　→　npm run gen:scss　→　src/styles/tokens.scss', {
      size: tkNum('fs-tiny'),
      color: 'color-text-tertiary',
    })
  );
  f.appendChild(
    text(
      '生成源：01 Foundations / 02 Components / 03 Screens / 04 Prototype　·　基准画板 375×812（1x）　·　1px = 2rpx',
      { size: tkNum('fs-tiny'), color: 'color-text-tertiary' }
    )
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 7. 01 Foundations
 * ═══════════════════════════════════════════════════════════════════════════════ */

const SECTION_W = 720;
const SECTION_INNER = SECTION_W - 2 * 24; // 左右各 sp-6

/** 一个 Foundations 区块，返回区块本身（调用方读 .height 推进 y 游标） */
function section(name, x, y) {
  const s = frame(name, {
    dir: 'VERTICAL',
    gap: tkNum('sp-5'),
    pad: tkNum('sp-6'),
    fill: 'color-bg-base',
    radius: tkNum('r-lg'),
    stroke: 'color-line',
    w: SECTION_W,
  });
  s.x = x;
  s.y = y;
  figma.currentPage.appendChild(s);
  return s;
}

/** 区块标题 + 一句话说明 */
function sectionHeader(node, title, desc) {
  node.appendChild(text(title, { size: tkNum('fs-h1'), medium: true }));
  if (desc) {
    node.appendChild(text(desc, { size: tkNum('fs-caption'), color: 'color-text-secondary', width: SECTION_INNER }));
  }
}

function genColorBlock() {
  const s = section('Foundations/Color', 0, 0);
  sectionHeader(
    s,
    'Color 色彩',
    '唯一强调色紫罗兰。色块上标注了代码变量名（--*）与原始值；色块已绑定到 Figma 变量，改变量即可全稿联动。'
  );

  const groups = [
    ['bg', '背景 Background'],
    ['line', '描边 / 分割线'],
    ['text', '文字 Text'],
    ['accent', '强调 Accent'],
    ['semantic', '语义 Semantic'],
    ['chart', '图表 Chart'],
  ];

  for (const [key, label] of groups) {
    const list = tokensOfGroup('color').filter((t) => t.path.split('.')[1] === key);
    if (!list.length) continue;

    s.appendChild(text(label, { size: tkNum('fs-h2'), medium: true }));
    const wrap = frame('Color/' + key, {
      dir: 'HORIZONTAL',
      gap: tkNum('sp-3'),
      wrap: true,
      w: SECTION_INNER,
    });
    s.appendChild(wrap);

    for (const t of list) {
      const card = frame('Swatch/' + t.name, { dir: 'VERTICAL', gap: tkNum('sp-1') });
      card.appendChild(rect('Chip', 156, 72, { fill: t.name, radius: tkNum('r-md'), stroke: 'color-line' }));
      card.appendChild(text('--' + t.name, { size: tkNum('fs-tiny'), medium: true }));
      card.appendChild(text(String(t.value), { size: tkNum('fs-tiny'), color: 'color-text-tertiary' }));
      if (t.description) {
        card.appendChild(
          text(t.description, { size: tkNum('fs-tiny'), color: 'color-text-tertiary', width: 156, lineHeight: 1.4 })
        );
      }
      wrap.appendChild(card);
    }
  }
  return s;
}

function genTypographyBlock(y) {
  const s = section('Foundations/Typography', 784, y);
  sectionHeader(s, 'Typography 字阶', '两档字重就够（Regular / Medium），再粗就廉价。尺寸即 CSS 变量值，1px = 2rpx。');

  s.appendChild(text('字族 Font family', { size: tkNum('fs-h2'), medium: true }));
  s.appendChild(
    text('一拍记 Aa Bb 123 ¥3,842.50', { size: tkNum('fs-h2'), width: SECTION_INNER })
  );
  s.appendChild(
    text('--' + TOKENS.find((t) => t.name === 'font-family-sans').name + '　' + tk('font-family-sans'), {
      size: tkNum('fs-tiny'),
      color: 'color-text-tertiary',
      width: SECTION_INNER,
    })
  );

  s.appendChild(text('字阶 Size scale', { size: tkNum('fs-h2'), medium: true }));
  const sizes = tokensOfGroup('font')
    .filter((t) => t.path[1] === 'size')
    .sort((a, b) => parseFloat(b.value) - parseFloat(a.value));

  for (const t of sizes) {
    const px = parseFloat(t.value);
    const row = frame('Type/' + t.name, {
      dir: 'HORIZONTAL',
      gap: tkNum('sp-4'),
      align: 'CENTER',
      w: SECTION_INNER,
      stroke: 'color-line',
      strokeWeight: 1,
      padY: tkNum('sp-2'),
    });
    row.appendChild(text('--' + t.name, { size: tkNum('fs-tiny'), color: 'color-text-secondary', width: 76 }));
    row.appendChild(text('一拍记 Aa 3,842', { size: px, medium: px >= 22 }));
    row.appendChild(spacer());
    row.appendChild(
      text(px + 'px · ' + rpx(px) + (t.description ? '　' + t.description.replace(/^\d+rpx\s*/, '') : ''), {
        size: tkNum('fs-tiny'),
        color: 'color-text-tertiary',
        align: 'RIGHT',
      })
    );
    s.appendChild(row);
  }

  s.appendChild(text('字重 Weight', { size: tkNum('fs-h2'), medium: true }));
  for (const t of tokensOfGroup('font').filter((x) => x.path[1] === 'weight')) {
    const row = frame('Weight/' + t.name, { dir: 'HORIZONTAL', gap: tkNum('sp-3'), align: 'CENTER' });
    row.appendChild(text('Regular', { size: tkNum('fs-body') }));
    row.appendChild(text('Medium', { size: tkNum('fs-body'), medium: true }));
    row.appendChild(
      text('--' + t.name + ' ' + t.value, { size: tkNum('fs-tiny'), color: 'color-text-tertiary' })
    );
    s.appendChild(row);
  }
  return s;
}

function genSpacingBlock(y) {
  const s = section('Foundations/Spacing', 0, y);
  sectionHeader(s, 'Spacing 间距', '4px 栅格。条形为**实际尺寸**（未放大），方便直接量取。');

  for (const t of tokensOfGroup('space')) {
    const px = parseFloat(t.value);
    const row = frame('Space/' + t.name, { dir: 'HORIZONTAL', gap: tkNum('sp-3'), align: 'CENTER' });
    row.appendChild(text('--' + t.name, { size: tkNum('fs-tiny'), color: 'color-text-secondary', width: 56 }));
    row.appendChild(rect('Bar', px, 16, { fill: 'color-accent', radius: 2 }));
    row.appendChild(text(px + 'px · ' + rpx(px), { size: tkNum('fs-tiny'), medium: true, width: 96 }));
    row.appendChild(
      text(t.description || '', { size: tkNum('fs-tiny'), color: 'color-text-tertiary' })
    );
    s.appendChild(row);
  }

  s.appendChild(text('页边距 / 布局 Layout', { size: tkNum('fs-h2'), medium: true }));
  for (const t of tokensOfGroup('layout')) {
    const row = frame('Layout/' + t.name, { dir: 'HORIZONTAL', gap: tkNum('sp-3'), align: 'CENTER' });
    row.appendChild(text('--' + t.name, { size: tkNum('fs-tiny'), color: 'color-text-secondary', width: 180 }));
    row.appendChild(text(String(t.value), { size: tkNum('fs-tiny'), medium: true, width: 80 }));
    row.appendChild(text(t.description || '', { size: tkNum('fs-tiny'), color: 'color-text-tertiary' }));
    s.appendChild(row);
  }
  return s;
}

function genRadiusBlock(y) {
  const s = section('Foundations/Radius', 784, y);
  sectionHeader(s, 'Radius 圆角', '标签用小圆角、卡片用大圆角、按钮与头像用全圆角。');

  const wrap = frame('Radius/All', { dir: 'HORIZONTAL', gap: tkNum('sp-4'), wrap: true, w: SECTION_INNER });
  s.appendChild(wrap);
  for (const t of tokensOfGroup('radius')) {
    const card = frame('Radius/' + t.name, { dir: 'VERTICAL', gap: tkNum('sp-2'), align: 'CENTER' });
    card.appendChild(
      rect('Sample', 72, 72, { fill: 'color-bg-subtle', radius: parseFloat(t.value), stroke: 'color-line-strong' })
    );
    card.appendChild(text('--' + t.name, { size: tkNum('fs-tiny'), medium: true }));
    card.appendChild(text(String(t.value), { size: tkNum('fs-tiny'), color: 'color-text-tertiary' }));
    wrap.appendChild(card);
  }
  return s;
}

function genShadowBlock(y) {
  const s = section('Foundations/Shadow', 0, y);
  sectionHeader(s, 'Shadow 阴影', '只有两级，都用于「浮起来」的层次，不做装饰。sh-1 两层叠加更贴合，sh-2 带主色倾向（透明度上限 0.2）。');

  const stage = frame('Shadow/Stage', {
    dir: 'HORIZONTAL',
    gap: tkNum('sp-5'),
    pad: tkNum('sp-5'),
    fill: 'color-bg-subtle',
    radius: tkNum('r-md'),
    w: SECTION_INNER,
  });
  s.appendChild(stage);
  for (const t of tokensOfGroup('shadow')) {
    const col = frame('Shadow/' + t.name, { dir: 'VERTICAL', gap: tkNum('sp-2'), align: 'CENTER' });
    col.appendChild(
      frame('Card', {
        dir: 'VERTICAL',
        gap: tkNum('sp-2'),
        pad: tkNum('sp-3'),
        fill: 'color-bg-surface',
        radius: tkNum('r-lg'),
        shadow: t.name,
        w: 200,
        h: 96,
      })
    );
    col.appendChild(text('--' + t.name, { size: tkNum('fs-tiny'), medium: true }));
    col.appendChild(text(String(t.value), { size: tkNum('fs-tiny'), color: 'color-text-tertiary', width: 220, align: 'CENTER' }));
    stage.appendChild(col);
  }
  return s;
}

/** 六个纯轴对齐图形拼的图标（不用旋转，避免坐标飘移） */
function iconBox(kind, color) {
  const f = figma.createFrame();
  f.name = 'Icon/' + kind;
  f.resize(24, 24);
  f.fills = [];
  f.clipsContent = false;
  const c = color || 'color-text-primary';

  if (kind === 'home') {
    const roof = figma.createPolygon();
    roof.name = 'Roof';
    f.appendChild(roof);
    roof.resize(18, 16);
    roof.x = 3;
    roof.y = 0;
    roof.fills = [paintVar(c)];
    const body = rect('Body', 14, 10, { fill: c, radius: 2 });
    f.appendChild(body);
    body.x = 5;
    body.y = 12;
  } else if (kind === 'chart') {
    const bars = [
      [3, 14, 5, 8],
      [9.5, 9, 5, 13],
      [16, 4, 5, 18],
    ];
    for (let i = 0; i < bars.length; i++) {
      const b = rect('Bar' + i, bars[i][2], bars[i][3], { fill: c, radius: 2 });
      f.appendChild(b);
      b.x = bars[i][0];
      b.y = bars[i][1];
    }
  } else if (kind === 'user') {
    const head = ellipse('Head', 10, 10, { fill: c });
    f.appendChild(head);
    head.x = 7;
    head.y = 2;
    const body = rect('Body', 16, 9, { fill: c, radius: 5 });
    f.appendChild(body);
    body.x = 4;
    body.y = 14;
  } else if (kind === 'camera') {
    const body = rect('Body', 20, 15, { fill: c, radius: 3 });
    f.appendChild(body);
    body.x = 2;
    body.y = 7;
    const lens = ellipse('Lens', 8, 8, { fill: 'color-bg-base' });
    f.appendChild(lens);
    lens.x = 8;
    lens.y = 10.5;
    const flash = rect('Flash', 7, 3, { fill: c, radius: 1.5 });
    f.appendChild(flash);
    flash.x = 8.5;
    flash.y = 3;
  } else if (kind === 'trash') {
    const lid = rect('Lid', 16, 2, { fill: c, radius: 1 });
    f.appendChild(lid);
    lid.x = 4;
    lid.y = 4;
    const bin = rect('Bin', 14, 13, { fill: c, radius: 2 });
    f.appendChild(bin);
    bin.x = 5;
    bin.y = 8;
  } else {
    // more
    for (let i = 0; i < 3; i++) {
      const d = ellipse('Dot' + i, 5, 5, { fill: c });
      f.appendChild(d);
      d.x = 2 + i * 7.5;
      d.y = 9.5;
    }
  }
  return f;
}

function genIconBlock(y) {
  const s = section('Foundations/Icons', 784, y);
  sectionHeader(s, 'Icons 图标', 'tabBar 与操作图标用纯几何图形拼出（不引第三方图标字体，省主包体积）。选中态用 accent。');

  const icons = [
    ['home', '首页'],
    ['chart', '统计'],
    ['user', '我的'],
    ['camera', '拍照'],
    ['trash', '删除'],
    ['more', '更多'],
  ];

  const wrap = frame('Icons/All', { dir: 'HORIZONTAL', gap: tkNum('sp-4'), wrap: true, w: SECTION_INNER });
  s.appendChild(wrap);
  for (const [kind, label] of icons) {
    const col = frame('Icon/' + kind, { dir: 'VERTICAL', gap: tkNum('sp-2'), align: 'CENTER' });
    const box = frame('Tile', {
      dir: 'HORIZONTAL',
      align: 'CENTER',
      justify: 'CENTER',
      fill: 'color-bg-subtle',
      radius: tkNum('r-md'),
      w: 56,
      h: 56,
    });
    box.appendChild(iconBox(kind, kind === 'camera' ? 'color-accent' : 'color-text-primary'));
    col.appendChild(box);
    col.appendChild(text(label, { size: tkNum('fs-tiny'), color: 'color-text-secondary' }));
    wrap.appendChild(col);
  }
  return s;
}

function genFoundations(page) {
  genCover(page);
  let leftY = 0;
  let rightY = 0;
  leftY += genColorBlock().height + 64;
  rightY += genTypographyBlock(0).height + 64;
  leftY += genSpacingBlock(leftY).height + 64;
  rightY += genRadiusBlock(rightY).height + 64;
  leftY += genShadowBlock(leftY).height + 64;
  genIconBlock(rightY);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 8. 02 Components —— 自研 7 个原子组件
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** 把一堆组件合成变体集，并把结果移出临时容器 */
function combineVariants(sectionNode, setName, comps, spacing) {
  const holder = figma.createFrame();
  holder.name = 'Holder';
  holder.fills = [];
  holder.resize(10, 10);
  sectionNode.appendChild(holder);

  for (const c of comps) holder.appendChild(c);
  const set = figma.combineAsVariants(comps, holder);
  set.name = setName;

  // 先把 set 移出去，再删 holder —— 反过来会把 set 一起删掉
  sectionNode.appendChild(set);
  holder.remove();

  try {
    set.layoutMode = 'HORIZONTAL';
    set.itemSpacing = spacing != null ? spacing : 24;
    set.paddingLeft = set.paddingRight = set.paddingTop = set.paddingBottom = 32;
    set.fills = [paintVar('color-bg-subtle')];
    set.cornerRadius = tkNum('r-md');
  } catch (e) {
    /* 变体集布局设置失败不影响生成 */
  }
  SETS[setName] = set;
  return set;
}

/** Button：4 类型 × 3 尺寸 */
function buildButtonVariants() {
  const SIZES = [
    ['lg', 44, 24, 'fs-body'],
    ['md', 36, 20, 'fs-caption'],
    ['sm', 28, 12, 'fs-tiny'],
  ];
  const TYPES = [
    ['primary', '确认保存'],
    ['ghost', '重拍'],
    ['text', '查看全部'],
    ['danger', '删除这笔账单'],
  ];

  const comps = [];
  for (const [size, h, padX, fs] of SIZES) {
    for (const [type, label] of TYPES) {
      const c = figma.createComponent();
      c.name = 'Type=' + type + ', Size=' + size;
      c.layoutMode = 'HORIZONTAL';
      c.counterAxisAlignItems = 'CENTER';
      c.primaryAxisAlignItems = 'CENTER';
      c.paddingLeft = c.paddingRight = padX;
      c.paddingTop = c.paddingBottom = 0;
      c.cornerRadius = tkNum('r-full');

      if (type === 'primary') c.fills = [paintVar('color-accent')];
      else if (type === 'danger') c.fills = [paintVar('color-danger')];
      else c.fills = [];
      if (type === 'ghost') {
        c.strokes = [paintVar('color-line-strong')];
        c.strokeWeight = 1;
        c.strokeAlign = 'INSIDE';
      }

      const t = text(label, {
        size: tkNum(fs),
        medium: true,
        color: type === 'text' ? 'color-accent' : type === 'ghost' ? 'color-text-primary' : 'color-text-inverse',
      });
      t.name = 'Label';
      c.appendChild(t);
      hugWidthFixedHeight(c, h);
      comps.push(c);
    }
  }
  return comps;
}

/** Cell：default / clickable / with-arrow / with-switch(-on/-off) */
function buildCellVariants() {
  const META = {
    default: { line: false, arrow: false, slot: null },
    clickable: { line: true, arrow: false, slot: null },
    'with-arrow': { line: true, arrow: true, slot: null },
    'with-switch-on': { line: true, arrow: false, slot: true },
    'with-switch-off': { line: true, arrow: false, slot: false },
  };
  const comps = [];
  for (const key of Object.keys(META)) {
    const c = figma.createComponent();
    c.name = 'Variant=' + key;
    c.layoutMode = 'VERTICAL';
    c.itemSpacing = 0;

    const row = frame('Row', { dir: 'HORIZONTAL', gap: tkNum('sp-3'), padX: tkNum('sp-4'), align: 'CENTER', h: 44 });
    markFill(row);
    const label = text('每日记账提醒', { size: tkNum('fs-body') });
    label.name = 'Label';
    row.appendChild(label);
    row.appendChild(spacer());

    if (META[key].slot === null) {
      const value = text('已同步', { size: tkNum('fs-body'), color: 'color-text-secondary', align: 'RIGHT' });
      value.name = 'Value';
      row.appendChild(value);
    } else {
      row.appendChild(switchNode(META[key].slot));
    }

    if (META[key].arrow) {
      const arrow = text('›', { size: tkNum('fs-h2'), color: 'color-text-tertiary' });
      arrow.name = 'Arrow';
      row.appendChild(arrow);
    }
    c.appendChild(row);
    if (META[key].line) {
      const line = hairline(343 - 2 * 16, { name: 'Divider' });
      line.x = 16;
      c.appendChild(line);
    }
    fixedWidthHugHeight(c, 343);
    comps.push(c);
  }
  return comps;
}

/** Card：flat / elevated */
function buildCardVariants() {
  const comps = [];
  for (const key of ['flat', 'elevated']) {
    const c = figma.createComponent();
    c.name = 'Elevation=' + key;
    c.layoutMode = 'VERTICAL';
    c.itemSpacing = tkNum('sp-3');
    c.paddingLeft = c.paddingRight = tkNum('sp-4');
    c.paddingTop = c.paddingBottom = tkNum('sp-4');
    c.cornerRadius = tkNum('r-lg');
    c.fills = [paintVar('color-bg-surface')];
    if (key === 'elevated') c.effects = shadowEffect('sh-1');

    c.appendChild(text('前三分类', { size: tkNum('fs-h2'), medium: true }));

    const rows = [
      ['color-chart-c1', '餐饮', '¥1,280', '33%'],
      ['color-chart-c2', '交通', '¥620', '16%'],
      ['color-chart-c3', '购物', '¥540', '14%'],
    ];
    for (const [color, name, amount, pct] of rows) {
      const row = frame('Row/' + name, { dir: 'HORIZONTAL', gap: tkNum('sp-2'), align: 'CENTER' });
      markFill(row);
      row.appendChild(ellipse('Dot', 8, 8, { fill: color }));
      row.appendChild(text(name, { size: tkNum('fs-caption'), width: 48 }));
      row.appendChild(spacer());
      row.appendChild(text(amount, { size: tkNum('fs-caption'), medium: true }));
      row.appendChild(text(pct, { size: tkNum('fs-caption'), color: 'color-text-tertiary', width: 40, align: 'RIGHT' }));
      c.appendChild(row);

      const bar = frame('Bar', { dir: 'HORIZONTAL', h: 4, radius: tkNum('r-full'), fill: 'color-bg-subtle' });
      markFill(bar);
      const fill = frame('Fill', { dir: 'HORIZONTAL', h: 4, radius: tkNum('r-full'), fill: color, w: 40 + parseInt(pct, 10) * 3 });
      bar.appendChild(fill);
      c.appendChild(bar);
    }
    fixedWidthHugHeight(c, 343);
    comps.push(c);
  }
  return comps;
}

/** Tag：soft / outline × 5 语义色 */
function buildTagVariants() {
  const TONES = [
    ['accent', '餐饮'],
    ['success', '收入'],
    ['warning', '待同步'],
    ['danger', '失败'],
    ['info', '提示'],
  ];
  const comps = [];
  for (const tone of ['soft', 'outline']) {
    for (const [name, label] of TONES) {
      const c = figma.createComponent();
      c.name = 'Appearance=' + tone + ', Tone=' + name;
      c.layoutMode = 'HORIZONTAL';
      c.counterAxisAlignItems = 'CENTER';
      c.paddingLeft = c.paddingRight = tkNum('sp-2');
      c.paddingTop = c.paddingBottom = tkNum('sp-1');
      c.cornerRadius = tkNum('r-sm');

      const colorToken = name === 'accent' ? 'color-accent' : 'color-' + name;
      if (tone === 'soft') {
        // accent 有专门的浅底 token；其余语义色用低透明度叠出浅底，不新增字面色值
        c.fills = name === 'accent' ? [paintVar('color-accent-soft')] : [paintVar(colorToken, 0.12)];
      } else {
        c.fills = [];
        c.strokes = [paintVar(colorToken)];
        c.strokeWeight = 1;
        c.strokeAlign = 'INSIDE';
      }

      const t = text(label, { size: tkNum('fs-tiny'), medium: true, color: colorToken });
      t.name = 'Label';
      c.appendChild(t);
      hugWidthFixedHeight(c, 24);
      comps.push(c);
    }
  }
  return comps;
}

/** Avatar：md / sm */
function buildAvatarVariants() {
  const comps = [];
  for (const [key, size] of [
    ['md', 40],
    ['sm', 28],
  ]) {
    const c = figma.createComponent();
    c.name = 'Size=' + key;
    c.layoutMode = 'HORIZONTAL';
    c.counterAxisAlignItems = 'CENTER';
    c.primaryAxisAlignItems = 'CENTER';
    c.cornerRadius = tkNum('r-full');
    c.fills = [paintVar('color-chart-c1')];
    const glyph = text('餐', { size: size >= 40 ? tkNum('fs-caption') : tkNum('fs-tiny'), medium: true, color: 'color-text-inverse' });
    glyph.name = 'Glyph';
    c.appendChild(glyph);
    fixed(c, size, size);
    comps.push(c);
  }
  return comps;
}

/** Skeleton：line / card / list */
function buildSkeletonVariants() {
  const comps = [];

  const line = figma.createComponent();
  line.name = 'Kind=line';
  line.fills = [paintVar('color-bg-subtle')];
  line.cornerRadius = tkNum('r-sm');
  fixed(line, 343, 24);
  comps.push(line);

  const card = figma.createComponent();
  card.name = 'Kind=card';
  card.fills = [paintVar('color-bg-subtle')];
  card.cornerRadius = tkNum('r-lg');
  fixed(card, 343, 120);
  comps.push(card);

  const list = figma.createComponent();
  list.name = 'Kind=list';
  list.layoutMode = 'VERTICAL';
  list.itemSpacing = tkNum('sp-3');
  list.paddingLeft = list.paddingRight = tkNum('sp-4');
  list.paddingTop = list.paddingBottom = tkNum('sp-4');
  list.fills = [paintVar('color-bg-surface')];
  list.cornerRadius = tkNum('r-lg');
  for (let i = 0; i < 3; i++) {
    const row = frame('Row' + i, { dir: 'HORIZONTAL', gap: tkNum('sp-3'), align: 'CENTER' });
    markFill(row);
    const av = frame('Avatar', { dir: 'HORIZONTAL', fill: 'color-bg-subtle', radius: tkNum('r-full'), w: 40, h: 40 });
    row.appendChild(av);
    const col = frame('Lines', { dir: 'VERTICAL', gap: tkNum('sp-2') });
    markFill(col);
    const l1 = rect('Line1', 200, 14, { fill: 'color-bg-subtle', radius: tkNum('r-sm') });
    markFill(l1);
    col.appendChild(l1);
    col.appendChild(rect('Line2', 120, 12, { fill: 'color-bg-subtle', radius: tkNum('r-sm') }));
    row.appendChild(col);
    list.appendChild(row);
  }
  fixedWidthHugHeight(list, 343);
  comps.push(list);
  return comps;
}

/** Empty：no-data / no-network / error */
function buildEmptyVariants() {
  const STATES = {
    'no-data': ['还没有账单', '拍一张小票，开始你的第一笔记账', '拍一张开始记账'],
    'no-network': ['网络好像断了', '记账会先存在本地，联网后自动同步', '重试'],
    error: ['出了点问题', '数据没读出来，可以下拉重试', '重新加载'],
  };
  const comps = [];
  for (const key of Object.keys(STATES)) {
    const [title, desc, action] = STATES[key];
    const c = figma.createComponent();
    c.name = 'State=' + key;
    c.layoutMode = 'VERTICAL';
    c.itemSpacing = tkNum('sp-3');
    c.counterAxisAlignItems = 'CENTER';
    c.paddingLeft = c.paddingRight = tkNum('sp-6');
    c.paddingTop = c.paddingBottom = tkNum('sp-8');
    c.fills = [paintVar('color-bg-surface')];
    c.cornerRadius = tkNum('r-lg');

    // 极简插画：底圈 + 前景块，不用外部图片
    const art = frame('Illustration', { dir: 'HORIZONTAL', align: 'CENTER', justify: 'CENTER', w: 96, h: 96 });
    art.appendChild(ellipse('Disc', 96, 96, { fill: 'color-bg-subtle' }));
    const piece = rect('Piece', 34, 26, { fill: 'color-text-tertiary', radius: tkNum('r-sm') });
    art.appendChild(piece);
    c.appendChild(art);

    const t = text(title, { size: tkNum('fs-h2'), medium: true });
    t.name = 'Title';
    c.appendChild(t);
    const d = text(desc, { size: tkNum('fs-caption'), color: 'color-text-tertiary', width: 260, align: 'CENTER' });
    d.name = 'Desc';
    c.appendChild(d);

    const btn = frame('ActionBtn', {
      dir: 'HORIZONTAL',
      align: 'CENTER',
      justify: 'CENTER',
      fill: 'color-accent',
      radius: tkNum('r-full'),
      padX: tkNum('sp-5'),
      h: 36,
    });
    const a = text(action, { size: tkNum('fs-caption'), medium: true, color: 'color-text-inverse' });
    a.name = 'Action';
    btn.appendChild(a);
    c.appendChild(btn);

    fixedWidthHugHeight(c, 343);
    comps.push(c);
  }
  return comps;
}

function genComponents(page) {
  const s = frame('Components/自研原子组件', {
    dir: 'VERTICAL',
    gap: tkNum('sp-8'),
    pad: tkNum('sp-6'),
    fill: 'color-bg-base',
    radius: tkNum('r-lg'),
    stroke: 'color-line',
    w: 1000,
  });
  s.x = 0;
  s.y = 0;
  page.appendChild(s);

  sectionHeader(s, 'Components 自研原子组件', '视觉型组件自研（7 个）。颜色 / 圆角 / 字阶全部引用 Design Token 变量，改 tokens.json 即全稿联动。');

  const spec = [
    ['C/Button', '4 类型 × 3 尺寸。圆角 r-full，按压 scale(0.98)，loading 态内置。', buildButtonVariants],
    ['C/Cell', 'default 无分割线；clickable 带分割线；with-arrow 带右箭头（我的页设置项）。', buildCellVariants],
    ['C/Card', 'flat 无阴影；elevated 用 sh-1。内边距 sp-4，圆角 r-lg。', buildCardVariants],
    ['C/Tag', 'soft / outline × 5 语义色。字号 fs-tiny，内边距 4×8。', buildTagVariants],
    ['C/Avatar', 'md(40) / sm(28)，用于分类图标与列表头像。', buildAvatarVariants],
    ['C/Skeleton', 'line / card / list 三形态。底色 bg-subtle，shimmer 动画 1.6s 循环。', buildSkeletonVariants],
    ['C/Empty', 'no-data / no-network / error。插画 + 说明 + 一个主操作。', buildEmptyVariants],
  ];

  for (const [name, desc, builder] of spec) {
    const block = frame('Block/' + name.replace('C/', ''), { dir: 'VERTICAL', gap: tkNum('sp-3') });
    markFill(block);
    block.appendChild(text(name, { size: tkNum('fs-h2'), medium: true }));
    block.appendChild(text(desc, { size: tkNum('fs-caption'), color: 'color-text-secondary', width: 920 }));
    s.appendChild(block);
    combineVariants(block, name, builder(), 24);
  }

  genWotMockups(s);

  // 组件树已建完，统一把 FILL / STRETCH / GROW 意图落下去
  applySizeIntents();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 9. 02 Components —— 外采组件「映射后观感」示意
 *
 * 这些**不是组件**，是静态示意图：外采组件的最终外观由 wot-theme.scss 的主题映射
 * 决定（UI_SPEC §4.3），设计稿里必须按映射后的样子画出来，
 * 否则 §7.6 的还原度对比没有基准。
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** 造一个示意图外框：标题 + 内容 */
function mockup(name, desc, inner) {
  const box = frame('Wot/' + name, {
    dir: 'VERTICAL',
    gap: tkNum('sp-3'),
    pad: tkNum('sp-4'),
    fill: 'color-bg-surface',
    radius: tkNum('r-md'),
    stroke: 'color-line',
    w: 300,
  });
  box.appendChild(text(name, { size: tkNum('fs-caption'), medium: true }));
  box.appendChild(text(desc, { size: tkNum('fs-tiny'), color: 'color-text-tertiary', width: 268, lineHeight: 1.4 }));
  box.appendChild(inner);
  return box;
}

/** 开关图形（Cell 的 with-switch 变体与 wd-switch 示意图共用）。
 *  Wot 默认主色 #4D80F0，映射后打开态应为我们的 accent。 */
function switchNode(on) {
  const f = frame('Switch', {
    dir: 'HORIZONTAL',
    align: 'CENTER',
    justify: on ? 'MAX' : 'MIN',
    fill: on ? 'color-accent' : 'color-bg-subtle',
    radius: tkNum('r-full'),
    pad: 2,
    w: 46,
    h: 26,
  });
  f.appendChild(ellipse('Knob', 22, 22, { fill: 'color-bg-surface' }));
  return f;
}

function genWotMockups(sectionNode) {
  sectionNode.appendChild(rect('SectionDivider', 1, 1, { fill: 'color-line' }));
  sectionNode.appendChild(text('Components 外采（Wot 映射后观感）', { size: tkNum('fs-h1'), medium: true }));
  sectionNode.appendChild(
    text(
      '以下为 wot-design-uni 1.14.0 在本项目主题映射（UI_SPEC §4.3）后的观感示意 —— 静态图，非组件。默认主色 #4D80F0 已被 --wot-color-theme 覆盖为 accent 紫罗兰。',
      { size: tkNum('fs-caption'), color: 'color-text-secondary', width: 920 }
    )
  );

  const wrap = frame('Wot/Mockups', { dir: 'HORIZONTAL', gap: tkNum('sp-5'), wrap: true, w: 920 });
  sectionNode.appendChild(wrap);

  /* wd-button */
  const btn = frame('Btn', {
    dir: 'HORIZONTAL',
    align: 'CENTER',
    justify: 'CENTER',
    fill: 'color-accent',
    radius: tkNum('r-full'),
    h: 44,
  });
  markFill(btn);
  btn.appendChild(text('确认保存', { size: tkNum('fs-caption'), medium: true, color: 'color-text-inverse' }));
  wrap.appendChild(mockup('wd-button (primary)', '主色随 --wot-color-theme 变化', btn));

  /* wd-switch */
  const sw = frame('SwitchWrap', { dir: 'HORIZONTAL', gap: tkNum('sp-5'), align: 'CENTER' });
  sw.appendChild(switchNode(true));
  sw.appendChild(switchNode(false));
  sw.appendChild(text('开 / 关', { size: tkNum('fs-tiny'), color: 'color-text-tertiary' }));
  wrap.appendChild(mockup('wd-switch', '打开态用 accent；关闭态 bg-subtle', sw));

  /* wd-action-sheet */
  const sheet = frame('Sheet', { dir: 'VERTICAL', gap: 0, radius: tkNum('r-xl'), fill: 'color-bg-surface', w: 268 });
  const sheetTitle = frame('SheetTitle', { dir: 'HORIZONTAL', align: 'CENTER', justify: 'CENTER', padY: tkNum('sp-3') });
  markFill(sheetTitle);
  sheetTitle.appendChild(text('选择分类', { size: tkNum('fs-caption'), color: 'color-text-secondary' }));
  sheet.appendChild(sheetTitle);
  for (const [label, active] of [['餐饮', true], ['交通', false], ['购物', false]]) {
    const row = frame('SheetItem/' + label, {
      dir: 'HORIZONTAL',
      align: 'CENTER',
      justify: 'CENTER',
      padY: tkNum('sp-3'),
      fill: active ? 'color-accent-soft' : null,
    });
    markFill(row);
    row.appendChild(text(label, { size: tkNum('fs-body'), medium: active, color: active ? 'color-accent' : 'color-text-primary' }));
    sheet.appendChild(row);
  }
  const cancel = frame('SheetCancel', { dir: 'HORIZONTAL', align: 'CENTER', justify: 'CENTER', padY: tkNum('sp-3'), fill: 'color-bg-subtle' });
  markFill(cancel);
  cancel.appendChild(text('取消', { size: tkNum('fs-body'), color: 'color-text-primary' }));
  sheet.appendChild(cancel);
  wrap.appendChild(mockup('wd-action-sheet', '选中态 accent-soft，圆角 r-xl', sheet));

  /* wd-toast */
  const toastWrap = frame('ToastWrap', { dir: 'HORIZONTAL', align: 'CENTER', justify: 'CENTER', h: 72 });
  markFill(toastWrap);
  const toast = frame('Toast', {
    dir: 'VERTICAL',
    gap: tkNum('sp-2'),
    align: 'CENTER',
    pad: tkNum('sp-3'),
    fill: 'color-text-primary',
    fillOpacity: 0.9,
    radius: tkNum('r-md'),
  });
  toast.appendChild(text('已保存', { size: tkNum('fs-body'), color: 'color-text-inverse' }));
  toastWrap.appendChild(toast);
  wrap.appendChild(mockup('wd-toast', '居中、1.5s 自动消失、圆角 r-md', toastWrap));

  /* wd-message-box */
  const mb = frame('MsgBox', { dir: 'VERTICAL', gap: tkNum('sp-3'), pad: tkNum('sp-5'), fill: 'color-bg-surface', radius: tkNum('r-lg'), w: 252 });
  mb.appendChild(text('删除这笔账单？', { size: tkNum('fs-h2'), medium: true, align: 'CENTER' }));
  mb.appendChild(text('删除后无法恢复：¥38.50 · 餐饮', { size: tkNum('fs-caption'), color: 'color-text-secondary', width: 212, align: 'CENTER' }));
  const acts = frame('Actions', { dir: 'HORIZONTAL', gap: 0 });
  markFill(acts);
  const cancelBtn = frame('Cancel', { dir: 'HORIZONTAL', align: 'CENTER', justify: 'CENTER', h: 36 });
  markFill(cancelBtn);
  cancelBtn.appendChild(text('取消', { size: tkNum('fs-caption'), color: 'color-text-secondary' }));
  const delBtn = frame('Delete', { dir: 'HORIZONTAL', align: 'CENTER', justify: 'CENTER', h: 36 });
  markFill(delBtn);
  delBtn.appendChild(text('删除', { size: tkNum('fs-caption'), medium: true, color: 'color-danger' }));
  acts.appendChild(cancelBtn);
  acts.appendChild(delBtn);
  mb.appendChild(acts);
  wrap.appendChild(mockup('wd-message-box', '破坏性操作措辞含对象名与金额', mb));

  /* wd-number-keyboard */
  const kb = frame('Keyboard', { dir: 'VERTICAL', gap: tkNum('sp-2'), w: 268 });
  const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];
  for (const rowKeys of KEYS) {
    const row = frame('KbRow', { dir: 'HORIZONTAL', gap: tkNum('sp-2') });
    markFill(row);
    for (const k of rowKeys) {
      const key = frame('Key/' + k, {
        dir: 'HORIZONTAL',
        align: 'CENTER',
        justify: 'CENTER',
        fill: 'color-bg-subtle',
        radius: tkNum('r-md'),
        h: 36,
      });
      markFill(key);
      key.appendChild(text(k, { size: tkNum('fs-body'), medium: true }));
      row.appendChild(key);
    }
    kb.appendChild(row);
  }
  wrap.appendChild(mockup('wd-number-keyboard', '金额输入自带键盘，避免系统键盘顶起页面', kb));

  /* wd-datetime-picker */
  const dt = frame('Picker', { dir: 'HORIZONTAL', gap: tkNum('sp-2'), align: 'CENTER', h: 88 });
  markFill(dt);
  const COLS = [
    ['9月', false],
    ['今天', true],
    ['12:30', false],
  ];
  for (const [label, active] of COLS) {
    const col = frame('Col/' + label, {
      dir: 'VERTICAL',
      gap: tkNum('sp-2'),
      align: 'CENTER',
      justify: 'CENTER',
      fill: active ? 'color-bg-subtle' : null,
      radius: tkNum('r-md'),
      h: 80,
    });
    markFill(col);
    col.appendChild(text(label, { size: active ? tkNum('fs-body') : tkNum('fs-caption'), medium: active, color: active ? 'color-text-primary' : 'color-text-tertiary' }));
    dt.appendChild(col);
  }
  wrap.appendChild(mockup('wd-datetime-picker', '三段式滚轮 + 惯性滚动，跨端一致', dt));

  /* wd-swipe-action */
  const swipe = frame('Swipe', { dir: 'HORIZONTAL', gap: 0, radius: tkNum('r-md'), clip: true, h: 56 });
  markFill(swipe);
  const content = frame('Content', { dir: 'HORIZONTAL', gap: tkNum('sp-3'), align: 'CENTER', padX: tkNum('sp-3'), fill: 'color-bg-surface' });
  markFill(content);
  content.appendChild(ellipse('Avatar', 28, 28, { fill: 'color-chart-c1' }));
  content.appendChild(text('肯德基 · ¥38.50', { size: tkNum('fs-caption') }));
  const delPanel = frame('Delete', { dir: 'HORIZONTAL', align: 'CENTER', justify: 'CENTER', fill: 'color-danger', w: 72, h: 56 });
  delPanel.appendChild(text('删除', { size: tkNum('fs-caption'), medium: true, color: 'color-text-inverse' }));
  swipe.appendChild(content);
  swipe.appendChild(delPanel);
  wrap.appendChild(mockup('wd-swipe-action', '左滑露出删除；同时只允许开一个（可选组件）', swipe));

  /* wd-img */
  const imgWrap = frame('ImgWrap', { dir: 'HORIZONTAL', align: 'CENTER', justify: 'CENTER', fill: 'color-bg-subtle', radius: tkNum('r-md'), h: 96 });
  markFill(imgWrap);
  imgWrap.appendChild(text('小票原图 · 点击放大', { size: tkNum('fs-tiny'), color: 'color-text-tertiary' }));
  wrap.appendChild(mockup('wd-img', '预览 + 双指缩放 + 多图切换', imgWrap));

  /* wd-loadmore */
  const lm = frame('Loadmore', { dir: 'VERTICAL', gap: tkNum('sp-2'), align: 'CENTER', padY: tkNum('sp-3'), w: 268 });
  for (const [label, color] of [['加载中…', 'color-text-tertiary'], ['没有更多了', 'color-text-tertiary'], ['加载失败，点击重试', 'color-accent']]) {
    lm.appendChild(text(label, { size: tkNum('fs-caption'), color }));
  }
  wrap.appendChild(mockup('wd-loadmore', '加载中 / 无更多 / 失败重试 三态', lm));
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 10. 03 Screens —— 5 个页面 + 状态变体
 * ═══════════════════════════════════════════════════════════════════════════════ */

function statusBar() {
  const f = frame('StatusBar', {
    dir: 'HORIZONTAL',
    gap: tkNum('sp-2'),
    padX: tkNum('sp-4'),
    align: 'CENTER',
    h: 44,
  });
  markFill(f);
  f.appendChild(text('9:41', { size: tkNum('fs-caption'), medium: true }));
  f.appendChild(spacer());
  f.appendChild(rect('Signal', 17, 10, { fill: 'color-text-primary', radius: 2 }));
  f.appendChild(rect('Wifi', 15, 10, { fill: 'color-text-primary', radius: 2 }));
  f.appendChild(rect('Battery', 24, 11, { fill: 'color-text-primary', radius: 3 }));
  return f;
}

/** 手机画板：375×812，顶部状态栏，底部 tabBar 由各页面自行追加 */
function phoneFrame(name) {
  const f = frame(name, {
    dir: 'VERTICAL',
    gap: 0,
    fill: 'color-bg-base',
    w: SCREEN_W,
    h: SCREEN_H,
    clip: true,
  });
  f.appendChild(statusBar());
  return f;
}

function navBar(title, withArrow) {
  const f = frame('NavBar', {
    dir: 'HORIZONTAL',
    gap: tkNum('sp-2'),
    padX: tkNum('sp-4'),
    align: 'CENTER',
    h: 44,
  });
  markFill(f);
  f.appendChild(text(title, { size: tkNum('fs-h2'), medium: true }));
  if (withArrow) f.appendChild(text('⌄', { size: tkNum('fs-body'), color: 'color-text-secondary' }));
  return f;
}

function tabBar(active) {
  const wrap = frame('TabBarWrap', { dir: 'VERTICAL', gap: 0 });
  markFill(wrap);
  wrap.appendChild(hairline(SCREEN_W, { name: 'TopLine' }));

  const f = frame('TabBar', { dir: 'HORIZONTAL', gap: 0, align: 'CENTER', h: TABBAR_H, fill: 'color-bg-surface' });
  markFill(f);
  for (const [kind, label] of [
    ['home', '首页'],
    ['chart', '统计'],
    ['user', '我的'],
  ]) {
    const on = label === active;
    const col = frame('Tab/' + label, { dir: 'VERTICAL', gap: 2, align: 'CENTER', justify: 'CENTER' });
    markFill(col);
    markStretch(col);
    col.appendChild(iconBox(kind, on ? 'color-accent' : 'color-text-tertiary'));
    col.appendChild(text(label, { size: tkNum('fs-tiny'), color: on ? 'color-accent' : 'color-text-tertiary' }));
    f.appendChild(col);
  }
  wrap.appendChild(f);
  return wrap;
}

/** 首页的 FAB：绝对定位在右下（距右 16，距 tabBar 上方 24） */
function fab() {
  const f = frame('FAB', {
    dir: 'HORIZONTAL',
    align: 'CENTER',
    justify: 'CENTER',
    fill: 'color-accent',
    radius: tkNum('r-full'),
    shadow: 'sh-2',
    w: 56,
    h: 56,
  });
  f.appendChild(iconBox('camera', 'color-text-inverse'));
  return f;
}

function pill(label, on) {
  const f = frame('Pill/' + label, {
    dir: 'HORIZONTAL',
    align: 'CENTER',
    justify: 'CENTER',
    padX: tkNum('sp-3'),
    radius: tkNum('r-full'),
    h: 28,
    fill: on ? 'color-accent-soft' : 'color-bg-subtle',
  });
  f.appendChild(text(label, { size: tkNum('fs-caption'), medium: on, color: on ? 'color-accent' : 'color-text-secondary' }));
  return f;
}

/** 列表项。Avatar 用 C/Avatar 实例，避免样式漂移 */
function recordItem(name, glyph, toneToken, amount, meta, badge) {
  const row = frame('RecordItem/' + name, {
    dir: 'HORIZONTAL',
    gap: tkNum('sp-3'),
    padX: tkNum('sp-4'),
    align: 'CENTER',
    h: 56,
  });
  markFill(row);

  let av = instance('C/Avatar', 'Size=md');
  if (!av) av = ellipse('Avatar', 40, 40, { fill: toneToken });
  try {
    av.fills = [paintVar(toneToken)];
  } catch (e) {
    /* 实例填充覆盖失败则保留默认色 */
  }
  setText(av, 'Glyph', glyph);
  row.appendChild(av);

  const info = frame('Info', { dir: 'VERTICAL', gap: 2 });
  markFill(info);
  info.appendChild(text(name, { size: tkNum('fs-body'), medium: true }));
  info.appendChild(text(meta, { size: tkNum('fs-caption'), color: 'color-text-secondary' }));
  row.appendChild(info);

  if (badge) {
    const tag = instance('C/Tag', badge);
    if (tag) row.appendChild(tag);
  }
  row.appendChild(text(amount, { size: tkNum('fs-body'), medium: true }));
  return row;
}

function groupTitle(label) {
  const f = frame('GroupTitle', { dir: 'HORIZONTAL', padX: tkNum('sp-4'), padTop: tkNum('sp-3'), padBottom: tkNum('sp-2') });
  markFill(f);
  f.appendChild(text(label, { size: tkNum('fs-caption'), color: 'color-text-tertiary' }));
  return f;
}

/* ── 首页 ─────────────────────────────────────────────────────────────────── */

function buildHome(name, state) {
  const s = phoneFrame(name);

  if (state === 'offline') {
    const bar = frame('OfflineBar', {
      dir: 'HORIZONTAL',
      align: 'CENTER',
      padX: tkNum('sp-4'),
      fill: 'color-warning',
      fillOpacity: 0.12,
      h: 22,
    });
    markFill(bar);
    bar.appendChild(text('当前无网络，记账会先存在本地', { size: tkNum('fs-tiny'), color: 'color-warning' }));
    s.appendChild(bar);
  }

  s.appendChild(navBar('9月', true));

  const body = frame('Body', {
    dir: 'VERTICAL',
    gap: tkNum('sp-4'),
    padX: tkNum('sp-4'),
    padTop: tkNum('sp-4'),
  });
  markFill(body);
  markGrow(body);
  s.appendChild(body);

  // 本月总支出
  const total = frame('TotalBlock', { dir: 'VERTICAL', gap: tkNum('sp-1'), padX: tkNum('sp-4') });
  markFill(total);
  if (state === 'loading') {
    total.appendChild(rect('SkeletonAmount', 220, 24, { fill: 'color-bg-subtle', radius: tkNum('r-sm') }));
    total.appendChild(rect('SkeletonCompare', 120, 14, { fill: 'color-bg-subtle', radius: tkNum('r-sm') }));
  } else if (state === 'empty') {
    total.appendChild(text('¥ 0.00', { size: tkNum('fs-display'), medium: true }));
  } else {
    total.appendChild(text('¥ 3,842.50', { size: tkNum('fs-display'), medium: true }));
    total.appendChild(text('较上月 ↓ 12.4%', { size: tkNum('fs-caption'), color: 'color-success' }));
  }
  // 负外边距不好表达，直接把 body 的左右内边距挪到子节点上
  body.paddingLeft = 0;
  body.paddingRight = 0;
  body.appendChild(total);

  if (state === 'empty') {
    const e = instance('C/Empty', 'State=no-data');
    if (e) body.appendChild(e);
  } else if (state === 'loading') {
    const sk = instance('C/Skeleton', 'Kind=list');
    if (sk) body.appendChild(sk);
  } else {
    const card = instance('C/Card', 'Elevation=elevated');
    if (card) body.appendChild(card);
  }

  if (state !== 'empty') {
    const pills = frame('Pills', { dir: 'HORIZONTAL', gap: tkNum('sp-2'), padX: tkNum('sp-4'), align: 'CENTER' });
    markFill(pills);
    for (const [label, on] of [
      ['全部', true],
      ['餐饮', false],
      ['交通', false],
      ['购物', false],
      ['更多', false],
    ]) {
      pills.appendChild(pill(label, on));
    }
    body.appendChild(pills);

    const list = frame('List', { dir: 'VERTICAL', gap: 0 });
    markFill(list);
    list.appendChild(groupTitle('今天'));
    list.appendChild(recordItem('餐饮', '餐', 'color-chart-c1', '¥38.50', '肯德基 · 12:30'));
    list.appendChild(recordItem('交通', '交', 'color-chart-c2', '¥12.00', '地铁 · 08:15', 'Appearance=soft, Tone=warning'));
    list.appendChild(groupTitle('昨天'));
    list.appendChild(recordItem('购物', '购', 'color-chart-c4', '¥156.80', '超市 · 19:40'));
    list.appendChild(recordItem('餐饮', '餐', 'color-chart-c1', '¥25.00', '午餐 · 12:05'));
    body.appendChild(list);
  }

  const f = fab();
  s.appendChild(f);
  f.layoutPositioning = 'ABSOLUTE';
  f.x = SCREEN_W - PAGE_PAD - 56;
  f.y = SCREEN_H - TABBAR_H - 24 - 56;

  s.appendChild(tabBar('首页'));
  return s;
}

/* ── 拍照识别 ─────────────────────────────────────────────────────────────── */

function buildCapture(name, denied) {
  const s = frame(name, {
    dir: 'VERTICAL',
    gap: 0,
    fill: 'color-bg-base',
    w: SCREEN_W,
    h: SCREEN_H,
    clip: true,
  });
  s.appendChild(statusBar());

  const close = frame('CloseRow', { dir: 'HORIZONTAL', padX: tkNum('sp-4'), padTop: tkNum('sp-2'), align: 'CENTER' });
  markFill(close);
  close.appendChild(text('✕', { size: tkNum('fs-h2'), color: 'color-text-primary' }));
  s.appendChild(close);

  const center = frame('Center', {
    dir: 'VERTICAL',
    gap: tkNum('sp-4'),
    align: 'CENTER',
    justify: 'CENTER',
  });
  markFill(center);
  markGrow(center);
  s.appendChild(center);

  if (denied) {
    const e = instance('C/Empty', 'State=error');
    if (e) {
      setText(e, 'Title', '还没拿到相机权限');
      setText(e, 'Desc', '去设置里打开相机，或直接用下面的「相册 / 手输」');
      setText(e, 'Action', '去开启相机权限');
      center.appendChild(e);
    }
  } else {
    // 取景框 311×411，四角 accent 描边
    const vf = frame('Viewfinder', {
      dir: 'HORIZONTAL',
      align: 'CENTER',
      justify: 'CENTER',
      fill: 'color-text-primary',
      radius: tkNum('r-lg'),
      w: 311,
      h: 411,
    });
    vf.appendChild(text('相机实时预览', { size: tkNum('fs-caption'), color: 'color-text-inverse' }));
    for (const [cn, cx, cy] of [
      ['TL', 0, 0],
      ['TR', 287, 0],
      ['BL', 0, 387],
      ['BR', 287, 387],
    ]) {
      const c = rect('Corner/' + cn, 24, 24, { fill: 'color-accent', radius: 4 });
      vf.appendChild(c);
      c.layoutPositioning = 'ABSOLUTE';
      c.x = cx;
      c.y = cy;
    }
    center.appendChild(vf);
    center.appendChild(text('把小票放进框里，光线亮一点', { size: tkNum('fs-caption'), color: 'color-text-secondary' }));
  }

  // 底部控制条：相册 / 快门 / 手输
  const bar = frame('CaptureBar', {
    dir: 'HORIZONTAL',
    gap: tkNum('sp-6'),
    align: 'CENTER',
    justify: 'CENTER',
    padY: tkNum('sp-6'),
  });
  markFill(bar);
  bar.appendChild(pill('相册', false));

  const shutter = frame('Shutter', {
    dir: 'HORIZONTAL',
    align: 'CENTER',
    justify: 'CENTER',
    fill: 'color-accent',
    radius: tkNum('r-full'),
    w: 72,
    h: 72,
  });
  shutter.appendChild(ellipse('Inner', 56, 56, { fill: 'color-bg-surface' }));
  bar.appendChild(shutter);

  bar.appendChild(pill('手输', false));
  s.appendChild(bar);
  return s;
}

/** 识别完成（ConfirmCard，同页覆盖） */
function buildConfirmCard(name) {
  const s = frame(name, {
    dir: 'VERTICAL',
    gap: 0,
    fill: 'color-bg-base',
    w: SCREEN_W,
    h: SCREEN_H,
    clip: true,
  });
  s.appendChild(statusBar());
  s.appendChild(navBar('确认一下'));

  const card = frame('ConfirmCard', {
    dir: 'VERTICAL',
    gap: tkNum('sp-4'),
    pad: tkNum('sp-4'),
  });
  markFill(card);
  markGrow(card);
  s.appendChild(card);

  // 降级琥珀条（正常识别时不显示）
  const warn = frame('DegradeBar', {
    dir: 'HORIZONTAL',
    align: 'CENTER',
    gap: tkNum('sp-2'),
    padX: tkNum('sp-3'),
    padY: tkNum('sp-2'),
    fill: 'color-warning',
    fillOpacity: 0.12,
    radius: tkNum('r-sm'),
  });
  markFill(warn);
  warn.appendChild(text('⚠ 自动识别不完全准，请确认', { size: tkNum('fs-tiny'), color: 'color-warning' }));
  card.appendChild(warn);

  const thumbRow = frame('ThumbRow', { dir: 'HORIZONTAL', gap: tkNum('sp-4'), align: 'MIN' });
  markFill(thumbRow);
  const thumb = frame('Thumb', {
    dir: 'HORIZONTAL',
    align: 'CENTER',
    justify: 'CENTER',
    fill: 'color-bg-subtle',
    radius: tkNum('r-md'),
    w: 88,
    h: 88,
  });
  thumb.appendChild(text('小票', { size: tkNum('fs-tiny'), color: 'color-text-tertiary' }));
  thumbRow.appendChild(thumb);

  const fields = frame('Fields', { dir: 'VERTICAL', gap: tkNum('sp-3') });
  markFill(fields);
  fields.appendChild(text('¥ 38.50', { size: tkNum('fs-h1'), medium: true }));
  fields.appendChild(text('肯德基', { size: tkNum('fs-body') }));
  const metaRow = frame('MetaRow', { dir: 'HORIZONTAL', gap: tkNum('sp-2'), align: 'CENTER' });
  metaRow.appendChild(text('餐饮 ⌄', { size: tkNum('fs-caption'), color: 'color-accent' }));
  metaRow.appendChild(text('今天 12:30', { size: tkNum('fs-caption'), color: 'color-text-secondary' }));
  fields.appendChild(metaRow);
  fields.appendChild(text('添加备注…', { size: tkNum('fs-caption'), color: 'color-text-tertiary' }));
  thumbRow.appendChild(fields);
  card.appendChild(thumbRow);

  card.appendChild(spacer());

  const actions = frame('Actions', { dir: 'HORIZONTAL', gap: tkNum('sp-3') });
  markFill(actions);

  const retake = instance('C/Button', 'Type=ghost, Size=lg');
  if (retake) {
    markGrow(retake);
    actions.appendChild(retake);
  }
  const save = instance('C/Button', 'Type=primary, Size=lg');
  if (save) {
    save.name = 'ConfirmSave';
    markGrow(save);
    actions.appendChild(save);
  }
  card.appendChild(actions);
  return s;
}

/* ── 统计 ─────────────────────────────────────────────────────────────────── */

/** canvas 2d 环形图的视觉等价物：用 arcData 画扇区（不依赖任何图表库） */
function makeDonut(size) {
  const holder = figma.createFrame();
  holder.name = 'Donut';
  holder.resize(size, size);
  holder.fills = [];
  holder.clipsContent = false;

  const SEGS = [
    ['color-chart-c1', 0.33],
    ['color-chart-c2', 0.16],
    ['color-chart-c3', 0.14],
    ['color-chart-c4', 0.09],
    ['color-chart-c5', 0.08],
    ['color-bg-subtle', 0.2],
  ];
  const total = SEGS.reduce((a, s) => a + s[1], 0);
  let angle = -Math.PI / 2;
  let ok = true;
  try {
    for (const [color, ratio] of SEGS) {
      const sweep = (ratio / total) * Math.PI * 2;
      const e = figma.createEllipse();
      e.name = 'Arc/' + color;
      e.resize(size, size);
      e.fills = [paintVar(color)];
      e.strokes = [];
      e.arcData = { startingAngle: angle, endingAngle: angle + sweep - 0.03, innerRadius: 0.62 };
      holder.appendChild(e);
      e.x = 0;
      e.y = 0;
      angle += sweep;
    }
  } catch (err) {
    ok = false;
  }
  if (!ok) {
    // 兜底：画不出来扇区就画一个灰环，不让整页生成失败
    for (const c of [...holder.children]) c.remove();
    const ringSize = Math.round(size - size * 0.14);
    const ring = ellipse('Ring', ringSize, ringSize, {
      stroke: 'color-bg-subtle',
      strokeWeight: Math.round(size * 0.14),
    });
    holder.appendChild(ring);
    ring.x = Math.round((size - ringSize) / 2);
    ring.y = Math.round((size - ringSize) / 2);
  }

  const center = frame('Center', { dir: 'VERTICAL', gap: 2, align: 'CENTER', justify: 'CENTER', w: size, h: size });
  holder.appendChild(center);
  center.x = 0;
  center.y = 0;
  center.appendChild(text('¥3,842', { size: tkNum('fs-h2'), medium: true, align: 'CENTER', width: size }));
  center.appendChild(text('本月', { size: tkNum('fs-tiny'), color: 'color-text-tertiary', align: 'CENTER', width: size }));
  return holder;
}

function catRow(name, toneToken, amount, pct, count, ratio) {
  const row = frame('Cat/' + name, { dir: 'VERTICAL', gap: tkNum('sp-2'), padX: tkNum('sp-4') });
  markFill(row);

  const line = frame('Line', { dir: 'HORIZONTAL', gap: tkNum('sp-2'), align: 'CENTER' });
  markFill(line);
  line.appendChild(ellipse('Dot', 8, 8, { fill: toneToken }));
  line.appendChild(text(name, { size: tkNum('fs-caption'), width: 56 }));
  line.appendChild(text(amount, { size: tkNum('fs-caption'), medium: true }));
  line.appendChild(spacer());
  line.appendChild(text(pct, { size: tkNum('fs-caption'), color: 'color-text-secondary' }));
  line.appendChild(text(count, { size: tkNum('fs-caption'), color: 'color-text-tertiary', width: 44, align: 'RIGHT' }));
  row.appendChild(line);

  const bar = frame('Bar', { dir: 'HORIZONTAL', h: 4, radius: tkNum('r-full'), fill: 'color-bg-subtle' });
  markFill(bar);
  bar.appendChild(
    frame('Fill', {
      dir: 'HORIZONTAL',
      h: 4,
      radius: tkNum('r-full'),
      fill: toneToken,
      w: Math.max(8, Math.round((SCREEN_W - 2 * PAGE_PAD) * ratio)),
    })
  );
  row.appendChild(bar);
  return row;
}

function buildStats(name, state) {
  const s = phoneFrame(name);
  s.appendChild(navBar('2026年9月', true));

  const body = frame('Body', {
    dir: 'VERTICAL',
    gap: tkNum('sp-4'),
    padX: tkNum('sp-4'),
    padTop: tkNum('sp-4'),
  });
  markFill(body);
  markGrow(body);
  s.appendChild(body);

  if (state === 'empty') {
    const e = instance('C/Empty', 'State=no-data');
    if (e) {
      setText(e, 'Title', '本月还没有记账');
      setText(e, 'Desc', '记几笔就能看到分类占比了');
      setText(e, 'Action', '去记一笔');
      body.appendChild(e);
    }
  } else {
    const card = frame('DonutCard', {
      dir: 'VERTICAL',
      gap: tkNum('sp-3'),
      pad: tkNum('sp-4'),
      align: 'CENTER',
      fill: 'color-bg-surface',
      radius: tkNum('r-lg'),
      shadow: 'sh-1',
    });
    markFill(card);
    card.appendChild(makeDonut(160));

    const meta = frame('Meta', { dir: 'HORIZONTAL', gap: tkNum('sp-4'), align: 'CENTER', justify: 'CENTER' });
    markFill(meta);
    meta.appendChild(text('日均 ¥128', { size: tkNum('fs-caption'), color: 'color-text-secondary' }));
    meta.appendChild(text('较上月 ↓12.4%', { size: tkNum('fs-caption'), color: 'color-success' }));
    card.appendChild(meta);
    body.appendChild(card);

    body.appendChild(text('分类明细', { size: tkNum('fs-h2'), medium: true, width: SCREEN_W - 2 * PAGE_PAD }));
    const rows = [
      ['餐饮', 'color-chart-c1', '¥1,280', '33%', '12笔', 0.33],
      ['交通', 'color-chart-c2', '¥620', '16%', '8笔', 0.16],
      ['购物', 'color-chart-c4', '¥540', '14%', '5笔', 0.14],
      ['其他', 'color-chart-c5', '¥680', '18%', '7笔', 0.18],
      ['未分类', 'color-bg-subtle', '¥722', '19%', '6笔', 0.19],
    ];
    for (const r of rows) body.appendChild(catRow(r[0], r[1], r[2], r[3], r[4], r[5]));
  }

  s.appendChild(tabBar('统计'));
  return s;
}

/* ── 账单详情 ─────────────────────────────────────────────────────────────── */

function detailRow(label, value, arrow) {
  const row = frame('Field/' + label, {
    dir: 'HORIZONTAL',
    gap: tkNum('sp-3'),
    padX: tkNum('sp-4'),
    align: 'CENTER',
    h: 44,
  });
  markFill(row);
  row.appendChild(text(label, { size: tkNum('fs-body') }));
  row.appendChild(spacer());
  row.appendChild(text(value, { size: tkNum('fs-body'), medium: true, color: 'color-text-secondary', align: 'RIGHT' }));
  if (arrow) row.appendChild(text('›', { size: tkNum('fs-h2'), color: 'color-text-tertiary' }));
  return row;
}

function buildDetail(name) {
  const s = phoneFrame(name);
  s.appendChild(navBar('←　账单详情'));

  const body = frame('Body', {
    dir: 'VERTICAL',
    gap: tkNum('sp-4'),
    padX: tkNum('sp-4'),
    padTop: tkNum('sp-4'),
  });
  markFill(body);
  markGrow(body);
  s.appendChild(body);

  const img = frame('ReceiptImage', {
    dir: 'HORIZONTAL',
    align: 'CENTER',
    justify: 'CENTER',
    fill: 'color-bg-subtle',
    radius: tkNum('r-lg'),
    h: 160,
  });
  markFill(img);
  img.appendChild(text('小票原图 · 点击全屏预览（wd-img）', { size: tkNum('fs-tiny'), color: 'color-text-tertiary' }));
  body.appendChild(img);

  const card = frame('FieldCard', {
    dir: 'VERTICAL',
    gap: 0,
    fill: 'color-bg-surface',
    radius: tkNum('r-lg'),
  });
  markFill(card);
  card.appendChild(detailRow('金额', '¥ 38.50', false));
  card.appendChild(hairline(SCREEN_W - 2 * PAGE_PAD - 2 * PAGE_PAD, { name: 'Divider1' }));
  card.appendChild(detailRow('类型', '支出 ⌄', true));
  card.appendChild(detailRow('分类', '餐饮 ⌄', true));
  card.appendChild(detailRow('商家', '肯德基', false));
  card.appendChild(detailRow('时间', '今天 12:30', true));
  card.appendChild(detailRow('备注', '点击填写', true));
  body.appendChild(card);

  body.appendChild(
    text('识别信息：多模态识别 · 置信 0.92 · 耗时 1.8s', {
      size: tkNum('fs-tiny'),
      color: 'color-text-tertiary',
      width: SCREEN_W - 2 * PAGE_PAD,
    })
  );

  const del = frame('DeleteBlock', {
    dir: 'HORIZONTAL',
    align: 'CENTER',
    justify: 'CENTER',
    fill: 'color-bg-surface',
    radius: tkNum('r-lg'),
    h: 48,
  });
  markFill(del);
  del.appendChild(text('删除这笔账单', { size: tkNum('fs-body'), medium: true, color: 'color-danger' }));
  body.appendChild(del);

  return s;
}

/* ── 我的 ─────────────────────────────────────────────────────────────────── */

function buildProfile(name) {
  const s = phoneFrame(name);
  s.appendChild(navBar('我的'));

  const body = frame('Body', {
    dir: 'VERTICAL',
    gap: tkNum('sp-5'),
    padX: tkNum('sp-4'),
    padTop: tkNum('sp-4'),
  });
  markFill(body);
  markGrow(body);
  s.appendChild(body);

  const user = frame('UserCard', {
    dir: 'HORIZONTAL',
    gap: tkNum('sp-3'),
    align: 'CENTER',
    pad: tkNum('sp-4'),
    fill: 'color-bg-surface',
    radius: tkNum('r-lg'),
    shadow: 'sh-1',
  });
  markFill(user);
  const av = instance('C/Avatar', 'Size=md');
  if (av) user.appendChild(av);
  const info = frame('Info', { dir: 'VERTICAL', gap: 2 });
  markFill(info);
  info.appendChild(text('记账小能手', { size: tkNum('fs-h2'), medium: true }));
  info.appendChild(text('已记账 128 笔 · 92 天', { size: tkNum('fs-caption'), color: 'color-text-secondary' }));
  user.appendChild(info);
  body.appendChild(user);

  const groups = [
    [
      '数据',
      [
        ['每日记账提醒', '', 'Variant=with-switch-on'],
        ['数据同步', '已同步', 'Variant=clickable'],
        ['清理本地缓存', '12.4MB', 'Variant=with-arrow'],
      ],
    ],
    [
      '隐私与关于',
      [
        ['隐私保护指引', '', 'Variant=with-arrow'],
        ['性能数据上报', '', 'Variant=with-switch-off'],
        ['版本号 v1.0.0', '连点 5 次进入开发面板', 'Variant=clickable'],
      ],
    ],
  ];
  for (const [title, rows] of groups) {
    body.appendChild(text(title, { size: tkNum('fs-caption'), color: 'color-text-tertiary', width: SCREEN_W - 2 * PAGE_PAD }));
    const card = frame('Card/' + title, { dir: 'VERTICAL', gap: 0, fill: 'color-bg-surface', radius: tkNum('r-lg') });
    markFill(card);
    for (const [label, value, variantName] of rows) {
      const cell = instance('C/Cell', variantName);
      if (!cell) continue;
      setText(cell, 'Label', label);
      if (value) setText(cell, 'Value', value);
      markFill(cell);
      card.appendChild(cell);
    }
    body.appendChild(card);
  }

  s.appendChild(tabBar('我的'));
  return s;
}

/* ── 组装 03 Screens ─────────────────────────────────────────────────────── */

function genScreens(page) {
  const COL = SCREEN_W + 72;
  const refs = {};

  refs.home = buildHome('P/首页', 'default');
  refs.capture = buildCapture('P/拍照识别', false);
  refs.confirm = buildConfirmCard('P/识别完成');
  refs.stats = buildStats('P/统计', 'default');
  refs.detail = buildDetail('P/账单详情');
  refs.profile = buildProfile('P/我的');

  const variants = [
    buildHome('P/首页/加载中', 'loading'),
    buildHome('P/首页/空态', 'empty'),
    buildHome('P/首页/离线', 'offline'),
    buildStats('P/统计/空态', 'empty'),
    buildCapture('P/拍照识别/未授权相机', true),
  ];

  const all = [
    [refs.home, 0, 0],
    [refs.capture, COL, 0],
    [refs.confirm, COL * 2, 0],
    [refs.stats, COL * 3, 0],
    [refs.detail, COL * 4, 0],
    [refs.profile, COL * 5, 0],
  ];
  variants.forEach((s, i) => all.push([s, (i % 3) * COL, 1000 + Math.floor(i / 3) * 1000]));

  for (const [node, x, y] of all) {
    page.appendChild(node);
    node.x = x;
    node.y = y;
  }

  // 屏幕树已建完，统一落 FILL / GROW 意图
  applySizeIntents();
  return refs;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 11. 04 Prototype —— 首页 → 拍照 → 确认卡 → 首页
 * ═══════════════════════════════════════════════════════════════════════════════ */

function link(fromNode, destNode) {
  if (!fromNode || !destNode) return false;
  try {
    fromNode.reactions = [
      {
        trigger: { type: 'ON_CLICK' },
        actions: [
          {
            type: 'NODE',
            destinationId: destNode.id,
            navigation: 'NAVIGATE',
            transition: null,
            preserveScrollPosition: false,
          },
        ],
      },
    ];
    return true;
  } catch (e) {
    return false;
  }
}

function genPrototype(page, refs) {
  const COL = SCREEN_W + 72;
  const order = [refs.home, refs.capture, refs.confirm, refs.home];
  const clones = [];

  for (let i = 0; i < order.length; i++) {
    if (!order[i]) continue;
    const c = order[i].clone();
    c.name = i === order.length - 1 ? 'P/首页（闭环回到起点）' : order[i].name + '（原型）';
    page.appendChild(c);
    c.x = i * COL;
    c.y = 0;
    clones.push(c);
  }

  // 首页 FAB → 拍照
  link(findChild(clones[0], 'FAB'), clones[1]);
  // 快门 → 确认卡
  link(findChild(clones[1], 'Shutter'), clones[2]);
  // 确认保存 → 回到首页
  link(findChild(clones[2], 'ConfirmSave'), clones[3]);

  // 原型起始点（部分账号/版本不支持，失败不影响生成）
  try {
    page.flowStartingPoints = [{ nodeId: clones[0].id, name: '记账主流程' }];
  } catch (e) {
    /* 忽略 */
  }

  const note = text(
    '连线：首页 FAB → 拍照（快门）→ 识别确认卡（确认保存）→ 首页。\n在右侧 Prototype 面板点播放即可验证主流程。',
    { size: tkNum('fs-caption'), color: 'color-text-secondary', width: 640 }
  );
  page.appendChild(note);
  note.x = 0;
  note.y = SCREEN_H + 48;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * 12. 入口
 * ═══════════════════════════════════════════════════════════════════════════════ */

(async function main() {
  const t0 = Date.now();
  try {
    figma.skipInvisibleInstanceChildren = true;
    await figma.loadAllPagesAsync();

    const fontFamily = await loadFont();
    const varsOk = createVariables();

    const cover = await ensurePage(PAGES.cover);
    await setPage(cover);
    genCover(cover);

    const foundations = await ensurePage(PAGES.foundations);
    await setPage(foundations);
    genFoundations(foundations);

    const components = await ensurePage(PAGES.components);
    await setPage(components);
    genComponents(components);

    const screens = await ensurePage(PAGES.screens);
    await setPage(screens);
    const refs = genScreens(screens);

    const prototype = await ensurePage(PAGES.prototype);
    await setPage(prototype);
    genPrototype(prototype, refs);

    await setPage(cover);

    const total = TOKENS.length;
    figma.notify(
      '✅ 设计稿生成完成（' +
        (Date.now() - t0) +
        'ms）\n' +
        'Token ' +
        total +
        ' 个　变量集合：' +
        (varsOk ? 'SnapLedger Tokens' : '已降级（未创建变量，色值仍已写入）') +
        '\n字体：' +
        fontFamily +
        (SIZE_INTENT_FAILURES ? '\n⚠ ' + SIZE_INTENT_FAILURES + ' 处布局意图未应用，请看 Console' : '') +
        '\n5 个 Page 已就绪，接下来靠你改细节 —— 这正是学 Auto Layout / Variables / Variants 的过程',
      { timeout: 9000 }
    );
  } catch (e) {
    figma.notify('❌ 生成失败：' + (e && e.message ? e.message : String(e)), { error: true, timeout: 12000 });
  } finally {
    setTimeout(() => figma.closePlugin(), 150);
  }
})();
