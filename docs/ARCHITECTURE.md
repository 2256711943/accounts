# ARCHITECTURE.md — 一拍记（SnapLedger）技术架构设计

> 版本：v1.1 ｜ 日期：2026-09-22 ｜ 关联：`SPEC.md`、`UI_SPEC.md`、`DEV_PLAN.md`
> **v1.1 修订**：UI 方案由「不引第三方组件库」改为「**分层引入**：视觉型组件自研 / 交互型组件外采 `wot-design-uni` 1.14.0 + Design Token 主题桥接」。
> 涉及章节：§1.1、§1.2（决策 1 重写）、§3.5（新增）、§4.4、§5、§7。

---

## 1. 技术选型

### 1.1 选型结果

| 层 | 选型 | 版本 | 理由 |
|---|---|---|---|
| 跨端框架 | **uni-app（CLI 工程）** | Vue 3 + Vite 5 | 一套代码出小程序 + H5；CLI 工程才能进 Git / 走 CI（HBuilderX 工程不利于版本管理） |
| 语言 | **TypeScript**（`strict: true`） | 5.x | 端到端类型是云函数 + 前端联调的安全网 |
| 状态管理 | **Pinia** | 2.x | uni-app 官方支持，Vue3 生态标准 |
| UI 方案 | **自建设计系统（Design Tokens）+ 分层组件策略** | 自研 7 个视觉型原子组件 | 页面气质自己定，同时保住「自建设计系统」这个简历点。理由见 §1.2 |
| 组件库 | **wot-design-uni**（npm + easycom 按需引入） | 1.14.0 | **只**外采交互密集型组件（浮层 / 手势 / 选择器 / 键盘）。理由见 §1.2，主题机制见 §3.5 |
| 样式 | **SCSS + Design Tokens** | — | token 从 Figma 单一来源生成；组件库主题变量在 `styles/wot-theme.scss` 内由 token 映射 |
| 图表 | **canvas 2d 自绘环形图** | — | 不引 uCharts/ec-canvas，省 ~200KB 主包体积，且是简历亮点 |
| 后端 | **微信云开发**（云函数 + 云数据库 + 云存储） | wx-server-sdk | **零备案、零服务器成本**，15 天周期下最大风险被消除 |
| 识别 | **分级策略**：本地规则 → 云函数多模态 | — | 控制时延与成本，降级路径可讲 |
| H5 部署 | **Vercel 静态托管** | — | 免备案，直接给面试官链接 |
| 提交规范 | Conventional Commits | — | `feat/fix/perf/docs/refactor` |

### 1.2 关键决策与被否方案

**决策 1：分层引入组件库 —— 交互密集型外采，视觉密集型自研，亮点型绝不外采**

| 维度 | 全量引 UI 库 | 全自研 | **分层（采用）** |
|---|---|---|---|
| 工期 | 快 1–2 天 | 慢 1–2 天 | 与全自研接近（省掉浮层/手势调试约 2–3 天） |
| 简历价值 | 低（"用了某某 UI 库"没有信息量） | 高（"自建设计系统"） | **更高**（自建设计系统 **+** 组件库主题工程化，两个点都拿到） |
| UI 可控性 | 低（页面长成库的样子，学不到设计） | 高 | 高（视觉骨架 100% 自控） |
| 主包体积 | 大（uView ≈ 300KB+） | 最小 | 可控（按需引入，增量预算 ≤150KB，见 §4.4） |
| 踩坑风险 | 低 | **高**（Picker / Popup / Toast 的边界处理最易翻车） | 低 |

选型：**`wot-design-uni` 1.14.0**（npm 安装 + easycom 按需引入）。事实依据（均已核实）：0 运行时依赖、peer 仅 `vue>=3.2.47`、原生 Vue3 + TS 编写、共 **99 个 `wd-*` 组件**、2026-01-04 仍在发版。

**判定标准只有一条：这个组件的价值在「交互复杂度」还是在「视觉表达」？**

- 价值在**交互复杂度**（惯性滑动、手势、滚动穿透、跨端一致的浮层与键盘管理）→ **外采**。自研 ROI 极低，且是新手最容易翻车的地方
- 价值在**视觉表达**（颜色 / 圆角 / 字阶 / 留白构成的气质）→ **自研**。否则页面会"精神分裂"

