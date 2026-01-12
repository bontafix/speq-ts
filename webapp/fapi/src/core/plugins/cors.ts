import { FastifyPluginAsync } from "fastify";
import cors from "@fastify/cors";

/**
 * Плагин CORS
 */
export const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: true, // Разрешаем все источники (можно настроить конкретные)
    credentials: true,
  });
};
