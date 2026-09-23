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

interface WxNamespace {
  /** H5 端不存在该属性；小程序端恒存在 */
  cloud?: WxCloud.CloudNamespace;
}

declare const wx: WxNamespace;
