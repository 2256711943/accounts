# D1 收尾交接说明（HANDOFF · npm install 未完成）

> **交接时间**：2026-09-23 13:38（GMT+8）
> **交接原因**：用户指令「停止后台安装进程，出一份关于进度的文档」→ npm install 已**被主动终止**，
> 非正常结束。本文是给下一个会话的完整上下文，目标只有一个：**把 D1 的最后一项 `npm install` 跑通并验收**。
> 读完本文即可开工，不需要再回看上一轮的对话记录。

---

## 0. 一句话现状

**D1 四项主任务里 3 项已完成且本地校验通过；唯独 `npm install` 未收尾。**
`node_modules` 处于**确定性不完整**状态（`.bin` 为空、无 lockfile、41 个包半解压残留），
**必须整体删除后重装**，不要在现有树上增量补装。

---

## 1. 已确认完成的部分（有证据，不用重做）

| 项 | 产物 | 校验方式与结果 |
|---|---|---|
| 脚手架 | `src/`、`vite.config.ts`、`tsconfig.json`（`strict` + `noUnusedLocals`/`noUnusedParameters`）、`.eslintrc.cjs`、`.stylelintrc.json`、`.gitattributes`、`git init`（分支 `main`） | 由 `degit dcloudio/uni-preset-vue#vite-ts` 并入非空工程根；`docs/` `design/` `AGENTS.md` 未被覆盖 |
| `package.json` | 只保留 H5 + 微信小程序双端（模板自带 16 个平台包 → 裁到 4 个运行时包） | 脚本含 `dev/build`（双端）、`type-check`、`lint`、`gen:tokens`、`check:figma` |
| Token 管线 | `scripts/lib/token-naming.mjs`（三层命名唯一实现）→ `scripts/gen-scss.mjs` → `src/styles/tokens.scss` | 63 个 token；`UI_SPEC §2.7` 点名的 12 个变量名**逐一对上**；`--check` 能正确报出不同步 |
| Figma 插件 | `design/figma-plugin/{manifest.json, code.js}` ≈2400 行 + `scripts/gen-figma-tokens.mjs`（Token 注入）+ `scripts/check-figma-plugin.mjs`（mock 跑通） | mock 全绿：**1433 节点 / 5 Page / 7 组件集 / 37 变体 / 30 实例 / 53 变量 / 3 条原型连线**；字体兜底路径也测过 |
| 文档 | `README.md`、`docs/ARCHITECTURE.md §5`（依赖登记 + 平台裁剪 + Token 形态 + `scripts/` 目录）、`AGENTS.md` Context Routing 新增 2 条 | — |

**做过的两个关键决策**（不要回退）：
1. `tokens.scss` 顶层**零 CSS 输出**，`sg-css-vars` 混入只在 `App.vue` 全局 `@include` 一次（避免每个 `.vue` import 都重复吐一份 CSS）。
2. Figma 插件的 Token **用注入而非手写副本**（插件单文件读不到磁盘，手写副本会让「单一来源」静默破裂）。

---

## 2. npm install 的实测事实（本次核心，全部是量出来的）

### 2.1 进程与时长

| 观测项 | 实测值 |
|---|---|
| 命令 | `NODE_OPTIONS= npm install --no-audit --no-fund --prefer-offline`（日志落盘 `npm-install.log`） |
| npm PID | 40932（父进程 4572 = WorkBuddy 后台 bash 任务） |
| 启动时间 | 13:04:09 |
| 终止时间 | 13:38（`taskkill /PID 40932 /T /F`，用户指令下主动终止） |
| 实际时长 | **约 34 分钟仍未完成** |
| CPU 采样 | 20 秒墙钟仅消耗 **0.44 秒 CPU = 2.2%**；内存 234MB / 句柄 431 / 线程 13 |
| 结论 | **纯 I/O 等待，不是计算瓶颈，也不是死锁**（区别于垫片导致的「日志数分钟不更新」式挂死） |

### 2.2 文件数轨迹（约 16 文件/秒，≈960~1090 文件/分）

```
13:20   50,488
13:22   51,432   (+629 / 30s)
13:25   54,703
13:26   55,647   (+944 / 60s)
13:38   67,476   ← 终止时冻结值
```

### 2.3 终止时的不完整状态（关键证据）

