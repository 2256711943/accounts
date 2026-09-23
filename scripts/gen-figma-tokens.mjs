#!/usr/bin/env node
/**
 * scripts/gen-figma-tokens.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * 把 design/tokens/tokens.json 注入 design/figma-plugin/code.js 的
 * 「TOKENS:BEGIN … TOKENS:END」标记区。
 *
 * 为什么需要这一步：
 *   Figma 插件（无打包器）只能加载单个 JS 文件，读不到磁盘上的 tokens.json。
 *   若在 code.js 里手写一份色值副本，"单一来源" 立刻破裂 —— 改设计稿忘了改插件，
 *   生成出来的设计稿就是错的，而且没有任何机制能发现。
 *   所以：code.js 的绘制逻辑手写，token 数据由本脚本生成，二者用标记区隔离。
 *
 * 注入内容 = tokens.json 的**规范化等价物**（每个 token 带 3 个名字）：
 *   path       tokens.json 路径      color.accent.default
 *   figmaName  Figma 变量名（§7.2）   color/accent
 *   name       代码名（§2.7）         color-accent   → --color-accent / $color-accent
 * 这样 code.js 里不需要再实现一遍命名规则。
 *
 * 用法：
 *   node scripts/gen-figma-tokens.mjs           注入
 *   node scripts/gen-figma-tokens.mjs --check   校验是否同步（CI 用）
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

import { ROOT, TOKENS_JSON, loadTokens } from './lib/token-naming.mjs';

const TARGET = resolve(ROOT, 'design/figma-plugin/code.js');
const BEGIN_MARK = '// >>> TOKENS:BEGIN';
const END_MARK = '// <<< TOKENS:END';
const BLOCK_RE = new RegExp(
  `${BEGIN_MARK.replace(/[/]/g, '\\/')}[\\s\\S]*?${END_MARK.replace(/[/]/g, '\\/')}`
);

/** JS 字符串字面量（安全转义） */
const js = (v) => JSON.stringify(v);

function buildBlock() {
  const { meta, leaves } = loadTokens();

  const L = [];
  L.push(BEGIN_MARK);
  L.push('// ⚠️ 本区块由 `npm run gen:figma` 从 design/tokens/tokens.json 自动注入，请勿手改！');
  L.push('//    手改会在下次生成时被覆盖；要改数据请改 tokens.json。');
  L.push(`//    源版本：${meta.version ?? '未知'}　导出日期：${meta.updatedAt ?? '未知'}`);
  L.push('');
  L.push('const TOKENS_META = {');
  L.push(`  name: ${js(meta.name ?? 'Design Tokens')},`);
  L.push(`  version: ${js(meta.version ?? '')},`);
  L.push(`  updatedAt: ${js(meta.updatedAt ?? '')},`);
  L.push(`  source: ${js(meta.source ?? '')},`);
  L.push('};');
  L.push('');
  L.push(`const TOKENS = [`);
  for (const leaf of leaves) {
    L.push(
      `  { path: ${js(leaf.pathStr)}, figmaName: ${js(leaf.figmaName)}, name: ${js(leaf.name)}, ` +
        `value: ${js(leaf.value)}, type: ${js(leaf.type ?? '')}` +
        (leaf.description ? `, description: ${js(leaf.description)}` : '') +
        ' },'
    );
  }
  L.push('];');
  L.push(END_MARK);
  return L.join('\n');
}

const block = buildBlock();

if (!existsSync(TARGET)) {
  console.error(`✗ 找不到 ${relative(ROOT, TARGET)}`);
  process.exit(1);
}

const src = readFileSync(TARGET, 'utf8');
if (!BLOCK_RE.test(src)) {
  console.error(
    `✗ ${relative(ROOT, TARGET)} 里找不到标记区。\n` +
      `  请确认文件里同时存在这两行（必须在行首、无缩进）：\n    ${BEGIN_MARK}\n    ${END_MARK}`
  );
  process.exit(1);
}

const next = src.replace(BLOCK_RE, block);
const isCheck = process.argv.includes('--check');

if (isCheck) {
  if (src !== next) {
    console.error(`✗ ${relative(ROOT, TARGET)} 的 token 区与 tokens.json 不同步，请跑 npm run gen:figma`);
    process.exit(1);
  }
  console.log(`✓ ${relative(ROOT, TARGET)} 的 token 区与 tokens.json 同步`);
  process.exit(0);
}

if (src === next) {
  console.log(`✓ ${relative(ROOT, TARGET)} 的 token 区已是最新，无需改动`);
  process.exit(0);
}

writeFileSync(TARGET, next, 'utf8');
console.log(`✓ 已向 ${relative(ROOT, TARGET)} 注入 ${loadTokens().leaves.length} 个 token`);
console.log(`  来源：${relative(ROOT, TOKENS_JSON)}`);
