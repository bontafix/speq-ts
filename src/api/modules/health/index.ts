import { FastifyPluginAsync } from "fastify";
import { checkDatabaseHealth } from "../../core/database/health";

/**
 * Плагин модуля Health Check
 */
export const healthPlugin: FastifyPluginAsync = async (fastify) => {
  // Health check endpoint
  fastify.get(
    "/health",
    {
      schema: {
        description: "Проверка здоровья сервиса и базы данных",
        tags: ["Health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              database: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        level: { type: "string", enum: ["error", "warn"] },
                        message: { type: "string" },
                      },
                    },
                  },
                },
              },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const dbHealth = await checkDatabaseHealth(fastify.db);
      return reply.send({
        status: "ok",
        database: dbHealth,
        timestamp: new Date().toISOString(),
      });
    },
  );
};