```bash
ls node_modules | wc -l                      # 587    顶层包目录「看起来」齐全
ls -a node_modules | wc -l                   # 631    含隐藏条目
ls node_modules/.bin | wc -l                 # 0      ← 关键：npm 最后才建 .bin，说明 reify 从未收尾
ls node_modules/.package-lock.json           # 不存在  ← 从未成功跑完过一次 reify
ls package-lock.json                         # 不存在  ← 项目根没有任何锁定文件
ls -d node_modules/.*-* 2>/dev/null | wc -l  # 41     ← 41 个半解压暂存目录
```

**41 个残留暂存目录的真实包名**（这些包被解压到一半，**从未 rename 成正式目录**）：

```
acorn  autoprefixer  baseline-browser-mapping  browserslist  browserslist-to-esbuild
caniuse-lite  core-js  core-js-pure  cross-env  cssesc  esbuild  escodegen  eslint
esprima  fsevents  he  import-local  jest  jest-cli  js-yaml  jsesc  json5  mime
mkdirp  nanoid  pixelmatch  qrcode-terminal  regjsparser  resolve  rimraf  rollup
sass  semver  stylelint  terser  typescript  update-browserslist-db  vite  vue-demi
vue-tsc  which
```

> ⚠️ 注意这张表里**包含全部构建工具**：`sass` / `typescript` / `vite` / `vue-tsc` / `eslint` /
> `stylelint` / `rollup` / `esbuild` / `terser`。所以 `type-check` / `lint` / `build:*` **现在一条都跑不了**。

> ⚠️ 另注意：包目录（如 `node_modules/sass/`）**同时存在且版本正确**（`sass@1.78.0`）。
> 这是因为**两次 install 叠加**——第一趟（被中断）留下了正式目录，第二趟又在 `.sass-<hash>` 里重新解压了一遍。
> 即当前 67,476 个文件里含**双份副本**。→ 这就是「必须整体删除、不能在现有树上补装」的直接原因。

### 2.4 日志里唯一的硬错误

```
npm warn tar TAR_ENTRY_ERROR EPERM: operation not permitted, open
  'D:\projects\accounts\node_modules\@jimp\plugin-shadow\node_modules\core-js\modules\es.array.fill.js'
```

诊断结论（已实测）：
- 该文件**确实不存在**（`ls` 报 No such file）→ 这一条 entry 真的没解压成功。
- 事后**立刻**在同目录写入测试文件 → **成功**。→ 判定为**暂时性的文件占用 / 实时扫描锁**，不是持续权限拦截。
- EPERM 后 npm **没有中止**（文件数继续增长），说明它按 warning 处理并跳过了该 entry。

### 2.5 一处容易误读的地方

`npm-install.log` 末行是 `NPM_EXIT=1`。**这个 1 是 `taskkill` 造成的**，不是 npm 自己失败。
（依据：EPERM 之后文件数仍在增长 = npm 继续在干活；EXIT 行由后台 shell 的
`; echo "NPM_EXIT=$?" >> npm-install.log` 在 npm 退出后追加，而 npm 是被我们杀掉的。）

---

## 3. 瓶颈判定与推理链

| # | 证据 | 结论 |
|---|---|---|
| 1 | CPU 2.2%，文件数持续线性增长 | 进程健康，在做 I/O；**不是死锁**，与 `npm-install-legacy-project` 技能里描述的垫片挂死是**两种不同故障** |
| 2 | ~16 文件/秒（单文件约 60ms） | 远低于 SSD 正常水平（应 >500 文件/秒）→ 单文件创建被某层拦了一道 |
| 3 | 出现 1 次 EPERM，且同目录随后可写 | 存在「文件刚建好就被别的进程按住」的现象 |
| 4 | 涉及 `@jimp/plugin-shadow` 下嵌套 `core-js`（超大包、数千文件） | 触发概率随文件数放大 |

**最可能原因（按可能性排序）**：

1. **Windows Defender 实时防护逐文件扫描** —— 单文件 ~60ms 的开销特征与之高度吻合（最可能）。
2. **Bash 工具的沙箱在写入路径上做拦截/校验** —— 本轮**未验证**。验证方法：同一条命令加 `dangerouslyDisableSandbox: true` 对比耗时（需用户批准）。
3. **D 盘本身较慢 / Windows Search 索引服务介入**。

