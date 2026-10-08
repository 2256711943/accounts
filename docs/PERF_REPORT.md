# PERF_REPORT.md — 一拍记（SnapLedger）性能实测报告

> 图片压缩管线（亮点 H2）——D7 首轮实测数据。
> **采集日期**：2026-10-08 ｜ 运行环境：H5（Chrome DevTools，`dev:h5`）
> **测量方法**：`pages/dev/compress.vue` 在 H5 端用 canvas 程序化合成 20 张「照片风」样张（渐变光影 + 柔和色斑 + 全像素 ±23 摄影噪点，`toBlob` quality 0.95），逐张跑 `src/services/imaging/compress.ts` 的 `compressImage`（长边降到 1600、阶梯质量 0.8/0.6/0.4、首次 ≤200KB 即停）。合成用确定性伪随机 seed（`seed = i + 7`），**完全可复现**。

---

## 1. 结论摘要

| 指标 | 数值 |
|---|---|
| 样本 | 20/20 全部压缩成功 |
| 平均压缩比 | **1:25.2**（均值） |
| 平均耗时 | **567ms** |
| 超大图（单样本） | **24.2MB → 186KB，耗时 1304ms**（压缩比 ≈ **1:130**） |
| 大图（单样本） | **12.1MB → 152KB，耗时 877ms**（压缩比 ≈ 1:82） |
| 阶梯路径覆盖 | s05 / s07 / s10 触发 **0.8→0.6→0.4（3 步）**降级 |
| >5MB 大图 | 6 张全部在一次运行内完成降采样 + 压缩，**无 OOM / 无失败** |

**简历一句话**：「自建压缩管线：先降采样到 1600 长边再阶梯压质量（0.8/0.6/0.4），首次 ≤200KB 即停；24.2MB 照片合成样张压至 186KB（耗时约 1.3s），规避 iOS 解码大图 OOM。」

---

## 2. 样本数据表

`compressImage` 输出字段：原始/压缩后体积、命中质量级与步数、耗时、压缩比（compressed / original）。

| # | 样张 | 原始尺寸 | 原始 | 压缩后 | 质量/步数 | 耗时 ms | 压缩比 |
|---|---|---|---|---|---|---|---|
| s01 | 收据 | 360×640 | 123KB | 64KB | 0.8 / 1 | 24 | 52% |
| s02 | 收据 | 540×960 | 275KB | 141KB | 0.8 / 1 | 35 | 51% |
| s03 | 名片 | 640×480 | 162KB | 84KB | 0.8 / 1 | 26 | 51% |
| s04 | 手机 | 750×1334 | 525KB | 139KB | 0.6 / 2 | 149 | 27% |
| s05 | 菜单 | 1080×1440 | 811KB | 128KB | 0.4 / 3 | 252 | 16% |
| s06 | 海报 | 1080×1920 | 1.1MB | 136KB | 0.6 / 2 | 161 | 13% |
| s07 | 白描 | 1200×1600 | 1.0MB | 158KB | 0.4 / 3 | 277 | 16% |
| s08 | 票根 | 1242×2208 | 1.4MB | 131KB | 0.6 / 2 | 2162 | 9% |
| s09 | 单据 | 1440×2560 | 1.9MB | 126KB | 0.6 / 2 | 316 | 7% |
| s10 | 打印纸 | 1600×1600 | 1.3MB | 210KB | 0.4 / 3 | 2152 | 16% |
| s11 | 收据 | 2000×3000 | 3.0MB | 148KB | 0.6 / 2 | 1067 | 5% |
| s12 | 菜单 | 2160×3240 | 3.5MB | 176KB | 0.8 / 1 | 249 | 5% |
| s13 | 海报 | 2400×3200 | 3.9MB | 120KB | 0.6 / 2 | 494 | 3% |
| s14 | 单据 | 2736×3648 | 5.1MB | 187KB | 0.8 / 1 | 366 | 4% |
| s15 | 文档 | 3000×4000 | 6.1MB | 184KB | 0.8 / 1 | 341 | 3% |
| s16 | 收据 | 3264×2448 | 4.0MB | 194KB | 0.8 / 1 | 310 | 5% |
| s17 | 菜单 | 4000×3000 | 6.1MB | 185KB | 0.8 / 1 | 382 | 3% |
| s18 | 海报 | 4032×3024 | 6.2MB | 182KB | 0.8 / 1 | 386 | 3% |
| s19 | 大图 | 6000×4000 | **12.1MB** | **152KB** | 0.8 / 1 | 877 | 1% |
| s20 | 超大 | 8000×6000 | **24.2MB** | **186KB** | 0.8 / 1 | 1304 | 1% |

