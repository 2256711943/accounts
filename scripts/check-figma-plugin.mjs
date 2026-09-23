#!/usr/bin/env node
/**
 * scripts/check-figma-plugin.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * 在 Node 里**真正执行** design/figma-plugin/code.js，不打开 Figma 也能发现
 * 运行时错误。
 *
 * 为什么需要它：
 *   `node --check` 只验证语法。插件 90% 的坑是 API 使用约束，例如
 *     - layoutSizingHorizontal='FILL' 时节点还没挂在自动布局父级下 → 抛错
 *     - resize() 收到 NaN / 0
 *     - 字体没 loadFontAsync 就写 characters → 抛错
 *     - 颜色值不在 0..1
 *   这些只有真跑一遍才暴露。本脚本用一个行为近似 Figma 的 mock 把 code.js
 *   跑完，逐条检查上面这些约束，并断言生成结果的关键结构。
 *
 * 用法：npm run check:figma        （SG_MOCK_FONTS=inter-only 可测字体兜底路径）
 *
 * ⚠️ 它验证的是「逻辑与 API 用法」，不是「视觉」。真实几何由 Figma 计算，
 *    这里只做近似（够用来发现 NaN 与层级错误）。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CODE = resolve(ROOT, 'design/figma-plugin/code.js');

/* ── 收集器 ─────────────────────────────────────────────────────────────────── */
const problems = [];
const warnings = [];
const notes = [];
const counters = { nodes: 0, pages: 0, variables: 0, components: 0, sets: 0, instances: 0 };
const LOADED_FONTS = new Set();

/* ── 允许存在的字体（近似「本机 Figma」的可选字族） ───────────────────────── */
const ALLOWED_FONTS =
  process.env.SG_MOCK_FONTS === 'inter-only'
    ? { Inter: ['Regular', 'Medium'] }
    : { Inter: ['Regular', 'Medium'], 'Microsoft YaHei': ['Regular', 'Bold'] };

const isAutoLayout = (n) => !!n && n.layoutMode && n.layoutMode !== 'NONE';
const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/* ── 节点基类 ───────────────────────────────────────────────────────────────── */
class BaseNode {
  constructor(type) {
    counters.nodes++;
    this.type = type;
    this.id = type.toLowerCase() + ':' + counters.nodes;
    this.name = type;
    this.parent = null;
    this.children = [];
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.fills = [];
    this.strokes = [];
    this.effects = [];
    this.opacity = 1;
    this.visible = true;
    this.cornerRadius = 0;
    this.clipsContent = true;
    this.layoutMode = 'NONE';
    this.itemSpacing = 0;
    this.paddingTop = 0;
    this.paddingBottom = 0;
    this.paddingLeft = 0;
    this.paddingRight = 0;
    this.primaryAxisSizingMode = 'AUTO';
    this.counterAxisSizingMode = 'AUTO';
    this.counterAxisSpacing = 0;
    this.primaryAxisAlignItems = 'MIN';
    this.counterAxisAlignItems = 'MIN';
    this.layoutWrap = 'NO_WRAP';
    this.strokeWeight = 1;
    this.strokeAlign = 'CENTER';
    this.reactions = [];
    this.rotation = 0;
    this._layoutSizingHorizontal = null;
    this._layoutSizingVertical = null;
    this._layoutAlign = null;
    this._layoutGrow = null;
    this.layoutPositioning = 'AUTO';
    this._boundVariables = {};
  }

  get layoutSizingHorizontal() {
    return this._layoutSizingHorizontal || 'FIXED';
  }
  set layoutSizingHorizontal(v) {
    if ((v === 'FILL' || v === 'HUG') && !isAutoLayout(this.parent)) {
      throw new Error(
        `layoutSizingHorizontal='${v}' 失败：节点「${this.name}」没有自动布局父级（parent=${this.parent ? this.parent.name : 'null'}）`
      );
    }
    this._layoutSizingHorizontal = v;
    relayoutUp(this.parent);
  }

