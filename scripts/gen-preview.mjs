#!/usr/bin/env node
/**
 * scripts/gen-preview.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * 一拍记（SnapLedger）UI 效果图生成器 —— 开发前的**视觉评审稿**。
 *
 *    design/preview/template.html   （人写模板：含注入点与 {{占位符}}）
 *    design/tokens/tokens.json      （唯一来源）
 *         │  npm run gen:preview
 *         ▼
 *    design/preview/index.html      （产物：自包含，可直接双击打开 / 截图存档）
 *
 * 定位：本产物**不参与**小程序 / H5 构建，也不需要任何依赖，它只回答一个问题 ——
 *      「视觉方向、信息层级、间距节奏是否符合预期？」，在动手写页面前先看一眼。
 *      页面里零字面色值（全部 var(--token)），与 src/ 下的产品代码同源；
 *      改 tokens.json → 重跑本命令 → 效果图同步更新。
 *
 * 用法：
 *   node scripts/gen-preview.mjs           生成 / 覆盖 design/preview/index.html
 *   node scripts/gen-preview.mjs --check   只校验产物是否与模板 + tokens 同步（CI 用），
 *                                          不同步则 exit 1，不写文件
 *   node scripts/gen-preview.mjs --variants
 *                                          读 design/preview/variants/*.json，把「只改 token」
 *                                          的几套配色并排生成到 design/preview/variants/，
 *                                          用于视觉方向未定时看对比稿（选定后把值折回 tokens.json）
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';

import { ROOT, TOKENS_JSON, loadTokens } from './lib/token-naming.mjs';

const TEMPLATE = resolve(ROOT, 'design/preview/template.html');
const OUT_FILE = resolve(ROOT, 'design/preview/index.html');
const VARIANTS_DIR = resolve(ROOT, 'design/preview/variants');

/** 模板里 CSS 自定义属性的注入点（模板必须保留这一行） */
const INJECT_MARK = '/* @inject:tokens-css */';

/** 去掉 CSS 注释：注释里出现的 var(--xxx) 只是说明文字（如「全部引用 var(--token)」），不该被当引用检查 */
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 找出模板里**没有兜底值**的 var(--token) 引用。
 * 这类引用一旦 token 改名就是静默失效（颜色变透明、间距塌成 0），
 * 所以生成时直接报错，而不是留一个看起来"没坏"的页面。
 */
function requiredTokens(html) {
  const css = stripCssComments(html);
  const names = new Set();
  for (const m of css.matchAll(/var\(--([a-z0-9-]+)\s*(,?)/g)) {
    if (m[2] !== ',') names.add(m[1]); // 没有逗号 = 没有 fallback
  }
  return [...names];
}

function build() {
  const { meta, leaves } = loadTokens();
  const tpl = readFileSync(TEMPLATE, 'utf8');

  if (!tpl.includes(INJECT_MARK)) {
    throw new Error(`模板里找不到注入点 ${INJECT_MARK}：${relative(ROOT, TEMPLATE)}`);
  }

  // ── 1. 注入 CSS 自定义属性（与 gen-scss 的 sg-css-vars 同源同名，只取 :root 一份）──
  const css = [];
  css.push('/* ═══════════════════════════════════════════════════════════════════════');
  css.push(' * 【自动注入，禁止手改】design/tokens/tokens.json → CSS 自定义属性');
  css.push(` * 源版本 ${meta.version ?? '未知'} · 导出日期 ${meta.updatedAt ?? '未知'} · 共 ${leaves.length} 个 token`);
  css.push(' * 效果图不跑在小程序里，所以只需要 :root（产品代码里的 sg-css-vars 是 `:root, page`）');
  css.push(' * ═══════════════════════════════════════════════════════════════════════ */');
  css.push(':root {');
  for (const leaf of leaves) css.push(`  --${leaf.name}: ${leaf.value};`);
  css.push('}');

  const cssBlock = css.join('\n');
  let out = tpl.replace(INJECT_MARK, cssBlock);

  // ── 2. 替换页头元信息占位符 ────────────────────────────────────────────────
  out = out
    .replaceAll('{{TOKEN_VERSION}}', String(meta.version ?? '未知'))
    .replaceAll('{{TOKEN_DATE}}', String(meta.updatedAt ?? '未知'));

  const left = out.match(/\{\{[^}]+\}\}/g);
  if (left) throw new Error(`模板里还有未替换的占位符：${[...new Set(left)].join('、')}`);

  // ── 3. 引用完整性：模板用到的 token 必须真实存在 ───────────────────────────
  const defined = new Set(leaves.map((l) => l.name));
  const missing = requiredTokens(tpl).filter((n) => !defined.has(n));
  if (missing.length > 0) {
    throw new Error(
      `模板引用了不存在的 token（且没有兜底值）：${missing.map((n) => `--${n}`).join('、')}\n` +
        '  要么改模板，要么在 design/tokens/tokens.json 里补上 —— 别让效果图静默失真。'
    );
  }

  return { out, cssBlock, count: leaves.length, defined, leaves };
}