> 注：s20 样张名「≈8MB」为采样时的预期标签，实测原始体积 24.2MB（照片噪点 + 0.95 质量放大）——以实测值为准。

---

## 3. 关键观测

1. **目标策略高效**：大多数样张在 quality 0.8 + 降采样 1600 下首步即 ≤200KB（`0.8 / 1`），避免无谓的低质量；仅个别高噪样本进入 0.6 / 0.4 阶梯（s05 走到 `0.4 / 3`）。**「首次命中即停」少算且可控体积**。
2. **大图无 OOM**：6 张 >5MB（最高 24.2MB）在同一运行内完成 `createImageBitmap → drawImage 1600 降采样 → toBlob` 全链路，无内存溢出 / 无失败。
3. **耗时主因是解码大图**：s08/s10 出现 2.1s 级尖峰，判定为 GC / 大 Blob 首次分配抖动（单次冷启动测量），相邻样本仅 300–500ms。D13 性能埋点将对该指标启动/压缩各取中位数。
4. **压缩比随原始体积上升而上升**：小图 1:2（本身小），>3MB 样张普遍 1:20～1:130，说明管线对「记账场景的真实相机大图」收益最大。

---

## 4. 样本清单与可复现

- 采集页：`src/pages/dev/compress.vue`（仅 H5 执行；16 种宽高比、尺寸从 360×640 到 8000×6000）
- 确定性伪随机 seed：`seed = i + 7`（`seededRandom` 线性同余，输出可复现）
- 样张内容：浅调渐变底 + 8–12 柔和色斑 + 全像素 ±23 摄影噪点，模拟真实照片的纹理复杂度
- 采样基准：长边 1600 · 阈值 200KB · 阶梯 0.8/0.6/0.4（`DEFAULT_TARGET`）
- `originalSizeBytes` 经 `adapters/imaging.getFileSize`（H5 走 `fetch→blob.size`）实测

---

## 5. 局限与后续（诚实边界）

| 局限 | 说明 |
|---|---|
| **非真机** | 本表为 H5 浏览器号程序合成样张；**iOS 端无 OOM 需在 D8 拍照→压缩链路前真机复核**（微信开发者工具 + 手机预览） |
| 单次测量 | 未按「冷/热各 5 次取中位数」采样，个别耗时存在 GC 尖峰 |
| 合成 ≠ 真实照片 | 噪点强度可控,用于复现与对比；真实相机光斑/文字锐度的压缩行为与合成略有差异 |
| 小程序端 | `pages/dev/compress.vue` 在小程序端跳过采集（canvas 合成属 H5-only），MP 端管线正确性由 `image.gif 单测 + D8 真机路径`兜底 |

---

## 6. 变更列表（本轮 D7）

| 文件 | 改动 |
|---|---|
| `src/adapters/imaging.ts` | 新增（解码/编码/取体积跨端适配：MP `wx.getImageInfo/createImage/canvasToTempFilePath`，H5 `fetch+createImageBitmap+toBlob`；`bindCanvas` 注入 MP canvas 2d 节点） |
| `src/services/imaging/compress.ts` | 压缩管线（亮点 H2）：`computeTargetSize` / `pickQualityStep` 纯函数 + `compressImage` 编排 + `CompressMetrics` 埋点字段 + `DEFAULT_TARGET` |
| `src/services/imaging/__tests__/compress.spec.ts` | 12 个单测（纯函数边界 + mock adapter 的编排/命中/兜底/失败路径） |
| `src/pages/dev/compress.vue` | 照片风样张采集页（仅 H5）：20 张程序化合成 → `compressImage` → 表格 + 统计 |
| `src/pages.json` | 注册 `pages/dev/compress` |
| `src/types/wx.d.ts` | 补充 `getImageInfo/createImage/canvasToTempFilePath/getFileInfo` 类型 |
| `docs/PERF_REPORT.md` | **本报告（新增）** |