  get layoutSizingVertical() {
    return this._layoutSizingVertical || 'FIXED';
  }
  set layoutSizingVertical(v) {
    if ((v === 'FILL' || v === 'HUG') && !isAutoLayout(this.parent)) {
      throw new Error(
        `layoutSizingVertical='${v}' 失败：节点「${this.name}」没有自动布局父级（parent=${this.parent ? this.parent.name : 'null'}）`
      );
    }
    this._layoutSizingVertical = v;
    relayoutUp(this.parent);
  }

  get layoutAlign() {
    return this._layoutAlign || 'INHERIT';
  }
  set layoutAlign(v) {
    if (v === 'STRETCH' && !isAutoLayout(this.parent)) {
      throw new Error(`layoutAlign='STRETCH' 失败：节点「${this.name}」没有自动布局父级`);
    }
    this._layoutAlign = v;
    relayoutUp(this.parent);
  }

  get layoutGrow() {
    return this._layoutGrow || 0;
  }
  set layoutGrow(v) {
    if (v && !isAutoLayout(this.parent)) {
      throw new Error(`layoutGrow=${v} 失败：节点「${this.name}」没有自动布局父级`);
    }
    this._layoutGrow = v;
    relayoutUp(this.parent);
  }

  resize(w, h) {
    if (!finite(w) || !finite(h)) {
      throw new Error(`resize 收到非法尺寸 ${w} x ${h} @ 「${this.name}」`);
    }
    if (w <= 0 || h <= 0) {
      throw new Error(`resize 收到非正尺寸 ${w} x ${h} @ 「${this.name}」`);
    }
    this.width = w;
    this.height = h;
    if (isAutoLayout(this)) {
      this.primaryAxisSizingMode = 'FIXED';
      this.counterAxisSizingMode = 'FIXED';
    }
    relayoutUp(this.parent);
    return this;
  }

  appendChild(child) {
    if (!child || typeof child !== 'object') {
      throw new Error(`appendChild 收到非法节点 @ 「${this.name}」`);
    }
    if (child.parent) child.parent.children = child.parent.children.filter((c) => c !== child);
    child.parent = this;
    this.children.push(child);
    relayoutUp(this);
    return child;
  }

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }

  setBoundVariable(prop, variable) {
    this._boundVariables[prop] = variable;
  }

  clone() {
    const copy = deepClone(this);
    copy.parent = null;
    counters.nodes += countNodes(copy) - 1;
    return copy;
  }
}

class FrameNode extends BaseNode {
  constructor() {
    super('FRAME');
    this.name = 'Frame';
  }
}
class RectangleNode extends BaseNode {
  constructor() {
    super('RECTANGLE');
    this.name = 'Rectangle';
  }
}
class EllipseNode extends BaseNode {
  constructor() {
    super('ELLIPSE');
    this.name = 'Ellipse';
    this._arcData = { startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: 0 };
  }
  get arcData() {
    return this._arcData;
  }
  set arcData(v) {
    if (!v || !finite(v.startingAngle) || !finite(v.endingAngle) || !finite(v.innerRadius)) {
      throw new Error(`arcData 非法 @ 「${this.name}」：` + JSON.stringify(v));
    }
    this._arcData = v;
  }
}
class PolygonNode extends BaseNode {
  constructor() {
    super('POLYGON');
    this.name = 'Polygon';
    this.pointCount = 3;
  }
}
class TextNode extends BaseNode {
  constructor() {
    super('TEXT');
    this.name = 'Text';
    this.fontName = { family: 'Inter', style: 'Regular' };
    this.fontSize = 12;
    this.lineHeight = { unit: 'AUTO' };
    this.textAlignHorizontal = 'LEFT';
    this.textAutoResize = 'NONE';
    this._characters = '';
  }
  get characters() {
    return this._characters;
  }
  set characters(v) {
    if (typeof v !== 'string') throw new Error(`characters 必须是字符串 @ 「${this.name}」`);
    const key = this.fontName.family + '|' + this.fontName.style;
    if (!LOADED_FONTS.has(key)) {
      throw new Error(`写 characters 前必须先 loadFontAsync(${key}) @ 「${this.name}」`);
    }
    this._characters = v;
    const lines = v.split('\n').length;
    const size = this.fontSize;
    if (this.textAutoResize === 'HEIGHT' || this.textAutoResize === 'WIDTH_AND_HEIGHT') {
      this.height = Math.max(size, Math.round(size * 1.4 * lines));
      if (this.textAutoResize === 'WIDTH_AND_HEIGHT') {
        this.width = Math.max(size, Math.round(v.length * size * 0.6));
      }
    }
    relayoutUp(this.parent);
  }
}

