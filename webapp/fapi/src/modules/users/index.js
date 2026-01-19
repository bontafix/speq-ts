"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersPlugin = void 0;
const user_service_1 = require("./user.service");
const user_controller_1 = require("./user.controller");
const user_schema_1 = require("./user.schema");
const shared_1 = require("../../core/schemas/shared");
const auth_decorator_1 = require("../../core/decorators/auth.decorator");
/**
 * Плагин модуля Users
 * Все эндпоинты требуют роль 'admin'
 */
const usersPlugin = async (fastify) => {
    const service = new user_service_1.UserService(fastify);
    const controller = new user_controller_1.UserController(service);
    // Получить всех пользователей
    fastify.get("/users", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Получить всех пользователей (требует роль admin)",
            tags: ["Users"],
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: {
                            type: "array",
                            items: user_schema_1.userSchema,
                        },
                        timestamp: { type: "string" },
                    },
                },
                401: shared_1.errorResponseSchema,
                403: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.getAll(request, reply);
    });
    // Получить пользователя по ID
    fastify.get("/users/:id", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Получить пользователя по ID (требует роль admin)",
            tags: ["Users"],
            security: [{ bearerAuth: [] }],
            params: {
                type: "object",
                properties: {
                    id: { type: "string" },
                },
                required: ["id"],
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: user_schema_1.userSchema,
                        timestamp: { type: "string" },
                    },
                },
                404: shared_1.errorResponseSchema,
                401: shared_1.errorResponseSchema,
                403: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.getById(request, reply);
    });
    // Создать пользователя
    fastify.post("/users", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Создать пользователя (требует роль admin)",
            tags: ["Users"],
            security: [{ bearerAuth: [] }],
            body: user_schema_1.createUserSchema,
            response: {
                201: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: user_schema_1.userSchema,
                        timestamp: { type: "string" },
                    },
                },
                400: shared_1.errorResponseSchema,
                401: shared_1.errorResponseSchema,
                403: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.create(request, reply);
    });
    // Обновить пользователя
    fastify.put("/users/:id", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Обновить пользователя (требует роль admin)",
            tags: ["Users"],
            security: [{ bearerAuth: [] }],
            params: {
                type: "object",
                properties: {
                    id: { type: "string" },
                },
                required: ["id"],
            },
            body: user_schema_1.updateUserSchema,
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: user_schema_1.userSchema,
                        timestamp: { type: "string" },
                    },
                },
                404: shared_1.errorResponseSchema,
                401: shared_1.errorResponseSchema,
                403: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.update(request, reply);
    });
    // Удалить пользователя
    fastify.delete("/users/:id", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Удалить пользователя (требует роль admin)",
            tags: ["Users"],
            security: [{ bearerAuth: [] }],
            params: {
                type: "object",
                properties: {
                    id: { type: "string" },
                },
                required: ["id"],
            },
            response: {
                204: { type: "null" },
                404: shared_1.errorResponseSchema,
                401: shared_1.errorResponseSchema,
                403: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.delete(request, reply);
    });
    // Назначить роль пользователю
    fastify.post("/users/:id/roles", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Назначить роль пользователю (требует роль admin)",
            tags: ["Users"],
            security: [{ bearerAuth: [] }],
            params: {
                type: "object",
                properties: {
                    id: { type: "string" },
                },
                required: ["id"],
            },
            body: user_schema_1.assignRoleSchema,
            response: {
                204: { type: "null" },
                400: shared_1.errorResponseSchema,
                404: shared_1.errorResponseSchema,
                401: shared_1.errorResponseSchema,
                403: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.assignRole(request, reply);
    });
    // Удалить роль у пользователя
    fastify.delete("/users/:id/roles/:roleId", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Удалить роль у пользователя (требует роль admin)",
            tags: ["Users"],
            security: [{ bearerAuth: [] }],
            params: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    roleId: { type: "string" },
                },
                required: ["id", "roleId"],
            },
            response: {
                204: { type: "null" },
                404: shared_1.errorResponseSchema,
                401: shared_1.errorResponseSchema,
                403: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.removeRole(request, reply);
    });
};
exports.usersPlugin = usersPlugin;
//# sourceMappingURL=index.js.map