"use strict";
/**
 * Общие JSON Schema определения для валидации
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorResponseSchema = exports.paginationSchema = void 0;
/**
 * Схема для пагинации
 */
exports.paginationSchema = {
    type: "object",
    properties: {
        page: {
            type: "integer",
            minimum: 1,
            default: 1,
            description: "Номер страницы",
        },
        limit: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
            description: "Количество элементов на странице",
        },
    },
};
/**
 * Схема стандартного ответа с ошибкой
 */
exports.errorResponseSchema = {
    type: "object",
    properties: {
        error: {
            type: "object",
            properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: { type: "object" },
            },
            required: ["code", "message"],
        },
    },
    required: ["error"],
};
//# sourceMappingURL=shared.js.map