import { FastifyPluginAsync } from "fastify";
/**
 * Плагин JWT для Fastify
 * Регистрирует JWT плагин, но не использует его для автоматической верификации
 * Верификация происходит через наш кастомный декоратор authenticate
 */
export declare const jwtPlugin: FastifyPluginAsync;
//# sourceMappingURL=jwt.d.ts.map