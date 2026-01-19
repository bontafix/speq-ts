"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parameterDictionaryPlugin = void 0;
const parameter_dictionary_service_1 = require("./parameter-dictionary.service");
const parameter_dictionary_controller_1 = require("./parameter-dictionary.controller");
const parameter_dictionary_schema_1 = require("./parameter-dictionary.schema");
const shared_1 = require("../../core/schemas/shared");
const auth_decorator_1 = require("../../core/decorators/auth.decorator");
/**
 * Плагин модуля Parameter Dictionary
 * Все эндпоинты требуют роль 'admin'
 */
const parameterDictionaryPlugin = async (fastify) => {
    const service = new parameter_dictionary_service_1.ParameterDictionaryService(fastify);
    const controller = new parameter_dictionary_controller_1.ParameterDictionaryController(service);
    // Получить все параметры словаря
    fastify.get("/parameter-dictionary", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Получить все параметры словаря (требует роль admin)",
            tags: ["Parameter Dictionary"],
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: {
                            type: "array",
                            items: parameter_dictionary_schema_1.parameterDictionarySchema,
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
    // Получить параметр словаря по ключу
    fastify.get("/parameter-dictionary/:key", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Получить параметр словаря по ключу (требует роль admin)",
            tags: ["Parameter Dictionary"],
            security: [{ bearerAuth: [] }],
            params: {
                type: "object",
                properties: {
                    key: { type: "string" },
                },
                required: ["key"],
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: parameter_dictionary_schema_1.parameterDictionarySchema,
                        timestamp: { type: "string" },
                    },
                },
                404: shared_1.errorResponseSchema,
                401: shared_1.errorResponseSchema,
                403: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.getByKey(request, reply);
    });
    // Создать параметр словаря
    fastify.post("/parameter-dictionary", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Создать параметр словаря (требует роль admin)",
            tags: ["Parameter Dictionary"],
            security: [{ bearerAuth: [] }],
            body: parameter_dictionary_schema_1.createParameterDictionarySchema,
            response: {
                201: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: parameter_dictionary_schema_1.parameterDictionarySchema,
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
    // Обновить параметр словаря
    fastify.put("/parameter-dictionary/:key", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Обновить параметр словаря (требует роль admin)",
            tags: ["Parameter Dictionary"],
            security: [{ bearerAuth: [] }],
            params: {
                type: "object",
                properties: {
                    key: { type: "string" },
                },
                required: ["key"],
            },
            body: parameter_dictionary_schema_1.updateParameterDictionarySchema,
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: parameter_dictionary_schema_1.parameterDictionarySchema,
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
    // Удалить параметр словаря
    fastify.delete("/parameter-dictionary/:key", {
        preHandler: [(0, auth_decorator_1.requireRole)("admin")],
        schema: {
            description: "Удалить параметр словаря (требует роль admin)",
            tags: ["Parameter Dictionary"],
            security: [{ bearerAuth: [] }],
            params: {
                type: "object",
                properties: {
                    key: { type: "string" },
                },
                required: ["key"],
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
};
exports.parameterDictionaryPlugin = parameterDictionaryPlugin;
//# sourceMappingURL=index.js.map