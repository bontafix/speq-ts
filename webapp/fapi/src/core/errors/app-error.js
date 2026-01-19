"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.UnauthorizedError = exports.InternalServerError = exports.ValidationError = exports.NotFoundError = exports.AppError = void 0;
/**
 * Базовый класс для ошибок приложения
 */
class AppError extends Error {
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
/**
 * Ошибка "Не найдено"
 */
class NotFoundError extends AppError {
    constructor(message = "Resource not found") {
        super(404, message, "NOT_FOUND");
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Ошибка валидации
 */
class ValidationError extends AppError {
    constructor(message = "Validation error") {
        super(400, message, "VALIDATION_ERROR");
    }
}
exports.ValidationError = ValidationError;
/**
 * Ошибка сервера
 */
class InternalServerError extends AppError {
    constructor(message = "Internal server error") {
        super(500, message, "INTERNAL_ERROR");
    }
}
exports.InternalServerError = InternalServerError;
/**
 * Ошибка авторизации
 */
class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(401, message, "UNAUTHORIZED");
    }
}
exports.UnauthorizedError = UnauthorizedError;
/**
 * Ошибка доступа (нет прав)
 */
class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(403, message, "FORBIDDEN");
    }
}
exports.ForbiddenError = ForbiddenError;
//# sourceMappingURL=app-error.js.map