class ComponentNode extends BaseNode {
  constructor() {
    super('COMPONENT');
    this.name = 'Component';
    counters.components++;
  }
  createInstance() {
    const inst = deepClone(this);
    markInstances(inst);
    counters.instances++;
    return inst;
  }
}
class ComponentSetNode extends BaseNode {
  constructor() {
    super('COMPONENT_SET');
    this.name = 'ComponentSet';
    counters.sets++;
  }
  get defaultVariant() {
    return this.children[0] || null;
  }
}
class InstanceNode extends BaseNode {
  constructor() {
    super('INSTANCE');
    this.name = 'Instance';
  }
}
class PageNode extends BaseNode {
  constructor() {
    super('PAGE');
    this.name = 'Page';
    counters.pages++;
    this.flowStartingPoints = [];
  }
}

/**
 * 真实 Figma 里，改 padding / spacing / sizing 模式会**立即**重算自动布局尺寸。
 * 这里补上同样的联动，否则 mock 里的 f.height 会停在 0，
 * 导致「只固定宽、高度自适应」这种写法在 mock 里假报错。
 */
for (const prop of [
  'layoutMode',
  'itemSpacing',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'counterAxisSpacing',
  'primaryAxisSizingMode',
  'counterAxisSizingMode',
  'layoutWrap',
]) {
  const key = '_' + prop;
  Object.defineProperty(BaseNode.prototype, prop, {
    configurable: true,
    get() {
      return this[key];
    },
    set(v) {
      this[key] = v;
      relayoutUp(this);
    },
  });
}

/** 把子树标记为 INSTANCE（近似 Figma 的实例语义） */
function markInstances(node) {
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') return;
  node.type = 'INSTANCE';
  for (const c of node.children) markInstances(c);
}

function deepClone(node) {
  const copy = Object.create(Object.getPrototypeOf(node));
  Object.assign(copy, node);
  copy.children = [];
  copy.parent = null;
  copy._boundVariables = { ...node._boundVariables };
  for (const c of node.children) {
    const cc = deepClone(c);
    cc.parent = copy;
    copy.children.push(cc);
  }
  return copy;
}

function countNodes(node) {
  return 1 + node.children.reduce((a, c) => a + countNodes(c), 0);
}

/**
 * 近似自动布局：只算主轴/交叉轴的 hug 尺寸。
 * 不做真实换行与 FILL 分配 —— 够用来发现 NaN 与节点数异常。
 */