| 处理 | 组件 | 理由 |
|---|---|---|
| **外采（Wot）** | `wd-datetime-picker`（日期时间）、`wd-action-sheet`（分类抽屉）、`wd-popup`（通用浮层，**含滚动穿透治理**）、`wd-message-box`（二次确认）、`wd-toast`（轻提示）、`wd-img`（原图预览 + 手势缩放）、`wd-swipe-action`（列表左滑删除，可选）、`wd-switch`（设置开关）、`wd-loadmore`（上拉三态）、`wd-number-keyboard`（金额数字键盘） | 全是"标准件"，视觉上无需个性；交互边界（惯性、手势、穿透、键盘避让）靠自研容易踩坑 |
| **自研（保留）** | `Button` / `Cell` / `Card` / `Tag` / `Avatar` / `Skeleton` / `Empty` | 合计约 1 天工作量，且这是**学设计的主战场**，同时保住 "自建设计系统" 这个简历点 |
| **绝不外采** | `DonutChart`（canvas 2d 自绘环形图）、自研虚拟列表 | 简历亮点本体，外采等于把亮点删掉 |

> 原自研清单里的 `Popup` 已移出：浮层涉及遮罩、进出动画、滚动穿透、层级管理，是典型的"交互复杂度"组件，自研不划算。

**代价与必须监控的三件事**：

1. 主包预算被压缩 → §4.4 给出增量预算（≤150KB）与 D3 实测任务；**超预算时按上表「外采」清单从后往前砍**（先 `wd-swipe-action` / `wd-number-keyboard`）。
2. 组件库默认是 Vant 风（主色 `#4D80F0` 蓝紫），与本项目「暖白 + 赤陶橙」不是一个气质 → **必须做主题桥接**（机制见 §3.5）。这是一次性成本，不做就会出现两套视觉并存。
3. Wot 社区规模小于 uView 系（市场占比约 6–8% vs 15–20%），冷门问题难搜到答案 → **单个问题卡住超过 1 小时就换自研或求助，不硬耗**。

> 顺带一个可写进简历的收益：D3 会实测「引入组件库前 / 后的主包体积与 T1」，这组数据体现的是**工程取舍能力**，而不是"我会用组件库"。

**决策 2：后端整体走微信云开发，而不是自建 NestJS**

核心理由是**备案**。小程序 `request` 只能请求已完成 ICP 备案的 https 域名，备案周期 7–20 天，会吃掉一半工期。走云开发：

- 小程序端 `wx.cloud.callFunction` **完全不需要配置合法域名**
- 云函数内部可访问任意外部 API，无域名限制
- `openid` 由云开发自动注入，免写 `code2session` 换 login 态
- 云存储直传图片，免自建 OSS + CDN

代价：不能复用已有 NestJS 工程。但**本次目标是补移动端空缺，不是补后端空缺**，这个代价是划算的。若用户后续想复用 NestJS，架构已预留切换点（见 §3.4 数据通道抽象）。

**决策 3：客户端不直连数据库，全部经云函数**

云开发允许客户端 SDK 直连数据库（靠集合权限控制），但我们**统一走云函数**：

- 权限逻辑集中一处，云函数内强制以 `OPENID` 注入查询条件，客户端无法越权
- 计算逻辑（金额聚合、环图数据）在服务端完成，减少传输
- 云函数是唯一入口，加埋点、加缓存、加限流都只改一处

代价：多一跳云函数冷启动（首次 ~300ms）。用**常驻实例**（云函数最小实例数设为 1）缓解。

---

## 2. 整体架构

