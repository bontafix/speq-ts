import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "./app-error";

/**
 * Глобальный обработчик ошибок
 */
export async function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Логируем ошибку
  request.log.error(error);

  // Если это наша кастомная ошибка
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code || "APP_ERROR",
        message: error.message,
      },
    });
  }

  // Ошибка валидации Fastify
  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation error",
        details: error.validation,
      },
    });
  }

  // Стандартная ошибка Fastify
  const statusCode = error.statusCode || 500;
  const message =
    process.env.NODE_ENV === "development" ? error.message : "Internal server error";

  return reply.status(statusCode).send({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message,
    },
  });
}
