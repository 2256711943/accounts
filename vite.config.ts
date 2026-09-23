import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

/**
 * 把仓库根的 `cloudfunctions/` 同步进小程序产物目录。
 *
 * 为什么需要：uni-app 每次编译都会重建 `dist/<mode>/mp-weixin`，
 * 而 `manifest.json → mp-weixin.cloudfunctionRoot` 是相对「小程序根目录」解析的，
 * 不复制的话微信开发者工具找不到云函数目录，右键上传会直接失败。
 *
 * 守卫：只在 `UNI_PLATFORM === 'mp-weixin'` 且 `UNI_OUTPUT_DIR` 存在时执行
 * （`uni -p h5` 与 `uni build` 都不会命中）。
 */
function syncCloudFunctions(): Plugin {
  return {
    name: "snapledger:sync-cloudfunctions",
    // 用 closeBundle 而非 writeBundle：dev 模式（uni -p mp-weixin 本质是 watch build）也会触发
    closeBundle() {
      if (process.env.UNI_PLATFORM !== "mp-weixin") return;

      const outDir = process.env.UNI_OUTPUT_DIR;
      if (!outDir) return;

      // npm script 在项目根运行，cwd 即仓库根
      const from = path.resolve(process.cwd(), "cloudfunctions");
      if (!fs.existsSync(from)) return;

      const to = path.join(outDir, "cloudfunctions");
      fs.rmSync(to, { recursive: true, force: true });
      fs.cpSync(from, to, { recursive: true });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni(), syncCloudFunctions()],
});