```
┌───────────────────────── 客户端（uni-app 一套代码）─────────────────────────┐
│                                                                            │
│  ┌──────────── Pages ────────────┐   ┌──────── Components ────────┐        │
│  │ 首页账单  │ 拍照识别 │ 统计 │我的 │   │ 自研原子组件 + Wot 组件    │        │
│  └───────────────┬───────────────┘   └───────────────────────────┘        │
│                  │                                                          │
│  ┌───────────────▼───────────────┐   ┌───────────────────────────┐        │
│  │        Stores (Pinia)         │   │   Services                │        │
│  │  recordStore / statsStore     │◄──┤   sync（离线队列）         │        │
│  │  userStore / perfStore        │   │   imaging（压缩上传）       │        │
│  └───────────────┬───────────────┘   │   recognize（分级识别）     │        │
│                  │                    └───────────────────────────┘        │
│  ┌───────────────▼──────────────────────────────────────────────┐          │
│  │              api/client.ts  统一请求器                        │          │
│  │  重试 · 去重 · 超时 · 埋点 · 请求队列 · 错误归一               │          │
│  └───────────────┬──────────────────────────────────────────────┘          │
│                  │                                                          │
│  ┌───────────────▼──────────────────────────────────────────────┐          │
│  │         adapters/  跨端能力适配层（唯一 #ifdef 发生地）        │          │
│  │  storage · auth · media · share · clipboard · system · device │          │
│  └──────┬───────────────────────────────────────┬───────────────┘          │
│         │ MP-WEIXIN                             │ H5                       │
└─────────┼───────────────────────────────────────┼──────────────────────────┘
          │                                       │
          │ wx.cloud.callFunction                 │ HTTPS  fetch
          │ wx.cloud.uploadFile（图片直传）        │
          ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        微信云开发环境 (envId)                                │
│                                                                             │
│  ┌──────────────────────┐   ┌──────────────────────┐   ┌────────────────┐  │
│  │ 云函数 ledger        │   │ 云函数 recognize     │   │ 云函数 remind  │  │
│  │ 记录 CRUD / 统计聚合  │   │ 多模态识别 + 规则    │   │ 定时触发器     │  │
│  │ 鉴权 / 幂等 / 校验    │   │ 结果缓存 / 降级      │   │ 订阅消息下发   │  │
│  └──────┬───────────────┘   └──────────────────────┘   └────────────────┘  │
│         │              HTTP 访问服务入口（供 H5）                           │
│  ┌──────▼───────┐  ┌───────────────┐  ┌──────────────────┐                 │
│  │ 云数据库      │  │ 云存储         │  │ 云函数环境变量    │                 │
│  │ records      │  │ 账单原图       │  │ MODEL_API_KEY    │                 │
│  │ categories   │  │ (CDN 加速)     │  │ (不落客户端)      │                 │
│  │ perf_logs    │  └───────────────┘  └──────────────────┘                 │
│  └──────────────┘                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**平台差异总量的关键指标**：全工程 `#ifdef` 出现次数应 ≤ 20 处，且**全部位于 `src/adapters/` 内**。若业务代码里出现条件编译，视为架构违规，需重构。

---

## 3. 分层设计

### 3.1 依赖方向（单向，禁止反向引用）

```
pages/  →  components/  →  stores/  →  services/  →  api/  →  adapters/
                                                              ↓
                                                         平台 API
```

`adapters/` 是最底层，**不允许引用任何上层模块**。

### 3.2 各层职责

| 层 | 职责 | 禁止 |
|---|---|---|
| `pages/` | 组装、路由、生命周期、页面级状态 | 直接调平台 API、直接拼请求 |
| `components/` | 纯展示 + 受控交互，props in / emit out | 发起网络请求、读写全局状态 |
| `stores/` | 业务状态机、跨页面共享数据、乐观更新入口 | 出现 `#ifdef`、直接写本地存储 |
| `services/` | 有状态的业务流程（同步队列、上传管线、识别编排） | 出现 UI 相关代码 |
| `api/` | 请求构造、错误归一、重试去重、埋点 | 含业务判断逻辑 |
| `adapters/` | 平台能力差异收敛（storage / auth / media / share / device …） | 引用上层模块 |

### 3.3 跨端能力适配层（亮点 H1）

**接口定义**（`src/adapters/types.ts`）：

```ts
export interface IStorage {
  get<T>(key: string): T | null
  set(key: string, value: unknown): void
  remove(key: string): void
  /** 容量探测：当前已用字节 */
  usage(): Promise<number>
  /** 超限时把大对象切片落盘，读时重组 */
  setChunked(key: string, value: string): void
  getChunked(key: string): string | null
}

export interface IAuth {
  login(): Promise<{ uid: string; token: string; platform: 'mp' | 'h5' }>
  getSession(): Session | null
}

export interface IMedia {
  chooseImage(opts: { source: 'camera' | 'album' }): Promise<string>
  compress(src: string, target: CompressOption): Promise<CompressResult>
  saveToAlbum(path: string): Promise<void>
  /** 授权前置：未授权返回 false，由调用方走降级 UI */
  ensurePermission(scope: 'camera' | 'album' | 'record'): Promise<boolean>
}

export interface IShared { shareCard(opts: ShareOption): Promise<void> }
export interface ISystem { safeArea(): SafeArea; vibrate(type: 'light'|'medium'): void }
export interface IDevice { platform(): 'ios' | 'android' | 'devtools'; online(): boolean; onNetworkChange(cb: (on: boolean) => void): void }
```

**两端实现差异表**（这张表本身就是简历素材）：

