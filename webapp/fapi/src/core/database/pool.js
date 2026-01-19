"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabasePool = createDatabasePool;
const pg_1 = require("pg");
const config_1 = require("../config");
/**
 * Создание и настройка PostgreSQL Pool
 */
function createDatabasePool() {
    const pool = new pg_1.Pool({
        host: config_1.config.db.host,
        port: config_1.config.db.port,
        user: config_1.config.db.user,
        password: config_1.config.db.password,
        database: config_1.config.db.database,
        max: config_1.config.db.max,
        idleTimeoutMillis: config_1.config.db.idleTimeoutMillis,
        connectionTimeoutMillis: config_1.config.db.connectionTimeoutMillis,
        query_timeout: config_1.config.db.queryTimeout,
    });
    // Обработка ошибок пула
    pool.on("error", (err, client) => {
        console.error("❌ Database pool error:", err.message);
        console.error("   Connection details:", {
            host: config_1.config.db.host,
            database: config_1.config.db.database,
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
//# sourceMappingURL=pool.js.map