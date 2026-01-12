import { Pool } from "pg";
import { config } from "../config";

/**
 * Создание и настройка PostgreSQL Pool
 */
export function createDatabasePool(): Pool {
  const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    max: config.db.max,
    idleTimeoutMillis: config.db.idleTimeoutMillis,
    connectionTimeoutMillis: config.db.connectionTimeoutMillis,
    query_timeout: config.db.queryTimeout,
  });

  // Обработка ошибок пула
  pool.on("error", (err, client) => {
    console.error("❌ Database pool error:", err.message);
    console.error("   Connection details:", {
      host: config.db.host,
      database: config.db.database,
    });
  });

  // Логирование подключений (только в режиме отладки)
  if (process.env.DEBUG) {
    pool.on("connect", () => {
      console.log("✅ New database connection established");
    });

    pool.on("remove", () => {
      console.log("🔌 Database connection removed from pool");
    });
  }

  return pool;
}
