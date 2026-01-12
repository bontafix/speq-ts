import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  // Используем /speq-bot/webapp/ для работы через nginx на пути /speq-bot/webapp
  // Для обычного использования через /webapp измените на base: "/webapp/"
  base: "/speq-bot/webapp/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    allowedHosts: [
      "botfix.ru",
      ".botfix.ru", // разрешаем все поддомены
    ],
    proxy: {
      "/speq-bot/webapp/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/speq-bot\/webapp\/api/, "/api"),
      },
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