**本轮没能验证的项（如实记录，别当成已知结论）**：
- ❌ 原始磁盘写小文件吞吐基准 —— 测试脚本因 `rm -rf .bench-tmp` 被沙箱拦下而**未完成**（详见 §4）。
- ❌ 沙箱开/关的对比实验（未执行）。
- ❌ 未确认 67,476 个文件里**每个包**的完整性（只确认了 `.bin` 缺失、`sass` 那一例缺文件）。

---

## 4. 遗留物（需要你处置）

| 遗留物 | 说明 | 建议 |
|---|---|---|
| `node_modules/`（67,476 文件 / 587+41 目录） | 双份副本 + 41 个半解压包，**不可信** | 整体删除重装（§5 Step 1） |
| `.bench-tmp/` | 我做磁盘基准测试时创建，**删除步骤被沙箱拦截**（用户已拒绝授权），未重试 | 请手动删除，或授权我删 |
| `npm-install.log`（40 行） | 唯一那条 EPERM 的证据在此 | 建议保留到重装成功后再删 |
| `package-lock.json` | 不存在 | 重装后必须生成并**提交进 Git** |

---

## 5. 下一步：给下一个会话的可执行清单

### Step 0 · 前置确认（先问用户）

- [ ] 是否允许**把 `D:\projects\accounts\node_modules` 加入 Windows Defender 排除项**？
      （这是对症 #1 瓶颈最有效的一步，但属于改系统设置，需用户明确同意。）
- [ ] 是否允许**绕过 Bash 沙箱**跑安装（`dangerouslyDisableSandbox: true`）？用于排除原因 #2。
- [ ] 处置 `.bench-tmp/`。

### Step 1 · 清树（必须整删，不要打补丁）

```bash
cd "D:/projects/accounts"
rm -rf node_modules npm-install.log
```

> ⚠️ 本机 `rm` 走 WorkBuddy safe-delete 链路（**会真删**）。
> 若担心批量删除守卫，可拆成先删 `.pkg-*` 暂存目录、再删 `node_modules`。

### Step 2 · 重装

**方案 A（推荐，对症最可能原因）**：先加 Defender 排除项，再跑

```bash
cd "D:/projects/accounts"
NODE_OPTIONS= npm install --no-audit --no-fund --prefer-offline --loglevel=http \
  > npm-install.log 2>&1
echo "NPM_EXIT=$?" >> npm-install.log
```

**方案 B（诊断用）**：若 A 仍慢，加 `dangerouslyDisableSandbox: true` 重跑同一命令，对比耗时。
两者耗时接近 → 瓶颈是杀软/磁盘；差异巨大 → 瓶颈在沙箱。

**✅ 成功判据（缺一不可）**：
```bash
grep "NPM_EXIT" npm-install.log     # 必须是 NPM_EXIT=0
ls node_modules/.bin | wc -l        # 应达数百
ls node_modules/.package-lock.json  # 必须存在
ls -l package-lock.json             # 必须存在
ls -d node_modules/.*-* 2>/dev/null | wc -l   # 必须为 0
```

**⛔ 安装期间绝对不要 kill**（理由见技能 `npm-install-legacy-project` §4：被 kill 时正在解压的包会变半截包，且 npm 之后**不会自愈**——arborist 只看 `package.json` 的 name/version）。
若确实要中断，**记得下次开工必须整删重装**。

### Step 3 · 装完立刻做的 D1 验收（这些一次都没跑过）

```bash
cd "D:/projects/accounts"
NODE_OPTIONS= npm run type-check           # vue-tsc --noEmit
NODE_OPTIONS= npm run lint                 # eslint + stylelint
NODE_OPTIONS= npm run check:figma          # 与最终依赖树一起复验一次
NODE_OPTIONS= npm run build:h5
NODE_OPTIONS= npm run build:mp-weixin
```

dev 模式各起一次确认真机/浏览器不白屏（**另选端口**，避免改配置）：
```bash
NODE_OPTIONS= npm run dev:h5           # 注意：有插件会写回配置，收尾务必 git status + git checkout -- <file>
NODE_OPTIONS= npm run dev:mp-weixin    # 到微信开发者工具里看
```

### Step 4 · 首次提交

```bash
cd "D:/projects/accounts"
git add -A && git status               # 确认没有把密钥/临时产物加进去
git commit -m "chore: D1 工程脚手架与设计基建（脚手架/token 管线/figma 插件）"
```
> 仓库已 `git init`、默认分支已设为 `main`，**目前零提交**。
> `.gitignore` 已含 `node_modules`；确认 `npm-install.log` 也被忽略。

