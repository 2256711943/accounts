#!/usr/bin/env node
/**
 * scripts/gen-scss.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * 一拍记（SnapLedger）Design Token → SCSS 生成器。
 *
 *    design/tokens/tokens.json   （唯一来源，由 Figma Variables 导出）
 *         │  npm run gen:scss
 *         ▼
 *    src/styles/tokens.scss      （产物，禁止手改！）
 *
 * 产物同时提供「两份形态」（UI_SPEC §2 单一来源原则）：
 *   1. SCSS 变量       $color-accent: #6C4BFF;   ← 供计算 / 组件库主题映射使用
 *   2. CSS 自定义属性   --color-accent: #6C4BFF;  ← 供组件样式引用
 *
 * 为什么 CSS 自定义属性放在 `@mixin sg-css-vars` 里而不是顶层直出？
 *   tokens.scss 会被多个 .vue 文件 import（为了拿 SCSS 变量）。若把 `:root,page{…}`
 *   写在顶层，每 import 一次就重复输出一份 CSS —— 典型「样式重复」，lint 抓不到。
 *   所以本文件顶层**零 CSS 输出**，CSS 变量块由 mixin 控制，在全局入口
 *   （App.vue 的全局 style）`@include` 恰好一次。
 *
 * 命名规则见 scripts/lib/token-naming.mjs（与 Figma 生成器共用同一份实现）。
 *
 * 用法：
 *   node scripts/gen-scss.mjs           生成 / 覆盖 src/styles/tokens.scss
 *   node scripts/gen-scss.mjs --check   只校验产物是否与 tokens.json 同步（CI 用），
 *                                       不同步则 exit 1，不写文件
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';

import { ROOT, TOKENS_JSON, loadTokens } from './lib/token-naming.mjs';

const OUT_FILE = resolve(ROOT, 'src/styles/tokens.scss');

/** 值 → SCSS 字面量（字符串/数字原样输出，SCSS 都能吃） */
const scssValue = (v) => (typeof v === 'number' ? String(v) : String(v));

/** 是否含「顶层」逗号（括号内的逗号如 rgba(0,0,0,.08) 不算） */
const hasTopLevelComma = (s) => {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) return true;
  }
  return false;
};

/**
 * 值 → SCSS 映射表里的字面量。
 * 裸逗号列表（如 font-family 的 fallback 列表）直接放进 map 会被 Sass 当成多个
 * map entry，报 `expected ":"`；必须用括号收成单个 list 值。
 */
const scssMapValue = (v) => {
  const s = scssValue(v);
  return hasTopLevelComma(s) ? `(${s})` : s;
};