| 能力 | MP-WEIXIN | H5 | 差异处理 |
|---|---|---|---|
| 登录 | `wx.cloud.callFunction` → 云函数注入 `OPENID` | `deviceId`（uuid 存 localStorage）+ 可选手机号绑定 | 统一返回 `{ uid, token }` |
| 存储 | `uni.setStorageSync`（单 key 1MB / 总 10MB 上限） | `localStorage`（约 5MB，超限抛异常） | `usage()` 探测 + 超限走 `setChunked` 切片 |
| 选择图片 | `uni.chooseMedia`（需隐私授权） | `<input type=file>` 包装 | 统一返回临时路径 / Blob URL |
| 图片压缩 | 隐藏 `<canvas type="2d">` + `canvasToTempFilePath` | `createImageBitmap` + canvas + `toBlob` | 统一返回 `{ path, size, width, height }` |
| 分享 | `onShareAppMessage` + `shareCard` canvas 生成图 | 复制链接 + 提示 | H5 降级为「复制链接」 |
| 震动 | `uni.vibrateShort` | `navigator.vibrate` | H5 不支持时静默忽略 |
| 安全区 | `uni.getSystemInfoSync().safeArea` | `env(safe-area-inset-*)` | 统一产出 `--safe-bottom` CSS 变量 |
| 网络监听 | `uni.onNetworkStatusChange` | `window.ononline/onoffline` | 统一回调 |

**能力探测与降级原则**：适配层方法**永不抛出未捕获异常**。任何平台能力缺失时返回「明确的降级结果」，由 `services/` 决定业务降级路径（例：相机授权被拒 → 返回值带 `denied: true` → 识别页切到手动表单）。

### 3.4 数据通道抽象

`src/api/client.ts` 暴露一个统一的 `call<T>(name, payload)`：

```ts
// MP: wx.cloud.callFunction({ name: 'ledger', data: { action, payload } })
// H5: fetch(`${HTTP_BASE}/${action}`, { method:'POST', body: JSON.stringify(payload) })
export async function call<T>(action: string, payload: unknown): Promise<T>
```

- 小程序端 → `adapters` 内 `callFunction`
- H5 端 → 云函数 **HTTP 访问服务**（`https://<envId>.service.tcloudbase.com/ledger`）
- **同一套云函数代码，两个入口**，业务逻辑零重复 —— 这是本项目跨端设计的关键点

> 切换点：若将来要换成自建 NestJS，只需替换 `call()` 的实现与 `HTTP_BASE`，上层零改动。这也是「决策 2」敢押云开发的底气。

### 3.5 组件库主题桥接（决策 1 的落地）

> 视觉变量的完整映射表在 `UI_SPEC.md` §4.3，本节只讲机制与约束。

**目标**：组件库的视觉由**我们的 Design Token** 决定，而不是由组件库决定。

**机制**：Wot 的样式全部由 CSS 变量驱动，且基础变量带 `!default` 兜底。1.14.0 源码实测（`node_modules/wot-design-uni/components/common/abstracts/variable.scss`）：

```scss
$-color-theme:   var(--wot-color-theme,   $default-theme) !default;  // 默认 #4D80F0
$-color-success: var(--wot-color-success, #34d19d)        !default;
$-color-bg:      var(--wot-color-bg,      #f5f5f5)        !default;
$-fs-title:      var(--wot-fs-title,      16px)           !default;
```

即**组件级变量全部从基础变量派生** → 覆盖基础变量即可让绝大多数组件自动贴合设计稿。

**两级映射**：

| 级别 | 覆盖对象 | 落点 | 说明 |
|---|---|---|---|
| 一级 | 基础变量（色 / 字阶 / 边距 / 遮罩） | `src/styles/wot-theme.scss` | 值必须引用 `tokens.scss` 的 **SCSS 变量**（`#{$color-accent}`），不写字面色量 |
| 二级 | 组件级变量中**硬编码 rgba** 的项（如 `--wot-action-sheet-cancel-bg` 默认 `rgba(240,240,240,1)`） | 同文件底部 | **只覆盖实际引入的组件**，逐条注释原因 |

**四条硬约束**：

1. `--wot-color-white` / `--wot-color-black` 参与组件内部 `mix()` 混色计算，**不要覆盖**，否则出脏色。
2. 小程序端默认值挂在 `page` 节点、H5 挂在 `:root` 节点，官方要求选择器写成 `:root, page { … }`——**只写一个会单端失效**。
3. uni-app **不支持全局挂载组件**，`wd-toast` / `wd-message-box` 必须在每个页面模板中显式写标签 → 统一封装成 `components/biz/Feedback.vue`，页面只引一次。
4. `sass` 版本须 **≤ 1.78.0**（Dart Sass 3.x 废弃了一批 API，组件库尚未适配），锁死在 `devDependencies`。

**生效性验证（否则等于没做）**：改 `design/tokens/tokens.json` 里的 `color/accent` → 跑 `npm run gen:scss` → 双端确认 `wd-button`(primary) / `wd-action-sheet` 选中态 / `wd-switch` 打开态的主色同步变化。