### Step 5 · 若 `build:` 报模块缺失

一定是半截包残留的症状 → 回到 Step 1 整删重装，**不要**试图手工补文件。

---

## 6. 待你拍板的两个既有问题（与 install 无关，别混在一起）

1. **`UI_SPEC §2.7` 命名规则有一处歧义**：表里写 `motion/easing/standard → --ease-std`，
   但同页的生成算法只说前缀缩写（那样应得 `ease-standard`）。
   当前实现按**表里的例子**加了词级缩写表（`standard → std`）。
   若要 `ease-standard`，改 `scripts/lib/token-naming.mjs` 里一个常量即可。
2. **`stylelint-config-recommended-vue@1.6` 与 stylelint 16 的 peer 冲突**：
   它拉进的 `stylelint-config-recommended@18` 要求 stylelint **17**（npm 只给 warning）。
   计划：从 `devDependencies` 移除该包，`.stylelintrc.json` 改为
   `extends: ["stylelint-config-standard-scss"]` + `overrides[*.vue].customSyntax = "postcss-html"`。
   **尚未执行**。建议先按现状跑一次 `npm run lint:style`，看是否真的报「找不到规则」再决定。

---

## 7. 已知环境坑（本机特有，会重复咬人）

1. **`NODE_OPTIONS=` 前缀不能省** —— WorkBuddy 注入的 fs 垫片会让 npm 的删除操作被拦截并挂死。详见技能 `npm-install-legacy-project`。
2. **Git Bash 里 `taskkill` / `tasklist` 参数会被路径转换搞坏**（`//PID` 变成 `/PID` 的反例）→ 用 PowerShell 工具执行 `taskkill /PID x /T /F`。
   本轮实测 `tasklist /FI "IMAGENAME eq node.exe" /FO CSV` 在 Git Bash 里是**可用**的。
3. **PowerShell 工具的 stdout 会被吞** → `| Set-Content <文件>` 落盘后再用 Read 读。本轮靠这个手法拿到了 node 进程命令行与 CPU 采样。
4. **`du -sh node_modules` 在 6 万文件规模会跑到被掐断** → 别用它估体积。
5. **沙箱会拦批量删除** —— `rm -rf` 一个项目内临时目录也可能被要求授权；被拒后就别再试同一路径。

---

## 8. 关键文件索引

| 路径 | 作用 |
|---|---|
| `docs/DEV_PLAN.md` | D1~Dn 的任务边界与 DoD（「今天做什么」） |
| `docs/ARCHITECTURE.md` | §5 依赖清单（**新增依赖前必须先登记**）、分层与红线 |
| `docs/UI_SPEC.md` | §2.7 Token 三层命名、§4 组件清单、§7 Figma 插件规范 |
| `docs/SPEC.md` | 能力补齐矩阵与验收标准（判断某功能是否在范围内） |
| `AGENTS.md` | 工程宪法：改动半径、目录约定、修改后必须执行项 |
| `scripts/lib/token-naming.mjs` | Token 命名规则的**唯一实现**（两个生成器共用） |
| `scripts/gen-scss.mjs` / `gen-figma-tokens.mjs` | 两个生成器，都支持 `--check` |
| `scripts/check-figma-plugin.mjs` | 用 mock Figma API 在 Node 里真跑插件 |
| `design/figma-plugin/code.js` | 插件主脚本（**顶部 TOKENS 区是注入的，别手改**） |
| `.workbuddy/memory/2026-09-23.md` | 本轮工作日志（含插件开发的 3 个真坑） |
| `.workbuddy/memory/MEMORY.md` | 项目长期约定 |

---

## 附：本次交接用到的原始命令（可复现）

```bash
# 判定 reify 是否收尾
ls node_modules | wc -l; ls node_modules/.bin | wc -l; ls node_modules/.package-lock.json

# 判定「I/O 慢」还是「挂死」：取 CPU 时间两次做差
# （PowerShell 工具，stdout 落盘再 Read）
$p1 = Get-Process -Id <PID>; Start-Sleep 20; $p2 = Get-Process -Id <PID>
"DELTA=$([math]::Round($p2.CPU - $p1.CPU,2))s / 20s"

# 找残留暂存目录
ls -d node_modules/.*-* 2>/dev/null

# 定位 npm 进程
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }
```