function build() {
  const { meta, leaves } = loadTokens();

  // 按顶层分组归类，产物里加分组注释，便于人肉 diff
  const groups = new Map();
  for (const leaf of leaves) {
    const g = leaf.path[0];
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(leaf);
  }

  const L = [];
  L.push('// ═══════════════════════════════════════════════════════════════════════════');
  L.push('// src/styles/tokens.scss —— 【自动生成，禁止手改】');
  L.push('//');
  L.push('// 单一来源：design/tokens/tokens.json');
  L.push('// 重新生成：npm run gen:scss　（校验是否同步：npm run gen:tokens:check）');
  L.push('//');
  L.push(`// 源版本：${meta.version ?? '未知'}　导出日期：${meta.updatedAt ?? '未知'}`);
  L.push(`// 来源说明：${meta.source ?? '—'}`);
  L.push('//');
  L.push('// 本文件顶层零 CSS 输出，import 任意次都不会产生重复样式。');
  L.push('// CSS 自定义属性形态由文件末尾的 `sg-css-vars` mixin 提供，');
  L.push('// 需在全局入口（App.vue 的 style）@include 恰好一次。');
  L.push('// ═══════════════════════════════════════════════════════════════════════════');
  L.push('');
  L.push(`// 共 ${leaves.length} 个 token，命名规则见 docs/UI_SPEC.md §2.7`);
  L.push('');

  // ── 形态 1：SCSS 变量 ─────────────────────────────────────────────────────
  L.push('// ─────────────────────────────────────────────────────────────────────────────');
  L.push('// 形态 1／2：SCSS 变量　（计算 + wot-theme.scss 主题映射消费这一份）');
  L.push('// ─────────────────────────────────────────────────────────────────────────────');
  for (const [group, list] of groups) {
    L.push('');
    L.push(`/* ${group} */`);
    for (const leaf of list) {
      if (leaf.description) L.push(`// ${leaf.description}`);
      L.push(`$${leaf.name}: ${scssValue(leaf.value)};`);
    }
  }
  L.push('');

  // ── 扁平查询表：按名字取 token ─────────────────────────────────────────────
  L.push('// ─────────────────────────────────────────────────────────────────────────────');
  L.push('// 扁平查询表 + 取用函数（sg-token("color-accent")）');
  L.push('// ─────────────────────────────────────────────────────────────────────────────');
  L.push('$sg-tokens: (');
  for (const leaf of leaves) {
    L.push(`  "${leaf.name}": ${scssMapValue(leaf.value)},`);
  }
  L.push(') !default;');
  L.push('');
  L.push('@function sg-token($name) {');
  L.push('  @if not map-has-key($sg-tokens, $name) {');
  L.push('    @error "未知 design token: #{$name}（检查 design/tokens/tokens.json 或 docs/UI_SPEC.md §2.7）";');
  L.push('  }');
  L.push('  @return map-get($sg-tokens, $name);');
  L.push('}');
  L.push('');

  // ── 形态 2：CSS 自定义属性（mixin，只 include 一次） ───────────────────────
  L.push('// ─────────────────────────────────────────────────────────────────────────────');
  L.push('// 形态 2／2：CSS 自定义属性');
  L.push('//');
  L.push('// 选择器必须写 `:root, page` —— H5 的默认值挂在 :root，');
  L.push('// 小程序挂在 page，只写一个会单端失效（ARCHITECTURE.md §3.5 硬约束 2）。');
  L.push('//');
  L.push('// ⚠️ 只允许在全局入口 include 一次，否则 CSS 重复输出。');
  L.push('// ─────────────────────────────────────────────────────────────────────────────');
  L.push('@mixin sg-css-vars {');
  L.push('  :root,');
  L.push('  page {');
  for (const leaf of leaves) {
    L.push(`    --${leaf.name}: ${scssValue(leaf.value)};`);
  }
  L.push('  }');
  L.push('}');
  L.push('');

  return L.join('\n');
}

/* ── 主流程 ─────────────────────────────────────────────────────────────────── */
const isCheck = process.argv.includes('--check');
const next = build();

if (isCheck) {
  if (!existsSync(OUT_FILE)) {
    console.error(`✗ ${relative(ROOT, OUT_FILE)} 不存在，请先跑 npm run gen:scss`);
    process.exit(1);
  }
  // 比对时忽略生成时间戳（否则每次都比较不等）
  const strip = (s) => s.replace(/^\/\/ 生成时间：.*$/m, '');
  if (strip(readFileSync(OUT_FILE, 'utf8')) !== strip(next)) {
    console.error(`✗ ${relative(ROOT, OUT_FILE)} 与 tokens.json 不同步，请跑 npm run gen:scss`);
    process.exit(1);
  }
  console.log(`✓ ${relative(ROOT, OUT_FILE)} 与 tokens.json 同步`);
  process.exit(0);
}

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, next, 'utf8');
const count = (next.match(/^\$\w/gm) || []).length - 1; // 减去 $sg-tokens 自身
console.log(`✓ 已生成 ${relative(ROOT, OUT_FILE)}　（${count} 个 token）`);
console.log(`  来源：${relative(ROOT, TOKENS_JSON)}`);
console.log('  形态：SCSS 变量 + CSS 自定义属性（mixin 控制，须在全局入口 include 一次）');
