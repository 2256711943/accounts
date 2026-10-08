/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 微信小程序全局 `wx` 的最小类型声明。
 *
 * 为什么需要：`@dcloudio/types` 只 `/// <reference>` 了 uni-app 与 html5plus，
 * 不含 `wx`（实测 grep 无结果），而 tsconfig 开了 `strict`，直接用 `wx` 会报 TS2304。
 *
 * 为什么不装 `miniprogram-api-typings`：本项目目前只用到 `wx.cloud` 的
 * `init` / `callFunction` 两个 API，引整包类型属于新增依赖，
 * 按 `AGENTS.md` 禁止事项需先更新 `docs/ARCHITECTURE.md §5` 依赖清单。
 * 后续若 `wx.*` 用法显著变多，再评估整包引入。
 *
 * 用法约束：`wx` 只允许出现在 `src/adapters/` 内（架构红线 2 + 红线 5）。
 */

declare namespace WxCloud {
  interface InitOptions {
    /** 云开发环境 ID；缺省时回落到小程序默认环境 */
    env?: string;
    /** 是否把用户访问记录写入用户管理 */
    traceUser?: boolean;
  }

  interface CallFunctionOptions<P = unknown> {
    /** 云函数名 */
    name: string;
    /** 传给云函数的 event */
    data?: P;
    /** 指定调用的环境；缺省用 `init` 时设置的 env */
    config?: { env?: string };
  }

  interface CallFunctionResult<T = unknown> {
    result: T;
    errMsg: string;
  }

  interface CloudNamespace {
    init(options?: InitOptions): void;
    callFunction<T = unknown, P = unknown>(
      options: CallFunctionOptions<P>
    ): Promise<CallFunctionResult<T>>;
  }
}

/* ------------------------------------------------------------------ *
 * 授权 / 隐私 / 选择媒体 的最小类型（D6 拍照页用）
 * ------------------------------------------------------------------ */

namespace WxSetting {
  interface SettingResult {
    authSetting: Record<string, boolean | undefined>;
    errMsg: string;
  }
  interface FailResult {
    errMsg?: string;
  }
  interface QueryOption {
    success?: (res: SettingResult) => void;
    fail?: (res: FailResult) => void;
  }
  interface AuthorizeOption {
    /** 授权作用域，如 'scope.camera' */
    scope: string;
    success?: () => void;
    fail?: (res: FailResult) => void;
  }
}

namespace WxMedia {
  interface TempFile {
    tempFilePath: string;
    size: number;
    fileType?: string;
  }
  interface ChooseMediaResult {
    tempFiles: TempFile[];
    errMsg: string;
  }
  interface ChooseMediaOption {
    count?: number;
    mediaType?: Array<'image' | 'video' | 'mix'>;
    sourceType?: Array<'album' | 'camera'>;
    sizeType?: Array<'original' | 'compressed'>;
    success?: (res: ChooseMediaResult) => void;
    fail?: (res: { errMsg?: string }) => void;
  }
}

namespace WxPrivacy {
  /** onNeedPrivacyAuthorization 的 resolve：agree/disagree 后推进被拦截的隐私接口 */
  type Resolve = (opts?: { event?: 'agree' | 'disagree'; buttonId?: string }) => void;
  interface PrivacySettingInfo {
    needAuthorization: boolean;
    privacyContractName?: string;
    errMsg?: string;
  }
  interface GetSettingOption {
    success?: (res: PrivacySettingInfo) => void;
    fail?: (res: { errMsg?: string }) => void;
  }
}

interface WxNamespace {
  /** H5 端不存在该属性；小程序端恒存在 */
  cloud?: WxCloud.CloudNamespace;

  /** 获取当前授权状态（如 authSetting['scope.camera']） */
  getSetting(option: WxSetting.QueryOption): void;
  /** 发起授权申请（scope.*） */
  authorize(option: WxSetting.AuthorizeOption): void;
  /** 打开系统设置页，引导用户重新授权 */
  openSetting(option: WxSetting.QueryOption): void;

  /** 选择图片/视频；sourceType 决定走相机还是相册 */
  chooseMedia(option: WxMedia.ChooseMediaOption): void;

  /** 系统轻震 */
  vibrateShort(option?: { type?: 'heavy' | 'medium' | 'light' }): void;

  /** 隐私接口被调用前触发，用于弹出自有《隐私保护指引》 */
  onNeedPrivacyAuthorization(callback: (resolve: WxPrivacy.Resolve) => void): void;
  /** 请求用户同意隐私协议；成功回调用于继续被拦截的接口 */
  requirePrivacyAuthorize(option: { success?: () => void; fail?: () => void }): void;
  /** 查询是否需要隐私授权 */
  getPrivacySetting(option: WxPrivacy.GetSettingOption): void;
  /** 打开官方隐私保护指引 */
  openPrivacyContract(option?: { fail?: (res: { errMsg?: string }) => void }): void;

  /** 获取图片信息（宽高） */
  getImageInfo(option: WxImg.InfoOption): void;
  /** 创建一个可用于 `<canvas type="2d">` 绘制的图片对象 */
  createImage(): WxImg.MpImage;
  /** 把 canvas 2d 节点导出为临时图片文件（D7 压缩管线） */
  canvasToTempFilePath(option: WxImg.CanvasExportOption): void;
  /** 获取临时文件大小（字节） */
  getFileInfo(option: WxImg.FileInfoOption): void;
}

/** 图片信息 / canvas 2d 导出 的最小类型（D7 压缩管线用）。 */
namespace WxImg {
  interface InfoResult {
    width: number;
    height: number;
    errMsg?: string;
  }
  interface InfoOption {
    src: string;
    success?: (res: InfoResult) => void;
    fail?: (res: { errMsg?: string }) => void;
  }
  /** 用于 `<canvas type="2d">` 绘制的图片对象（wx.createImage 返回） */
  interface MpImage {
    src: string;
    onload: (() => void) | null;
    onerror: (() => void) | null;
  }
  interface CanvasExportOption {
    canvas?: unknown;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    destWidth?: number;
    destHeight?: number;
    fileType?: string;
    /** jpg 压缩质量，0-1 */
    quality?: number;
    success?: (res: { tempFilePath: string; errMsg?: string }) => void;
    fail?: (res: { errMsg?: string }) => void;
  }
  interface FileInfoResult {
    size: number;
    errMsg?: string;
  }
  interface FileInfoOption {
    filePath: string;
    success?: (res: FileInfoResult) => void;
    fail?: (res: { errMsg?: string }) => void;
  }
}

declare const wx: WxNamespace;