function relayout(node) {
  if (!isAutoLayout(node)) return;
  const vertical = node.layoutMode === 'VERTICAL';
  const kids = node.children.filter((c) => c.layoutPositioning !== 'ABSOLUTE');
  const gap = node.itemSpacing || 0;

  let main = 0;
  let cross = 0;
  if (!kids.length) {
    main = 0;
    cross = 0;
  } else if (node.layoutWrap === 'WRAP') {
    main = kids.reduce((a, c) => a + (vertical ? c.height : c.width), 0) + gap * (kids.length - 1);
    cross = Math.max(...kids.map((c) => (vertical ? c.width : c.height)));
  } else {
    main = kids.reduce((a, c) => a + (vertical ? c.height : c.width), 0) + gap * (kids.length - 1);
    cross = Math.max(...kids.map((c) => (vertical ? c.width : c.height)));
  }

  const mainHug = (vertical ? node.primaryAxisSizingMode : node.counterAxisSizingMode) === 'AUTO';
  const crossHug = (vertical ? node.counterAxisSizingMode : node.primaryAxisSizingMode) === 'AUTO';

  if (vertical) {
    if (mainHug) node.height = node.paddingTop + node.paddingBottom + main;
    if (crossHug) node.width = node.paddingLeft + node.paddingRight + cross;
  } else {
    if (mainHug) node.width = node.paddingLeft + node.paddingRight + main;
    if (crossHug) node.height = node.paddingTop + node.paddingBottom + cross;
  }
  if (!finite(node.width) || !finite(node.height)) {
    problems.push(`自动布局算出非法尺寸 @ 「${node.name}」：${node.width} x ${node.height}`);
  }
}

function relayoutUp(node) {
  let cur = node;
  let guard = 0;
  while (cur && guard++ < 200) {
    relayout(cur);
    cur = cur.parent;
  }
}

/* ── 颜色校验 ───────────────────────────────────────────────────────────────── */
function checkPaint(n, where) {
  if (!Array.isArray(n)) return;
  n.forEach((p, i) => {
    if (!p || typeof p !== 'object') {
      problems.push(`${where} 的 fills[${i}] 不是对象`);
      return;
    }
    if (p.type !== 'SOLID') problems.push(`${where} 的 fills[${i}].type=${p.type}（只支持 SOLID）`);
    if (!p.color) return;
    for (const ch of ['r', 'g', 'b']) {
      const v = p.color[ch];
      if (!finite(v) || v < 0 || v > 1) problems.push(`${where} 的 fills[${i}].color.${ch} 越界：${v}`);
    }
    if (p.opacity != null && (!finite(p.opacity) || p.opacity < 0 || p.opacity > 1)) {
      problems.push(`${where} 的 fills[${i}].opacity 越界：${p.opacity}`);
    }
  });
}

/* ── figma mock ─────────────────────────────────────────────────────────────── */
const doc = { type: 'DOCUMENT', name: 'Document', children: [] };
let currentPage = null;
let closed = false;
let resolveClose;
const closedPromise = new Promise((r) => (resolveClose = r));

const collectionModes = {};

