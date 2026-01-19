"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesPlugin = void 0;
const category_service_1 = require("./category.service");
const category_controller_1 = require("./category.controller");
const category_schema_1 = require("./category.schema");
const shared_1 = require("../../core/schemas/shared");
/**
 * Плагин модуля Categories
 */
const categoriesPlugin = async (fastify) => {
    const service = new category_service_1.CategoryService(fastify);
    const controller = new category_controller_1.CategoryController(service);
    // Получить список категорий с пагинацией
    fastify.get("/categories", {
        schema: {
            description: "Получить список категорий с пагинацией",
            tags: ["Categories"],
            querystring: category_schema_1.getCategoryListQuerySchema,
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: category_schema_1.paginatedCategoryListSchema,
                        timestamp: { type: "string" },
                    },
                    required: ["success", "data", "timestamp"],
                },
                500: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.getAll(request, reply);
    });
    // Получить категорию по ID
    fastify.get("/categories/:id", {
        schema: {
            description: "Получить категорию по ID",
            tags: ["Categories"],
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
                        data: category_schema_1.categorySchema,
                        timestamp: { type: "string" },
                    },
                    required: ["success", "data", "timestamp"],
                },
                404: shared_1.errorResponseSchema,
                500: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.getById(request, reply);
    });
    // Создать категорию
    fastify.post("/categories", {
        schema: {
            description: "Создать категорию",
            tags: ["Categories"],
            body: category_schema_1.createCategorySchema,
            response: {
                201: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: category_schema_1.categorySchema,
                        timestamp: { type: "string" },
                    },
                    required: ["success", "data", "timestamp"],
                },
                400: shared_1.errorResponseSchema,
                500: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.create(request, reply);
    });
    // Обновить категорию
    fastify.put("/categories/:id", {
        schema: {
            description: "Обновить категорию",
            tags: ["Categories"],
            params: {
                type: "object",
                properties: {
                    id: { type: "string" },
                },
                required: ["id"],
            },
            body: category_schema_1.updateCategorySchema,
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: category_schema_1.categorySchema,
                        timestamp: { type: "string" },
                    },
                    required: ["success", "data", "timestamp"],
                },
                404: shared_1.errorResponseSchema,
                500: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.update(request, reply);
    });
    // Удалить категорию
    fastify.delete("/categories/:id", {
        schema: {
            description: "Удалить категорию",
            tags: ["Categories"],
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
                500: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.delete(request, reply);
    });
};
exports.categoriesPlugin = categoriesPlugin;
//# sourceMappingURL=index.js.map