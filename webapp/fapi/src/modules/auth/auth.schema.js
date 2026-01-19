"use strict";
/**
 * JSON Schema для валидации запросов и ответов модуля Auth
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authResponseSchema = exports.loginSchema = exports.registerSchema = void 0;
/**
 * Схема регистрации
 */
exports.registerSchema = {
    type: "object",
    properties: {
        email: {
            type: "string",
            format: "email",
            description: "Email",
        },
        password: {
            type: "string",
            minLength: 6,
            description: "Пароль (минимум 6 символов)",
        },
        name: {
            type: "string",
            description: "Полное имя",
        },
    },
    required: ["email", "password"],
};
/**
 * Схема входа
 */
exports.loginSchema = {
    type: "object",
    properties: {
        email: {
            type: "string",
            format: "email",
            description: "Email",
        },
        password: {
            type: "string",
            description: "Пароль",
        },
    },
    required: ["email", "password"],
};
/**
 * Схема ответа авторизации
 */
exports.authResponseSchema = {
    type: "object",
    properties: {
        token: {
            type: "string",
            description: "JWT токен",
        },
        user: {
            type: "object",
            properties: {
                id: { type: "integer" },
                username: { type: ["string", "null"] },
                email: { type: ["string", "null"] },
                name: { type: ["string", "null"] },
                status: { type: ["boolean", "null"] },
                roles: {
                    type: "array",
                    items: { type: "string" },
                },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
            },
        },
    },
};
//# sourceMappingURL=auth.schema.js.map