**备选路径**：若小程序端全局 CSS 变量覆盖被组件库样式加载顺序压制，改用 `wd-config-provider` 的 `theme-vars` + `@uni-ku/root` 虚拟根组件（多一个构建期插件，代价可接受）；再不行则该组件退回自研。

---

## 4. 关键子系统设计

### 4.1 图片处理管线（亮点 H2）

```
选图
 └─► 1. getImageInfo 读原始尺寸       → 埋点 originalSize
 └─► 2. 长边自适应降采样               → 长边 > 1600 时按比例缩到 1600
         └ 先降采样再压质量：避免 iOS 直接解码大图 OOM
 └─► 3. 阶梯压质量 0.8 → 0.6 → 0.4     → 每档检查体积，首次 ≤ 200KB 即停
 └─► 4. 上传（带并发与续传控制）
         小程序：wx.cloud.uploadFile 直传云存储（走 CDN）
         H5   ：POST 云函数（base64 / 分片），云函数内 uploadFile
 └─► 5. 返回 fileID → 提交识别任务     → 埋点 compressedSize / costMs / uploadMs
```

**并发与重试**：
- 全局上传并发上限 3（超出的进等待队列，避免弱网下全部超时）
- 分片阈值 512KB，分片上传失败只重传失败分片
- 重试策略：指数退避 `300ms × 2^n`，上限 3 次，**幂等**依赖 `uploadId`（客户端 uuid）

**降级**：
- 压缩失败 → 用原图上传（记录 `degraded: true`）
- 上传失败 → 账单以 `imageFileId: null` 落库，图片进重传队列，UI 显示占位图
- **绝不让图片上传失败阻塞记账主流程**

### 4.2 离线优先同步（亮点 H3）

**本地数据结构**（存 `storage`，key 前缀 `sl:`）：
- `sl:records:cache` — 本地账单快照（首屏直出用）
- `sl:sync:queue` — 待同步操作队列
- `sl:sync:meta` — 同步水位（最后成功同步的时间戳）

**队列项结构**：

```ts
interface SyncTask {
  taskId: string          // uuid
  clientId: string        // 目标账单的幂等键
  op: 'create' | 'update' | 'delete'
  payload: Partial<Record>
  baseVersion: number     // 乐观并发基线
  tries: number
  lastError?: string
  createdAt: number
}
```

**执行流程**：

1. 用户操作 → **立即**写入本地快照（乐观更新）→ UI 立刻响应
2. 同时入队 `sl:sync:queue`，账单 UI 标记「待同步」
3. 网络可用时触发 `flush()`，**串行**出队（串行保证同一 `clientId` 的操作有序）
4. 单条成功 → 出队 + 更新本地 `version`；失败 → `tries++`，指数退避重排
5. `tries > 5` → 标记「同步失败」，在列表项上出「重试」按钮，用户可手动触发
6. 网络从离线恢复 → `onNetworkChange(true)` 自动 `flush()`

**幂等实现**（关键设计）：
- 客户端生成 `clientId`（uuid v4），作为云数据库 `clientId` 字段的**唯一索引**
- `create` 重复提交 → 云函数捕获唯一冲突 → 直接返回已存在文档（视为成功），不报错
- `update/delete` 用「`clientId` + `version` 比对」：版本落后则返回当前服务端文档，客户端做**后写覆盖**（Last-Write-Wins），并记录冲突日志
- `delete` 一律软删除（`deleted: true`），保证其他设备的增量拉取能看到"删除"这个事实

**冲突策略**（明确定义，面试会问）：
- 本项目为**单用户多设备**场景，采用 **LWW（最后写入胜出）**
- 粒度是**字段级**：`update` 只提交变更字段，未变更字段不被覆盖，降低冲突面
- 冲突发生时服务端返回 `{ conflict: true, server: Record }`，客户端弹提示并采用服务端版本

### 4.3 分级识别（亮点配套）

| 级别 | 位置 | 做法 | 时延 | 成本 |
|---|---|---|---|---|
| L0 | 端内 | 正则抽金额 + 关键词映射分类（内置规则表 ~60 条） | <10ms | 0 |
| L1 | 云函数 | 多模态模型对图片做结构化抽取（JSON Schema 约束输出） | 1–3s | 按次计费 |
| L2 | 云函数 | L1 失败重试（换 prompt / 降为纯文本 OCR） | +2s | 按次计费 |