/**
 * 变体对比稿：同一份模板 + 同一份 token，只在 `:root` 后再叠一层「覆盖块」。
 * 差异 100% 来自 token，版式完全不动 —— 这样对比结论才可用（人只会被颜色和层级带跑）。
 * 覆盖项必须是真的 token 名，写错直接报错，避免"改了但没生效"却看不出来。
 */
function buildVariants(base) {
  if (!existsSync(VARIANTS_DIR)) {
    console.error(`✗ 没有 ${relative(ROOT, VARIANTS_DIR)} 目录，变体对比稿的输入在 *.json 里`);
    process.exit(1);
  }
  const files = readdirSync(VARIANTS_DIR).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.error(`✗ ${relative(ROOT, VARIANTS_DIR)} 下没有 *.json 变体定义`);
    process.exit(1);
  }

  const made = [];
  for (const file of files) {
    const v = JSON.parse(readFileSync(join(VARIANTS_DIR, file), 'utf8'));
    const unknown = Object.keys(v.tokens).filter((k) => !base.defined.has(k));
    if (unknown.length > 0) {
      throw new Error(`${file} 里的覆盖项不是已定义的 token：${unknown.join('、')}`);
    }

    let html = base.out.replace(
      base.cssBlock,
      [
        base.cssBlock,
        '',
        `/* ── 变体覆盖（${v.name}）：只改 token，版式与模板完全一致 ── */`,
        ':root {',
        ...Object.entries(v.tokens).map(([k, val]) => `  --${k}: ${val};`),
        '}',
      ].join('\n')
    );

    // 模板里把几个关键色值写进了说明文案与色板卡，覆盖后要一起换掉，否则自相矛盾
    for (const [k, val] of Object.entries(v.tokens)) {
      const orig = base.leaves.find((l) => l.name === k)?.value;
      if (typeof orig === 'string' && orig.startsWith('#')) html = html.split(orig).join(String(val));
    }

    const outFile = file.replace(/\.json$/, '.html');
    writeFileSync(join(VARIANTS_DIR, outFile), html, 'utf8');
    made.push({ ...v, outFile });
  }

  // 并排对比页（三个 375 宽的 iframe 横排，一眼看完差异）
  const page = [];
  page.push('<!doctype html>');
  page.push('<html lang="zh-CN"><head><meta charset="utf-8" />');
  page.push('<title>一拍记 · 视觉方向对比稿</title>');
  page.push('<style>');
  page.push('body { margin:0; padding:24px; background:#EDEDEF; color:#1A1A1C;');
  page.push('  font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; font-size:14px; }');
  page.push('h1 { font-size:18px; margin:0 0 6px; }');
  page.push('.lead { margin:0 0 20px; color:#5C5C66; font-size:13px; line-height:1.6; }');
  page.push('.cols { display:flex; gap:20px; align-items:flex-start; }');
  page.push('.col { width:375px; flex:none; }');
  page.push('.cap { margin-bottom:8px; font-weight:600; }');
  page.push('.note { min-height:56px; margin-bottom:8px; color:#5C5C66; font-size:12px; line-height:1.6; }');
  page.push('.chips { display:flex; gap:6px; margin-bottom:8px; }');
  page.push('.chip { width:22px; height:22px; border-radius:6px; box-shadow:0 0 0 1px rgba(0,0,0,.08) inset; }');
  page.push('iframe { width:375px; height:860px; border:0; border-radius:14px; background:#fff;');
  page.push('  box-shadow:0 6px 24px rgba(0,0,0,.12); }');
  page.push('</style></head><body>');
  page.push('<h1>一拍记 · 视觉方向对比稿（A / B / C）</h1>');
  page.push(
    '<p class="lead">三套稿子的<b>版式、间距、信息结构完全一样</b>，差异只在 token（颜色 / 圆角 / 阴影 / 字阶）——' +
      '所以哪套好看是纯粹的视觉偏好判断。<br>挑一套，或者说「要 A 的底色 + C 的圆角」，我再收敛成最终版并写回 tokens.json。' +
      '此外这三套都是「配色方向」层面的对比，页面结构若也要改，是下一步的事。</p>'
  );
  page.push('<div class="cols">');
  for (const v of made) {
    const c = v.tokens;
    page.push('<div class="col">');
    page.push(`  <div class="cap">${v.name}</div>`);
    page.push(`  <div class="note">${v.note ?? ''}</div>`);
    page.push('  <div class="chips">');
    for (const key of ['color-bg-base', 'color-bg-surface', 'color-text-primary', 'color-accent', 'color-accent-soft']) {
      if (c[key]) page.push(`    <div class="chip" style="background:${c[key]};"></div>`);
    }
    page.push('  </div>');
    page.push(`  <iframe src="${v.outFile}" loading="lazy"></iframe>`);
    page.push('</div>');
  }
  page.push('</div>');
  page.push('</body></html>');

  mkdirSync(VARIANTS_DIR, { recursive: true });
  writeFileSync(join(VARIANTS_DIR, 'index.html'), page.join('\n'), 'utf8');
  console.log(`✓ 已生成 ${made.length} 套变体 → ${relative(ROOT, join(VARIANTS_DIR, 'index.html'))}`);
  for (const v of made) console.log(`   · ${v.outFile}　${v.name}`);
}

