import { FastifyReply } from "fastify";
/**
 * Стандартный формат успешного ответа
 */
export interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    timestamp: string;
}
/**
 * Форматирование успешного ответа
 */
export declare function successResponse<T>(data: T): ApiResponse<T>;
/**
 * Отправка успешного ответа
 */
export declare function sendSuccess<T>(reply: FastifyReply, data: T, statusCode?: number): FastifyReply<import("fastify").RouteGenericInterface, import("fastify").RawServerDefault, import("node:http").IncomingMessage, import("node:http").ServerResponse<import("node:http").IncomingMessage>, unknown, import("fastify").FastifySchema, import("fastify").FastifyTypeProviderDefault, unknown>;
//# sourceMappingURL=api-response.d.ts.map