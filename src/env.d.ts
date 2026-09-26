/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 云开发环境 ID，来自 .env.local（已被 .gitignore 的 `*.local` 规则忽略）；留空则用小程序默认环境 */
  readonly VITE_CLOUD_ENV_ID?: string;
  /**
   * H5 端云函数 HTTP 访问服务的基地址，**含云函数路由段**，来自 .env.local。
   * 形如 `https://<envId>-<hash>.<region>.app.tcloudbase.com/ledger`。
   *
   * ⚠️ 其中的 `<hash>` 是环境生成的后缀，**无法由 envId 推断** —— 必须用
   * `queryGateway(listRoutes)` 或云开发控制台的「HTTP 访问服务」查真实值。
   * 小程序端不使用本变量（走 wx.cloud.callFunction）。
   */
  readonly VITE_CLOUD_HTTP_BASE?: string;
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}
