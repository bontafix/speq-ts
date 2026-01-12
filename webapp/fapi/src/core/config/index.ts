import "dotenv/config";

/**
 * Конфигурация приложения
 */
export interface AppConfig {
  port: number;
  host: string;
  env: string;
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
 * Загрузка и валидация конфигурации из переменных окружения
 */
export function loadConfig(): AppConfig {
  return {
    port: process.env.FAPI_PORT ? parseInt(process.env.FAPI_PORT, 10) : 3002,
    host: process.env.FAPI_HOST || "0.0.0.0",
    env: process.env.NODE_ENV || "development",
    db: {
      host: process.env.PGHOST || "localhost",
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
      user: process.env.PGUSER || "postgres",
      password: typeof process.env.PGPASSWORD === "string" ? process.env.PGPASSWORD : "",
      database: process.env.PGDATABASE || "equipment_catalog",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      queryTimeout: 10000,
    },
  };
}

export const config = loadConfig();
