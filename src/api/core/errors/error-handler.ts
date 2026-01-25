import { FastifyError, FastifyReply, FastifyRequest, FastifyInstance } from "fastify";
import { AppError } from "./app-error";

/**
 * Добавляет CORS заголовки к ответу
 */
function addCorsHeaders(request: FastifyRequest, reply: FastifyReply) {
  const origin = request.headers.origin;
  const allowedOrigins = [
    'http://localhost:9527',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://botfix.ru'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

/**
 * Глобальный обработчик ошибок
 */
export function errorHandler(
  this: FastifyInstance,
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // КРИТИЧЕСКИ ВАЖНО: Добавляем CORS заголовки даже при ошибках
  addCorsHeaders(request, reply);
  
  // Логируем ошибку
  request.log.error(error);

  // Если это наша кастомная ошибка
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: {
        code: error.code || "APP_ERROR",
        message: error.message,
      },
    });
    return;
  }

  // Ошибка валидации Fastify
  if (error.validation) {
    reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation error",
        details: error.validation,
      },
    });
    return;
  }

  // Стандартная ошибка Fastify
  const statusCode = error.statusCode || 500;
  const message =
    process.env.NODE_ENV === "development" ? error.message : "Internal server error";

  reply.status(statusCode).send({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message,
    },
  });
  return;
}