const figma = {
  skipInvisibleInstanceChildren: false,
  root: doc,
  get currentPage() {
    return currentPage;
  },
  set currentPage(p) {
    currentPage = p;
  },
  async loadAllPagesAsync() {},
  async loadFontAsync(font) {
    const styles = ALLOWED_FONTS[font && font.family];
    if (!styles || styles.indexOf(font.style) === -1) {
      throw new Error(`字体不存在：${font && font.family} ${font && font.style}`);
    }
    LOADED_FONTS.add(font.family + '|' + font.style);
    return null;
  },
  async setCurrentPageAsync(p) {
    if (!p || doc.children.indexOf(p) === -1) throw new Error('setCurrentPageAsync 收到不在文档里的页面');
    currentPage = p;
  },
  createFrame() {
    return new FrameNode();
  },
  createRectangle() {
    return new RectangleNode();
  },
  createEllipse() {
    return new EllipseNode();
  },
  createPolygon() {
    return new PolygonNode();
  },
  createText() {
    return new TextNode();
  },
  createComponent() {
    return new ComponentNode();
  },
  createPage() {
    const p = new PageNode();
    doc.children.push(p);
    return p;
  },
  combineAsVariants(nodes, parent) {
    if (!Array.isArray(nodes) || nodes.length < 2) throw new Error('combineAsVariants 至少需要 2 个组件');
    for (const n of nodes) {
      if (n.parent !== parent) throw new Error(`combineAsVariants：组件「${n.name}」不是 parent 的子节点`);
    }
    const set = new ComponentSetNode();
    parent.appendChild(set);
    for (const n of nodes) set.appendChild(n);
    return set;
  },
  notify(msg, opts) {
    const isError = !!(opts && opts.error);
    if (isError) problems.push('插件内部报错：' + String(msg).replace(/\n/g, ' | '));
    else notes.push(String(msg).replace(/\n/g, ' | '));
  },
  closePlugin() {
    closed = true;
    if (resolveClose) resolveClose();
  },
  variables: {
    createVariableCollection(name) {
      const id = String(Object.keys(collectionModes).length + 1);
      collectionModes[id] = { name, modeId: id + ':0' };
      return {
        name,
        defaultModeId: id + ':0',
        createVariable(varName, type) {
          counters.variables++;
          if (!varName || typeof varName !== 'string') throw new Error('变量名必须是字符串');
          const v = {
            name: varName,
            resolvedType: type,
            scopes: ['ALL_SCOPES'],
            values: {},
            setValueForMode(mode, value) {
              if (type === 'COLOR') {
                if (!value || !finite(value.r) || !finite(value.g) || !finite(value.b)) {
                  throw new Error(`COLOR 变量 ${varName} 的值非法：` + JSON.stringify(value));
                }
                for (const ch of ['r', 'g', 'b', 'a']) {
                  const cv = value[ch];
                  if (cv != null && (cv < 0 || cv > 1)) {
                    throw new Error(`COLOR 变量 ${varName} 的 ${ch} 越界：${cv}`);
                  }
                }
              } else if (!finite(value)) {
                throw new Error(`FLOAT 变量 ${varName} 的值非法：${value}`);
              }
              this.values[mode] = value;
            },
          };
          return v;
        },
      };
    },
    setBoundVariableForPaint(paint, field, variable) {
      if (!variable || typeof variable.name !== 'string') throw new Error('setBoundVariableForPaint 收到非法变量');
      return { ...paint, boundVariables: { [field]: variable.name } };
    },
  },
};

/* 属性写入后做一次颜色校验（用 Proxy 拦 fills） */
function guardColors(node) {
  const seen = new WeakSet();
  const walk = (n) => {
    if (!n || typeof n !== 'object' || seen.has(n)) return;
    seen.add(n);
    checkPaint(n.fills, `「${n.name}」`);
    for (const c of n.children || []) walk(c);
  };
  walk(node);
}

/* ── 执行 code.js ───────────────────────────────────────────────────────────── */
const src = readFileSync(CODE, 'utf8');

