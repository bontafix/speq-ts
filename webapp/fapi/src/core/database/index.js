"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databasePlugin = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const pool_1 = require("./pool");
/**
 * Плагин для подключения к базе данных
 * Добавляет декоратор fastify.db для доступа к Pool
 * Обернут в fastify-plugin для глобальной доступности декоратора
 */
const databasePluginImpl = async (fastify) => {
    const pool = (0, pool_1.createDatabasePool)();
    // Добавляем декоратор для доступа к БД
    fastify.decorate("db", pool);
    // Закрываем пул при остановке сервера
    fastify.addHook("onClose", async () => {
        await pool.end();
    });
};
// Экспортируем плагин, обернутый в fastify-plugin
exports.databasePlugin = (0, fastify_plugin_1.default)(databasePluginImpl, {
    name: "database-plugin",
});
//# sourceMappingURL=index.js.map