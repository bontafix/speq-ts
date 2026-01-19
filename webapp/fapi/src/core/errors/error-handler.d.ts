import { FastifyError, FastifyReply, FastifyRequest, FastifyInstance } from "fastify";
import { AppError } from "./app-error";
/**
 * Глобальный обработчик ошибок
 */
export declare function errorHandler(this: FastifyInstance, error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply): Promise<never>;
//# sourceMappingURL=error-handler.d.ts.map