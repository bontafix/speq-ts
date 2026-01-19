/**
 * Базовый класс для ошибок приложения
 */
export declare class AppError extends Error {
    statusCode: number;
    message: string;
    code?: string | undefined;
    constructor(statusCode: number, message: string, code?: string | undefined);
}
/**
 * Ошибка "Не найдено"
 */
export declare class NotFoundError extends AppError {
    constructor(message?: string);
}
/**
 * Ошибка валидации
 */
export declare class ValidationError extends AppError {
    constructor(message?: string);
}
/**
 * Ошибка сервера
 */
export declare class InternalServerError extends AppError {
    constructor(message?: string);
}
/**
 * Ошибка авторизации
 */
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
/**
 * Ошибка доступа (нет прав)
 */
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
//# sourceMappingURL=app-error.d.ts.map