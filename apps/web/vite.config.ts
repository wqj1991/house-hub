import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

/* Tauri 移动端调试：真机通过局域网访问 dev server，HMR 走单独的 ws 端口。 */
const host = process.env.TAURI_DEV_HOST;
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // 版本号只维护 package.json，界面里读 __APP_VERSION__，避免写死后漂移
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 1420,
    strictPort: true,
    // 安卓调试：adb reverse 只会把设备侧端口打回宿主的 127.0.0.1（IPv4）。
    // Vite 默认 host='localhost' 在 Windows 上只绑 ::1，reverse 会连不上，故显式绑 IPv4 loopback。
    host: host || "127.0.0.1",
    // 开发期把 /house-api 打到本机 API，与线上 openresty 的路径一致。
    // 本机 8787 落进 Windows netsh 保留段（8699-8798）→ EACCES，开发默认 18878（见 scripts/android-dev.sh:60）
    proxy: {
      "/house-api": {
        target:
          process.env.HOUSE_API_URL ||
          `http://127.0.0.1:${process.env.HOUSE_API_PORT || 18878}`,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/house-api/, ""),
      },
    },
    // 安卓走 adb reverse：HMR 复用 1420 这条隧道，不再单独开 1421（设备侧到不了宿主 1421）
    hmr: host ? { protocol: "ws", host, port: 1420 } : undefined,
    // docs/ 与 tools/ 里会放 Excel 打开着的 .md/.xlsx；watcher 注册时 EBUSY 会让 dev server 直接崩。
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/docs/**",
        "**/dist/**",
        "**/.git/**",
        "**/tools/**",
        "**/*.xlsx",
        "**/*.tmp",
      ],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    // minSdk 24 的 WebView 上 es2022 是安全的
    target: "es2022",
    minify: "esbuild",
    sourcemap: false,
  },
});
