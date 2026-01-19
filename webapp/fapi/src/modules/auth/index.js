"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authPlugin = void 0;
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const auth_schema_1 = require("./auth.schema");
const shared_1 = require("../../core/schemas/shared");
const auth_decorator_1 = require("../../core/decorators/auth.decorator");
/**
 * Плагин модуля Auth
 */
const authPlugin = async (fastify) => {
    const service = new auth_service_1.AuthService(fastify);
    const controller = new auth_controller_1.AuthController(service);
    // Регистрация
    fastify.post("/auth/register", {
        schema: {
            description: "Регистрация нового пользователя",
            tags: ["Auth"],
            body: auth_schema_1.registerSchema,
            // Не указываем security для публичного эндпоинта
            response: {
                201: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: auth_schema_1.authResponseSchema,
                        timestamp: { type: "string" },
                    },
                    required: ["success", "data", "timestamp"],
                },
                400: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.register(request, reply);
    });
    // Вход
    fastify.post("/auth/login", {
        schema: {
            description: "Вход пользователя",
            tags: ["Auth"],
            body: auth_schema_1.loginSchema,
            // Не указываем security для публичного эндпоинта
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: auth_schema_1.authResponseSchema,
                        timestamp: { type: "string" },
                    },
                    required: ["success", "data", "timestamp"],
                },
                401: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.login(request, reply);
    });
    // Получить текущего пользователя
    fastify.get("/auth/me", {
        preHandler: [auth_decorator_1.authenticate],
        schema: {
            description: "Получить информацию о текущем пользователе",
            tags: ["Auth"],
            security: [{ bearerAuth: [] }],
            response: {
                200: {
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
                401: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.me(request, reply);
    });
};
exports.authPlugin = authPlugin;
//# sourceMappingURL=index.js.map