import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

export function createApp() {
  const app = createSSRApp(App);
  // Pinia 2.x：状态层（stores/）从 D5 起用，这里先把实例挂上，避免后续再动入口文件
  app.use(createPinia());
  return {
    app,
  };
}
