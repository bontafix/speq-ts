import { FastifyPluginAsync } from "fastify";
/**
 * Плагин логирования запросов
 */
export declare const loggerPlugin: FastifyPluginAsync;
declare module "fastify" {
    interface FastifyRequest {
        startTime?: number;
    }
}
//# sourceMappingURL=logger.d.ts.map