import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import { initCloud } from '@/adapters/cloud';
import App from './App.vue';

export function createApp() {
  // 必须在任何 wx.cloud.callFunction 之前；失败不阻塞启动（适配层只返回结果，不抛异常）
  initCloud(import.meta.env.VITE_CLOUD_ENV_ID);
  const app = createSSRApp(App);
  // Pinia 2.x：状态层（stores/）从 D5 起用，这里先把实例挂上，避免后续再动入口文件
  app.use(createPinia());
  return {
    app,
  };
}
