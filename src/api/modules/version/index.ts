import { FastifyPluginAsync } from "fastify";

/**
 * Плагин модуля Version
 * Простой эндпоинт для получения версии API
 */
export const versionPlugin: FastifyPluginAsync = async (fastify) => {
  // Version endpoint
  fastify.get(
    "/version",
    {
      schema: {
        description: "Получение версии API",
        tags: ["Version"],
        response: {
          200: {
            type: "object",
            properties: {
              version: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return reply.send({
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      });
    },
  );
};
