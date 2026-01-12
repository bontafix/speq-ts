/**
 * Базовый класс для ошибок приложения
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Ошибка "Не найдено"
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(404, message, "NOT_FOUND");
  }
}

/**
 * Ошибка валидации
 */
export class ValidationError extends AppError {
  constructor(message: string = "Validation error") {
    super(400, message, "VALIDATION_ERROR");
  }
}

/**
 * Ошибка сервера
 */
export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(500, message, "INTERNAL_ERROR");
  }
}
