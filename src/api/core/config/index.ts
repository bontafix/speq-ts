import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Загружаем .env файл из корня проекта
// Определяем корень проекта: идем вверх от текущего файла до тех пор, пока не найдем .env
// или используем process.cwd() если запускаем из корня проекта
function findProjectRoot(): string {
  // Сначала пробуем от текущего файла (для ts-node)
  let currentDir = __dirname;
  const maxDepth = 10;
  let depth = 0;
  
  while (depth < maxDepth) {
    const envFile = path.join(currentDir, ".env");
    if (fs.existsSync(envFile)) {
      return currentDir;
    }
    const parent = path.dirname(currentDir);
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

// Унифицированная загрузка .env файлов
const nodeEnv = process.env.NODE_ENV || "development";
const envFiles = [
  `.env.${nodeEnv}.local`,
  `.env.${nodeEnv}`,
  ".env.local",
  ".env"
];

let loaded = false;
for (const file of envFiles) {
  const envPath = path.join(projectRoot, file);
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`✅ Loaded env from ${envPath}`);
      loaded = true;
      break;
    }
  }
}

if (!loaded) {
  console.warn(`⚠️  Warning: No .env file found in ${projectRoot}. Using environment variables.`);
}

/**
 * Конфигурация приложения
 */
export interface AppConfig {
  port: number;
  host: string;
  env: string;
  domain: string; // Домен для режима разработки (используется в Swagger и CORS)
  corsOrigins: string[]; // Разрешенные CORS origins
  jwt: {
    secret: string;
    expiresIn: string;
  };
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    queryTimeout: number;
  };
}

/**
 * Загрузка и валидация конфигурации из .env файла в корне проекта
 */
export function loadConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  const env = process.env.NODE_ENV || "development";
  const port = process.env.FAPI_PORT ? parseInt(process.env.FAPI_PORT, 10) : 3002;
  
  // Определяем домен: в режиме разработки используем FAPI_DOMAIN, иначе localhost
  const domain = process.env.FAPI_DOMAIN || `http://localhost:${port}`;
  
  // CORS origins из переменной окружения (через запятую) или дефолтные для dev
  const defaultCorsOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:5173',
    'http://localhost:9527',
  ];
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : defaultCorsOrigins;
  
  return {
    port: port,
    host: process.env.FAPI_HOST || "0.0.0.0",
    env: env,
    domain: domain,
    corsOrigins: corsOrigins,
    jwt: {
      secret: jwtSecret,
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
    db: {
      host: process.env.DB_HOST || process.env.FAPI_PGHOST || process.env.PGHOST || "localhost",
      port: Number(process.env.DB_PORT || process.env.FAPI_PGPORT || process.env.PGPORT) || 5432,
      user: process.env.DB_USER || process.env.FAPI_PGUSER || process.env.PGUSER || "postgres",
      password: (process.env.DB_PASS || process.env.DB_PASSWORD || process.env.FAPI_PGPASSWORD || process.env.PGPASSWORD || ""),
      database: process.env.DB_NAME || process.env.DB_DATABASE || process.env.FAPI_PGDATABASE || process.env.PGDATABASE || "equipment_catalog",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      queryTimeout: 10000,
    },
  };
}

export const config = loadConfig();