**编排逻辑**（`services/recognize/`）：
1. 端内先跑 L0，命中高置信（金额 + 分类都能识别）→ 直接返回，**不上传图片**
2. L0 置信不足 → 上传图片 → 调 L1，超时阈值 **8s**
3. L1 超时/失败 → 返回 L0 结果 + `degraded: true` → UI 文案「自动识别没成功，请确认一下金额」
4. 结果按图片 `md5` 缓存（云数据库 或 云函数内存），同一张图不重复计费

**风险**：若模型调用不可用（无 Key / 限流），识别能力整体降级为 L0 纯规则，**功能闭环不受影响**。这是刻意设计的容错边界。

### 4.4 性能工程（亮点 H4）

**分包划分**：

| 包 | 内容 | 说明 |
|---|---|---|
| 主包 | 首页、我的、7 个自研原子组件、**Wot 组件中被主包页面实际引用的部分**、tokens、adapters、api | 目标 ≤ 1.5MB，其中**组件库增量 ≤ 150KB** |
| 分包 `pages-capture` | 拍照识别页、压缩管线、识别编排 | **独立分包**（`independent: true`），不依赖主包 |
| 分包 `pages-stats` | 统计页、canvas 环图 | 普通分包 + **预下载**（首页停留 2s 后预载） |
| 分包 `pages-detail` | 详情页（含 `wd-datetime-picker` / `wd-number-keyboard` / `wd-img`） | 普通分包 |

配置要点：

- `manifest.json → mp-weixin.optimization.subPackages = true`（开启分包优化，否则公共依赖仍会被打进主包）
- 组件库按需引入靠 `pages.json → easycom.custom` 的映射 `"^wd-(.*)": "wot-design-uni/components/wd-$1/wd-$1.vue"`——**easycom 在编译期解析模板标签，只在模板里真实出现过的 `wd-*` 组件才会进包**，不要 `import` 整包
- ⚠️ 改 `pages.json` 的 `easycom` **不会触发重新编译**（uni-app 官方提醒），改完要顺手改动一个页面文件来触发
- 若主包超预算：先按 §1.2「外采」清单从后往前砍组件，再考虑把 `wd-datetime-picker` 这类重组件挪进分包

**启动优化**：
- 首屏**缓存直出**：首页 `onLoad` 先读 `sl:records:cache` 渲染，再发请求静默刷新并 diff 更新
- 首屏依赖收敛：只保留 `vue` + `pinia` + `adapters`，识别相关模块全部动态 `import()` 进分包
- 云函数最小实例数设 1，规避首次冷启动

**长列表虚拟滚动**：
- 用 `scroll-view` + 绝对定位 + 可视区计算（`startIndex`/`endIndex`），只渲染可视区 ±3 屏缓冲
- 滚动事件 16ms 节流；`setData` 只更新变化的索引区间，不整表替换
- 数据量 ≤ 200 时不启用虚拟滚动（避免过度设计）

### 4.5 可观测（亮点配套）

`src/utils/perf.ts` 采集：

| 指标 | 采集点 | 说明 |
|---|---|---|
| `launch` | `App.onLaunch` | 启动时间原点 |
| `t1` | 首页 `onReady` | 冷启动首屏可用耗时 |
| `pageReady` | 各页 `onReady` | 页面到达耗时 |
| `setdata` | 重写 `setData` 包装（MP 端） | 单次数据量（序列化后字节）+ 耗时 |
| `api` | `api/client.ts` | 每个 action 的耗时与成功率 |
| `compress` / `upload` | imaging | 体积与耗时 |
| `error` | `onError` / `onUnhandledRejection` | 错误归因 |

上报：批量攒 10 条或 10s 节流后 `call('perf.report')` 上报；**采样率 100% 但可开关**（我的页可关闭）。
展示：我的页隐藏入口 → 开发面板，展示核心指标（面试演示用）。

---

## 5. 目录结构

**工程根：`D:\projects\accounts`**（下述路径均相对此根目录）

