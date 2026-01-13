import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Pool } from "pg";
import { createDatabasePool } from "./pool";

// Расширение типов Fastify для добавления декоратора db
declare module "fastify" {
  interface FastifyInstance {
    db: Pool;
  }
}

/**
 * Плагин для подключения к базе данных
 * Добавляет декоратор fastify.db для доступа к Pool
 * Обернут в fastify-plugin для глобальной доступности декоратора
 */
const databasePluginImpl: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const pool = createDatabasePool();

  // Добавляем декоратор для доступа к БД
  fastify.decorate("db", pool);

  // Закрываем пул при остановке сервера
  fastify.addHook("onClose", async () => {
    await pool.end();
  });
};

// Экспортируем плагин, обернутый в fastify-plugin
export const databasePlugin = fp(databasePluginImpl, {
  name: "database-plugin",
});
