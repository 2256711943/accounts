/**
 * 图片解码 / 编码适配层（跨端）：D7 压缩管线的平台差异收敛点。
 *
 * ⚠️ 本文件是 `#ifdef` 的合法发生地（AGENTS.md 架构红线 2）。
 * 单文件 + 函数体内 `#ifdef`，禁拆 platform 后缀文件（见 cloud.ts 同款说明 / ARCHITECTURE.md §3.3）。
 * 适配层方法永不抛未捕获异常（架构红线 6）：失败一律返回 `null`，由 services 决定降级。
 *
 * - MP：`wx.getImageInfo` 读宽高；`wx.createImage` + `wx.canvasToTempFilePath` 编码
 *       （en编码前需在页面 `onReady` 用 `bindCanvas()` 绑定 `<canvas type="2d">` 节点）
 * - H5：`new Image()` / `fetch`+`createImageBitmap` 读尺寸；`toBlob` 编码
 */

import { isMpWeixin } from './system';

export interface ImageInfo {
  width: number;
  height: number;
}

export interface EncodeOptions {
  /** 目标输出宽（已按降采样计算） */
  width: number;
  height: number;
  /** jpg 质量 0-1 */
  quality: number;
}

export interface EncodeOutcome {
  /** 编码产物的临时路径（MP 临时文件 / H5 blob URL） */
  tempFilePath: string;
  /** 字节数 */
  size: number;
}

/** 设备像素比（埋点用；压缩导出用固定尺寸，无需 dpr 缩放）。 */
export function getDpr(): number {
  let dpr = 1;
  // #ifdef MP-WEIXIN
  try {
    dpr = uni.getSystemInfoSync().pixelRatio || 1;
  } catch {
    dpr = 1;
  }
  // #endif
  // #ifndef MP-WEIXIN
  dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  // #endif
  return dpr;
}

/** 读取图片原始宽高。失败返回 null。 */
export function getImageInfo(src: string): Promise<ImageInfo | null> {
  if (!isMpWeixin()) return getImageInfoH5(src);
  // #ifdef MP-WEIXIN
  return getImageInfoMp(src);
  // #endif
}

/** 读取文件字节数。失败返回 null。 */
export function getFileSize(src: string): Promise<number | null> {
  if (!isMpWeixin()) return getFileSizeH5(src);
  // #ifdef MP-WEIXIN
  return getFileSizeMp(src);
  // #endif
}

/**
 * 编码一张图片到指定尺寸 + jpg 质量。返回 { 临时路径, 字节数 }；失败返回 null。
 * 降采样在编码时完成（drawImage 到目标尺寸），H5 走 `toBlob`，MP 走 `canvasToTempFilePath`。
 */
export function encodeImage(src: string, opts: EncodeOptions): Promise<EncodeOutcome | null> {
  if (!isMpWeixin()) return encodeImageH5(src, opts);
  // #ifdef MP-WEIXIN
  return encodeImageMp(src, opts);
  // #endif
}

/* ------------------------------------------------------------------ *
 * H5（未包 #ifdef，充当默认实现：同 cloud.ts 的 callCloudH5）
 * ------------------------------------------------------------------ */

function getImageInfoH5(src: string): Promise<ImageInfo | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

function getFileSizeH5(src: string): Promise<number | null> {
  return fetch(src)
    .then((r) => r.blob())
    .then((b) => b.size)
    .catch(() => null);
}

function encodeImageH5(src: string, opts: EncodeOptions): Promise<EncodeOutcome | null> {
  return (async () => {
    try {
      const blob = await fetch(src).then((r) => r.blob());
      const bitmap = await createImageBitmap(blob);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = opts.width;
        canvas.height = opts.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, opts.width, opts.height);
        const out = await new Promise<EncodeOutcome | null>((resolve) => {
          canvas.toBlob(
            (result) => {
              if (!result) {
                resolve(null);
                return;
              }
              resolve({ tempFilePath: URL.createObjectURL(result), size: result.size });
            },
            'image/jpeg',
            opts.quality
          );
        });
        return out;
      } finally {
        bitmap.close();
      }
    } catch {
      return null;
    }
  })();
}

/* ------------------------------------------------------------------ *
 * MP-WEIXIN
 * ------------------------------------------------------------------ */

interface MpCanvas2d {
  width: number;
  height: number;
  getContext(type: string): CanvasRenderingContext2D | null;
}

/** MP 端：页面 `onReady` 时经 `bindCanvas` 注入 `<canvas type="2d">` 节点。 */
let mpCanvas: MpCanvas2d | null = null;

/**
 * 绑定小程序 canvas 2d 节点（页面 `<canvas type="2d">` 经 `uni.createSelectorQuery` 得到）。
 *
 * ⚠️ 本函数**无条件导出**（不包 `#ifdef`）：拍照页（普通分包）无条件 import 它，
 * 若包起来 H5 构建不留该导出会触发「引用不存在的导出」；H5 端走 `toBlob` 不使用
 * `mpCanvas`，这里只写入一个无人读取的模块变量，安全降级（同 `callCloudH5` 约定）。
 * 调用方在页面 `onReady` 时绑定；压缩导出统一输出到该节点。传 null 解绑。
 */
export function bindCanvas(node: MpCanvas2d | null): void {
  mpCanvas = node;
}

function getImageInfoMp(src: string): Promise<ImageInfo | null> {
  return new Promise((resolve) => {
    if (typeof wx.getImageInfo !== 'function') {
      resolve(null);
      return;
    }
    try {
      wx.getImageInfo({
        src,
        success: (res) => resolve({ width: res.width, height: res.height }),
        fail: () => resolve(null),
      });
    } catch {
      resolve(null);
    }
  });
}

function getFileSizeMp(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof wx.getFileInfo !== 'function') {
      resolve(null);
      return;
    }
    try {
      wx.getFileInfo({ filePath: src, success: (res) => resolve(res.size), fail: () => resolve(null) });
    } catch {
      resolve(null);
    }
  });
}

function encodeImageMp(src: string, opts: EncodeOptions): Promise<EncodeOutcome | null> {
  return new Promise((resolve) => {
    if (!mpCanvas) {
      // 未绑定 canvas 节点（页面未 onReady / 未放 canvas）→ 按能力缺失处理
      resolve(null);
      return;
    }
    try {
      const node = mpCanvas;
      node.width = opts.width;
      node.height = opts.height;
      const ctx = node.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.clearRect(0, 0, opts.width, opts.height);

      const img = wx.createImage();
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          // MP 图片对象是偏平结构，转成 DOM 的 CanvasImageSource 以满足 ctx.drawImage 类型
          ctx.drawImage(img as unknown as CanvasImageSource, 0, 0, opts.width, opts.height);
          wx.canvasToTempFilePath({
            canvas: node,
            x: 0,
            y: 0,
            width: opts.width,
            height: opts.height,
            destWidth: opts.width,
            destHeight: opts.height,
            fileType: 'jpg',
            quality: opts.quality,
            success: (res) => {
              if (typeof wx.getFileInfo !== 'function') {
                resolve({ tempFilePath: res.tempFilePath, size: 0 });
                return;
              }
              wx.getFileInfo({
                filePath: res.tempFilePath,
                success: (info) => resolve({ tempFilePath: res.tempFilePath, size: info.size }),
                fail: () => resolve(null),
              });
            },
            fail: () => resolve(null),
          });
        } catch {
          resolve(null);
        }
      };
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}