```
accounts/
├─ docs/                       SPEC.md / ARCHITECTURE.md / UI_SPEC.md / DEV_PLAN.md / PERF_REPORT.md
├─ design/
│  ├─ figma-plugin/            一键生成设计稿的 Figma 插件（manifest.json + code.js）
│  ├─ tokens/                  Figma Variables 导出的 tokens.json（种子已就位）
│  └─ screenshots/             双端对照截图
├─ scripts/                    设计 Token 生成器与校验（不进主包）
│  ├─ lib/token-naming.mjs     三层命名唯一实现（UI_SPEC §2.7），两个生成器共用
│  ├─ gen-scss.mjs             tokens.json → src/styles/tokens.scss
│  ├─ gen-figma-tokens.mjs     tokens.json → design/figma-plugin/code.js 的 TOKENS 区
│  └─ check-figma-plugin.mjs   mock 运行 Figma 插件，抓运行时错误（不用开 Figma）
├─ src/
│  ├─ adapters/                ★ 跨端适配层（唯一 #ifdef 发生地）
│  │  ├─ types.ts  index.ts
│  │  ├─ storage.mp.ts  storage.h5.ts
│  │  ├─ auth.mp.ts     auth.h5.ts
│  │  ├─ media.mp.ts    media.h5.ts
│  │  └─ system.mp.ts   system.h5.ts
│  ├─ api/
│  │  ├─ client.ts             统一请求器
│  │  └─ modules/{record,category,stats,perf}.ts
│  ├─ services/
│  │  ├─ sync/{queue.ts,flush.ts,conflict.ts}
│  │  ├─ imaging/{compress.ts,upload.ts,pipeline.ts}
│  │  └─ recognize/{rule.ts,cloud.ts,orchestrator.ts}
│  ├─ stores/{record.ts,stats.ts,user.ts,perf.ts}
│  ├─ components/{Button,Cell,Card,Tag,Avatar,Skeleton,Empty}/index.vue   ← 7 个自研原子组件
│  ├─ components/biz/{RecordItem,CategoryPicker,DonutChart,ConfirmCard,SyncBadge,Feedback}.vue
│  ├─ pages/{index,profile}/           首页 / 我的
│  ├─ pages-capture/                    拍照识别（独立分包）
│  ├─ pages-stats/                      统计（分包 + 预下载）
│  ├─ pages-detail/                     详情（分包）
│  ├─ styles/{tokens.scss,wot-theme.scss,mixins.scss,theme.scss}   ← wot-theme：组件库主题映射
│  ├─ types/{api.ts,model.ts}
│  ├─ utils/{perf.ts,uuid.ts,money.ts,date.ts,throttle.ts}
│  ├─ static/
│  ├─ pages.json  manifest.json  main.ts  App.vue  uni.scss
├─ cloudfunctions/
│  ├─ ledger/                  CRUD + 统计聚合
│  ├─ recognize/               分级识别
│  └─ remind/                  定时 + 订阅消息
└─ package.json  tsconfig.json  vite.config.ts  .eslintrc
```

**运行时依赖清单**（写进 README 技术栈）：

| 依赖 | 版本 | 说明 |
|---|---|---|
| `wot-design-uni` | 1.14.0 | 交互密集型组件，easycom 按需引入，主题映射见 §3.5 |
| `pinia` | 2.x | 状态管理 |
| `vue` | ≥ 3.2.47 | uni-app 自带，也是 Wot 的 peer 要求 |
| `vue-i18n` | 9.x | uni-app H5 运行时间接依赖，保留 |
| `sass` | **1.78.0（锁死）** | >1.78 的新版会因废弃 API 导致组件库样式编译报错 |

**平台包裁剪（D1）**：官方模板 `uni-preset-vue#vite-ts` 自带 16 个平台包
（`uni-mp-alipay` / `uni-mp-baidu` / `uni-app-plus` / `uni-quickapp-webview` …）。
本项目只交付 **微信小程序 + H5**，因此 `package.json` 只保留
`@dcloudio/uni-app` · `uni-components` · `uni-h5` · `uni-mp-weixin` 四个运行时包。
收益是依赖树与安装时间显著下降；代价是**未来若要新增平台，需先把对应平台包装回来**。

**开发工具链**（devDependencies，D1 起生效）：

| 依赖 | 版本 | 说明 |
|---|---|---|
| `vite` | 5.2.8 | uni-app CLI 工程自带 |
| `typescript` | 5.x | `tsconfig` 开 `strict` + `noUnusedLocals` / `noUnusedParameters` |
| `vue-tsc` | 2.x | `npm run type-check` |
| `@vue/tsconfig` | 0.9.x | `tsconfig.json` 的基础配置来源。**必须配 TS 5.5+**：0.1.x 里含 TS 5.5 已移除的 `importsNotUsedAsValues` / `preserveValueImports`，会让 `type-check` 直接报 TS5102；0.9.x 改用 `verbatimModuleSyntax` |
| `eslint` + `@typescript-eslint/*` + `eslint-plugin-vue` | 8.x / 7.x / 9.x | `npm run lint:js`，只抓真问题，不开纯格式化规则 |
| `stylelint` + `stylelint-config-standard-scss` + `postcss-html` + `postcss-scss` | 16.x / 13.x | `npm run lint:style`；`rpx` 与小程序标签已加入白名单 |

