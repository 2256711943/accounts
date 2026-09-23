/**
 * scripts/lib/token-naming.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Design Token 的**三层命名**唯一实现（UI_SPEC.md §2.7）。
 *
 *   Figma 变量名        tokens.json 路径         代码名
 *   color/accent   ←→   color.accent.default  →  --color-accent / $color-accent
 *
 * 三个生成器（gen-scss / gen-figma-tokens）都从这里取名字，规则只存在一份，
 * 改规则只改这个文件 —— 否则「单一来源」在命名这一层就破了。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TOKENS_JSON = resolve(ROOT, 'design/tokens/tokens.json');

/* ── §2.7 规则 3：分组前缀缩写 ─────────────────────────────────────────────── */
const GROUP_ABBR = [
  ['font.size', 'fs'],
  ['motion.duration', 'dur'],
  ['motion.easing', 'ease'],
  ['space', 'sp'],
  ['radius', 'r'],
  ['shadow', 'sh'],
];

/* ── §2.7 规则 3 补充：§2.7 表里出现的词级缩写（easing standard → std） ─────── */
const SEGMENT_ABBR = { standard: 'std' };

/* ── §2.7 规则 1 / 2：直接丢弃的路径段 ────────────────────────────────────── */
const DROPPED_SEGMENTS = new Set(['default', 'semantic']);

/** camelCase → kebab-case */
export const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * tokens.json 路径 → 代码名（不含 $ / -- 前缀）
 * §2.7 生成规则 1–3
 */
export function nameOf(pathSegments) {
  const segs = [...pathSegments];
  if (segs[segs.length - 1] === 'default') segs.pop(); // 规则 1
  const kept = segs.filter((s) => !DROPPED_SEGMENTS.has(s)); // 规则 2

  const dotted = kept.join('.');
  for (const [prefix, abbr] of GROUP_ABBR) {
    const re = new RegExp(`^${prefix.replace(/\./g, '\\.')}($|\\.)`);
    if (!re.test(dotted)) continue;
    const tail = dotted.replace(re, '');
    const parts = tail ? tail.split('.').filter(Boolean) : [];
    return [abbr, ...parts.map(kebab).map((s) => SEGMENT_ABBR[s] ?? s)].join('-');
  }

  return kept.map(kebab).map((s) => SEGMENT_ABBR[s] ?? s).join('-');
}

/**
 * tokens.json 路径 → Figma 变量名（§7.2 规范：`分组/名称`）
 * 与 nameOf 相反方向：default 段仍然省略、semantic 段仍然省略。
 *   color.accent.default  → color/accent
 *   color.semantic.success → color/success
 *   space.4               → space/4
 */
export function figmaNameOf(pathSegments) {
  const segs = [...pathSegments];
  if (segs[segs.length - 1] === 'default') segs.pop();
  return segs.filter((s) => !DROPPED_SEGMENTS.has(s)).join('/');
}

/** 递归收集带 $value 的叶子节点（跳过 $schema / $meta 等元信息） */
export function collectLeaves(node, path = [], out = []) {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object' && '$value' in value) {
      out.push({
        path: [...path, key],
        pathStr: [...path, key].join('.'),
        value: value.$value,
        type: value.$type,
        description: value.$description,
      });
    } else if (value && typeof value === 'object') {
      collectLeaves(value, [...path, key], out);
    }
  }
  return out;
}

/**
 * 读取并规范化 tokens.json。
 * 命名碰撞是**静默事故**（两个 token 生成同一个 CSS 变量，后者覆盖前者），
 * 所以这里直接抛错，不给出「容忍」的余地。
 */
export function loadTokens() {
  const tokens = JSON.parse(readFileSync(TOKENS_JSON, 'utf8'));
  const meta = tokens.$meta ?? {};
  const leaves = collectLeaves(tokens);
  if (leaves.length === 0) {
    throw new Error(`${TOKENS_JSON} 里没有解析到任何 $value 叶子节点，格式可能不对`);
  }
  const seen = new Map();
  for (const leaf of leaves) {
    leaf.name = nameOf(leaf.path);
    leaf.figmaName = figmaNameOf(leaf.path);
    if (seen.has(leaf.name)) {
      throw new Error(
        `token 命名碰撞：「${seen.get(leaf.name)}」与「${leaf.pathStr}」都生成 --${leaf.name}，请调整 tokens.json 的路径`
      );
    }
    seen.set(leaf.name, leaf.pathStr);
  }
  return { tokens, meta, leaves };
}
