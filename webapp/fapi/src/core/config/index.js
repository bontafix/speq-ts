"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.loadConfig = loadConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Загружаем .env файл из корня проекта
// Определяем корень проекта: идем вверх от текущего файла до тех пор, пока не найдем .env
// или используем process.cwd() если запускаем из корня проекта
function findProjectRoot() {
    // Сначала пробуем от текущего файла (для ts-node)
    let currentDir = __dirname;
    const maxDepth = 10;
    let depth = 0;
    while (depth < maxDepth) {
        const envFile = path_1.default.join(currentDir, ".env");
        if (fs_1.default.existsSync(envFile)) {
            return currentDir;
        }
        const parent = path_1.default.dirname(currentDir);
        if (parent === currentDir) {
            break; // Достигли корня файловой системы
        }
        currentDir = parent;
        depth++;
    }
    // Если не нашли, используем process.cwd() (рабочая директория)
    return process.cwd();
}
const projectRoot = findProjectRoot();
const envPath = path_1.default.join(projectRoot, ".env");
// Проверяем существование файла (опционально, dotenv не выбросит ошибку если файла нет)
if (fs_1.default.existsSync(envPath)) {
    const result = dotenv_1.default.config({ path: envPath });
    if (result.error) {
        console.warn(`⚠️  Warning: Failed to load .env file from ${envPath}:`, result.error.message);
    }
    else {
        console.log(`✅ Loaded .env file from: ${envPath}`);
    }
}
else {
    console.warn(`⚠️  Warning: .env file not found at ${envPath}. Using environment variables.`);
}
/**
 * Загрузка и валидация конфигурации из .env файла в корне проекта
 */
function loadConfig() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error("JWT_SECRET environment variable is required");
    }
    const env = process.env.NODE_ENV || "development";
    const port = process.env.FAPI_PORT ? parseInt(process.env.FAPI_PORT, 10) : 3002;
    // Определяем домен: в режиме разработки используем FAPI_DOMAIN, иначе localhost
    const domain = process.env.FAPI_DOMAIN || `http://localhost:${port}`;
    return {
        port: port,
        host: process.env.FAPI_HOST || "0.0.0.0",
        env: env,
        domain: domain,
        jwt: {
            secret: jwtSecret,
            expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        },
        db: {
            host: process.env.FAPI_PGHOST || "localhost",
            port: process.env.FAPI_PGPORT ? parseInt(process.env.FAPI_PGPORT, 10) : 5432,
            user: process.env.FAPI_PGUSER || "postgres",
            password: typeof process.env.FAPI_PGPASSWORD === "string" ? process.env.FAPI_PGPASSWORD : "",
            database: process.env.FAPI_PGDATABASE || "equipment_catalog",
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            queryTimeout: 10000,
        },
    };
}
exports.config = loadConfig();
//# sourceMappingURL=index.js.map