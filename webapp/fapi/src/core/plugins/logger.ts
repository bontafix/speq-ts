import { FastifyPluginAsync } from "fastify";

/**
 * Плагин логирования запросов
 */
export const loggerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    const startTime = Date.now();
    request.startTime = startTime;

    const timestamp = new Date().toISOString();
    const method = request.method;
    const url = request.url;
    const query = request.query ? JSON.stringify(request.query) : "";
    const ip =
      request.ip ||
      request.headers["x-forwarded-for"] ||
      request.headers["x-real-ip"] ||
      "unknown";

    fastify.log.info(
      {
        method,
        url,
        query: query || undefined,
        ip,
      },
      `→ ${method} ${url}${query ? " ?" + query : ""} | IP: ${ip}`,
    );
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now());
    const statusCode = reply.statusCode;
    const statusEmoji =
      statusCode >= 500 ? "❌" : statusCode >= 400 ? "⚠️" : statusCode >= 300 ? "↪️" : "✅";

    fastify.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode,
        duration,
      },
      `${statusEmoji} ${request.method} ${request.url} → ${statusCode} (${duration}ms)`,
    );
  });
};

// Расширение типов для хранения startTime
declare module "fastify" {
  interface FastifyRequest {
    startTime?: number;
  }
}
