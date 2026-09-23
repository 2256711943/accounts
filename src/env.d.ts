/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 云开发环境 ID，来自 .env.local（已被 .gitignore 的 `*.local` 规则忽略）；留空则用小程序默认环境 */
  readonly VITE_CLOUD_ENV_ID?: string;
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}