/* ── 主流程 ─────────────────────────────────────────────────────────────────── */
const isCheck = process.argv.includes('--check');
const isVariants = process.argv.includes('--variants');
const base = build();
const { out, count } = base;

if (isVariants) {
  buildVariants(base);
  process.exit(0);
}

if (isCheck) {
  if (!existsSync(OUT_FILE)) {
    console.error(`✗ ${relative(ROOT, OUT_FILE)} 不存在，请先跑 npm run gen:preview`);
    process.exit(1);
  }
  if (readFileSync(OUT_FILE, 'utf8') !== out) {
    console.error(`✗ ${relative(ROOT, OUT_FILE)} 与模板 + tokens.json 不同步，请跑 npm run gen:preview`);
    process.exit(1);
  }
  console.log(`✓ ${relative(ROOT, OUT_FILE)} 与模板 + tokens.json 同步`);
  process.exit(0);
}

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, out, 'utf8');
console.log(`✓ 已生成 ${relative(ROOT, OUT_FILE)}　（注入 ${count} 个 token）`);
console.log(`  来源：${relative(ROOT, TEMPLATE)} + ${relative(ROOT, TOKENS_JSON)}`);
console.log('  直接双击打开即可评审；这是开发前视觉效果稿，交互与真机字体渲染不在本页范围内');