if (!/const TOKENS = \[/.test(src)) {
  console.error('✗ code.js 的 TOKENS 区还没注入，请先跑 npm run gen:figma');
  process.exit(1);
}

const sandbox = {
  figma,
  console: {
    log: (...a) => notes.push('log: ' + a.join(' ')),
    warn: (...a) => warnings.push(a.join(' ')),
    error: (...a) => problems.push('console.error: ' + a.join(' ')),
  },
  setTimeout,
  clearTimeout,
  Math,
  JSON,
  Date,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Set,
  Map,
  Promise,
  Error,
  RegExp,
  parseInt,
  parseFloat,
  isNaN,
  NaN,
  Infinity,
  undefined,
};

let thrown = null;
try {
  vm.runInNewContext(src, vm.createContext(sandbox), { filename: 'code.js' });
} catch (e) {
  thrown = e;
}
await Promise.race([closedPromise, new Promise((r) => setTimeout(r, 15000))]);

/* ── 结构断言 ──────────────────────────────────────────────────────────────── */
const pageByName = (n) => doc.children.find((p) => p.name === n);

const EXPECT_PAGES = ['00 Cover', '01 Foundations', '02 Components', '03 Screens', '04 Prototype'];
const EXPECT_SETS = ['C/Button', 'C/Cell', 'C/Card', 'C/Tag', 'C/Avatar', 'C/Skeleton', 'C/Empty'];
const EXPECT_SCREENS = [
  'P/首页',
  'P/首页/加载中',
  'P/首页/空态',
  'P/首页/离线',
  'P/拍照识别',
  'P/拍照识别/未授权相机',
  'P/识别完成',
  'P/统计',
  'P/统计/空态',
  'P/账单详情',
  'P/我的',
];

const collect = (root, cb, out = []) => {
  cb(root, out);
  for (const c of root.children || []) collect(c, cb, out);
  return out;
};
const allNodes = () => collect({ name: 'DOC', children: doc.children }, (n, out) => out.push(n));

const foundNames = new Set(allNodes().map((n) => n.name));

const missing = [];
for (const p of EXPECT_PAGES) if (!pageByName(p)) missing.push('Page ' + p);
for (const s of EXPECT_SETS) if (!foundNames.has(s)) missing.push('组件集 ' + s);
for (const s of EXPECT_SCREENS) if (!foundNames.has(s)) missing.push('页面画板 ' + s);
if (missing.length) problems.push('缺少预期节点：' + missing.join('、'));

// 变体数量
const EXPECT_VARIANTS = { 'C/Button': 12, 'C/Cell': 5, 'C/Card': 2, 'C/Tag': 10, 'C/Avatar': 2, 'C/Skeleton': 3, 'C/Empty': 3 };
const setInfo = [];
for (const [setName, expect] of Object.entries(EXPECT_VARIANTS)) {
  const set = allNodes().find((n) => n.name === setName && n.type === 'COMPONENT_SET');
  if (!set) continue;
  const n = set.children.length;
  setInfo.push(`${setName}: ${n} 个变体（预期 ${expect}）`);
  if (n !== expect) problems.push(`${setName} 变体数 ${n}，预期 ${expect}`);
}

// 原型连线
const protPage = pageByName('04 Prototype');
let linked = 0;
if (protPage) {
  for (const n of collect(protPage, (x, out) => out.push(x))) {
    if (Array.isArray(n.reactions) && n.reactions.length) linked++;
  }
}
if (linked < 3) problems.push(`原型只建立了 ${linked} 条连线，预期 3 条`);

// 颜色校验
for (const p of doc.children) guardColors(p);

/* ── 输出 ──────────────────────────────────────────────────────────────────── */
const line = '─'.repeat(72);
console.log(line);
console.log('Figma 插件本地校验（mock 运行时）');
console.log(line);
console.log(`执行结果       : ${thrown ? '抛出异常' : closed ? '正常跑完并 closePlugin' : '未结束（超时）'}`);
if (thrown) console.log('异常           : ' + (thrown.stack || thrown.message));
console.log(`新建节点数     : ${counters.nodes}`);
console.log(`Page           : ${doc.children.map((p) => p.name).join(' / ')}`);
console.log(`Figma 变量     : ${counters.variables} 个`);
console.log(`组件 / 变体集  : ${counters.components} / ${counters.sets}`);
console.log(`实例           : ${counters.instances}`);
console.log(`已加载字体     : ${[...LOADED_FONTS].join(', ') || '（无）'}`);
console.log(`原型连线       : ${linked} 条`);
console.log('');
console.log('变体数量');
for (const s of setInfo) console.log('  · ' + s);
console.log('');

if (notes.length) {
  console.log('插件通知');
  for (const n of notes) console.log('  · ' + n);
  console.log('');
}
if (warnings.length) {
  console.log(`⚠ 警告 ${warnings.length} 条`);
  for (const w of warnings.slice(0, 12)) console.log('  · ' + w);
  if (warnings.length > 12) console.log(`  … 另有 ${warnings.length - 12} 条`);
  console.log('');
}

if (problems.length) {
  console.log(`✗ 发现 ${problems.length} 个问题`);
  for (const p of problems.slice(0, 30)) console.log('  · ' + p);
  process.exit(1);
}

console.log('✓ 未发现运行时问题（API 用法、颜色范围、结构断言均通过）');
console.log('  注意：mock 只近似布局几何，视觉仍需在 Figma 里目视确认。');
console.log(line);