> ESLint 用 8.x 传统 `.eslintrc.cjs` 格式而非 flat config —— 与
> `vue-eslint-parser` + `@typescript-eslint` 的组合最稳，且不引入额外适配包。
> `src/styles/tokens.scss` 是生成产物，已在 `.eslintignore` / `.stylelintignore` 中排除。

**Token 产物的形态约定（D1 落地）**：`tokens.scss` **顶层零 CSS 输出**，
因为它会被多个 `.vue` import（只为了拿 SCSS 变量），若把 `:root, page { … }`
写在顶层，每 import 一次就重复输出一份 CSS —— 典型的样式重复，lint 抓不到。
因此 CSS 自定义属性形态由文件末尾的 `sg-css-vars` mixin 承载，
**当前在 `App.vue` 的全局 style 里 `@include` 恰好一次**；
D3 新建 `styles/theme.scss`（全局样式入口）后，把这次 `@include` 挪过去即可。

---

## 6. 云函数接口定义

统一入口：`action + payload` → `{ ok, data, error }`

| action | 入参 | 出参 | 备注 |
|---|---|---|---|
| `record.list` | `{ since?, limit, cursor?, categoryId? }` | `{ list, nextCursor, hasMore }` | 游标分页，按 `happenedAt` 倒序 |
| `record.upsert` | `{ clientId, op, payload, baseVersion? }` | `{ record, conflict?, duplicated? }` | **幂等入口**，create/update 共用 |
| `record.remove` | `{ clientId }` | `{ ok }` | 软删除 |
| `record.batchSync` | `{ tasks: SyncTask[] }` | `{ results: [{ taskId, ok, conflict? }] }` | 恢复网络后批量补传，**减少往返** |
| `stats.monthly` | `{ month: 'YYYY-MM' }` | `{ total, avg, ring: [...], byCategory: [...] }` | 服务端聚合，环图占比在此算好 |
| `recognize.image` | `{ fileId \| base64 }` | `{ amount?, merchant?, categoryKey?, happenedAt?, confidence, degraded }` | 超时 8s，失败降级 |
| `perf.report` | `{ sessionId, metrics: [] }` | `{ ok }` | 批量上报 |
| `user.login` | `{}` | `{ uid, token }` | MP 取 OPENID；H5 传 deviceId |
| `subscribe.register` | `{ templateId }` | `{ ok }` | 存订阅额度 |

**通用校验**：所有 action 入口先过 `validate(action, payload)`（类型 + 范围），非法直接 `{ ok:false, error:{ code:'INVALID_PARAM' } }`。`amount` 强制为整数分、`0 < amount ≤ 100000000`。所有查询强制拼 `_openid: OPENID`。

---

## 7. 风险与降级预案

| 风险 | 触发信号 | 预案 |
|---|---|---|
| 云开发接入 uni-app 失败 | D4 上午仍跑不通 | 切备选：自建 NestJS + 本地持久化，`api/client.ts` 换实现即可（§3.4 已预留） |
| 模型 API 不可用 | L1 连续失败 | 整体降级 L0 纯规则，功能闭环不受影响 |
| 主包超 2MB | 依赖分析报警 | 砍 F6–F9 加分项；按 §1.2「外采」清单从后往前砍组件库引用；把环图拆到分包；移除 sourcemap |
| 组件库主题映射在小程序端不生效 | 改了 accent 色，`wd-*` 仍是蓝紫 | 退到 `wd-config-provider` 的 `theme-vars` + `@uni-ku/root`（§3.5 备选路径）；仍不生效则该组件退回自研 |
| 组件库主包增量超标 | D3 实测增量 > 150KB | 按 §1.2「外采」清单从后往前砍（先 `wd-swipe-action` / `wd-number-keyboard`）；把 `wd-datetime-picker` 挪进详情分包 |
| `sass` 版本不兼容 | 组件库样式编译报错 | `devDependencies` 锁 `sass@1.78.0`，不升到 1.79+ |
| 组件库冷门问题搜不到答案 | 单个问题卡 > 1 小时 | 立即换自研或求助，不硬耗；只影响 1 个组件，不阻塞里程碑 |
| 独立分包引用主包资源报错 | 编译报错 | 改为普通分包 + 预下载（损失一点启动收益，功能不受影响） |
| H5 端云函数 HTTP 访问服务未开通 | H5 请求 404 | 临时把 H5 数据源切本地 mock（`client.ts` 加 `MOCK` 开关），不阻塞小程序主线 |
| 工期超支 | D12 仍有亮点未完成 | 按 H1 → H2 → H3 → H4 顺序保底；H3/H4 可降级为「方案 + 部分实现 + 压测脚本」，但**不接受零实现** |