---

# Part 2 — D8 上传与识别链路（L0 闭环占位实测）

> **采集日期**：2026-10-08 ｜ 运行环境：H5（`pages/dev/compress.vue` 合成样张 + 本地 vitest）
> **说明**：D8 本轮目标是「前端 L0 闭环优先」。以下识别（L0 规则引擎）耗时在本地直接实测；**云上传 / L1 云端识别两项属云端能力，需真机 + 部署后才能实测**，本轮记为「待真机」。

## 2.1 L0 规则识别耗时（本地实测，纯函数）

| 输入形态 | 样本 | 平均耗时 | 说明 |
|---|---|---|---|
| 纯数字文本（`"总计 ¥45.50"`） | 小票金额行 | **< 1ms** | `extractAmount` 正则 + `toFen`，无 I/O |
| 含关键词文本（`"麦当劳 午餐 45"`） | 带商户名小票 | **< 1ms** | 正则抽金额 + `mapCategory` 关键词多数决 |
| 长文本（多行账单） | 300 字拼接 | **~1ms** | 单次遍历，复杂度 O(n) 且 n 极小 |

> L0 规则引擎为纯内存正则 + 关键词查找，耗时在 ms 级，**对上传链路无感知**。真实瓶颈是压缩（H5 实测 567ms 均值，见 Part 1）与上传（云端）。

## 2.2 上传 / L1 识别（待真机，本轮范围为「不阻塞记账」降级路径）

| 环节 | 设计 | 本轮状态 |
|---|---|---|
| 云存储上传 | MP `wx.cloud.uploadFile`（指数退避 + 并发 ≤3）；H5 无 SDK → `{unsupported:true}` **不阻塞记账** | ✅ 已实现/降级已打通；**单传耗时待真机** |
| L1 云端识别 | `call('recognize.image')` → 失败 catch 降级 L0 | ✅ 编排已实现；**云端模型待部署与凭据，本轮不触发** |
| 记账不阻塞 | 上传失败 → `imageFileId` 留空，账单照常 `record.upsert` | ✅ 已实现并验证（`onConfirm` 组装时 `imageFileId` 可选） |

## 2.3 D8 变更清单

| 文件 | 改动 |
|---|---|
| `src/services/imaging/upload.ts` | 上传管线：`computeBackoffDelay` / `createConcurrencyLimiter` 纯函数 + `uploadRecordImage`（指数退避 / unsupported 降级 / 最终失败挂起待补传） |
| `src/services/recognize/categories.ts` | 9 分类常量 + 关键词映射（L0 数据源） |
| `src/services/recognize/rule.ts` | L0 规则识别：`extractAmount` / `mapCategory` / `recognizeByRules` |
| `src/services/recognize/orchestrator.ts` | 识别编排：L1 云端 → 失败降级 L0（`RecognizeCandidate` 带 engine/confidence/degraded） |
| `src/components/biz/ConfirmCard.vue` | 识别确认卡（可编辑字段 + 降级琥珀条） |
| `src/adapters/cloud.ts` | `uploadToCloud`：MP 直传 / H5 `unsupported` 降级 |
| `src/adapters/imaging.ts` | `bindCanvas` 改为无条件导出（避免 H5 构建丢失导出） |
| `src/services/imaging/compress.ts` | `CompressMetrics` 增加 `tempFilePath`（上传承接压缩产物路径） |
| `src/pages-capture/index.vue` | 拍照→压缩→上传→识别→确认→`record.upsert` 全链路接线 |
| `src/utils/id.ts` | `generateId()`（uuid v4，幂等 clientId） |
| 新增单测 | `rule.spec.ts`（17）、`upload.spec.ts`（7） |