"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const plugin_vue_1 = __importDefault(require("@vitejs/plugin-vue"));
const path_1 = __importDefault(require("path"));
exports.default = (0, vite_1.defineConfig)({
    plugins: [(0, plugin_vue_1.default)()],
    // Используем /speq-bot/webapp/ для работы через nginx на пути /speq-bot/webapp
    // Для обычного использования через /webapp измените на base: "/webapp/"
    base: "/speq-bot/webapp/",
    resolve: {
        alias: {
            "@": path_1.default.resolve(__dirname, "./src"),
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
//# sourceMappingURL=vite.config.js.map