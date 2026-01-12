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
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Отправка успешного ответа
 */
export function sendSuccess<T>(reply: FastifyReply, data: T, statusCode: number = 200) {
  return reply.status(statusCode).send(successResponse(data));
}
