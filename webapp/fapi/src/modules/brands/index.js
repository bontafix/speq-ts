"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandsPlugin = void 0;
const brand_service_1 = require("./brand.service");
const brand_controller_1 = require("./brand.controller");
const brand_schema_1 = require("./brand.schema");
const shared_1 = require("../../core/schemas/shared");
/**
 * Плагин модуля Brands
 */
const brandsPlugin = async (fastify) => {
    const service = new brand_service_1.BrandService(fastify);
    const controller = new brand_controller_1.BrandController(service);
    // Получить список брендов с пагинацией
    fastify.get("/brands", {
        schema: {
            description: "Получить список брендов с пагинацией",
            tags: ["Brands"],
            querystring: brand_schema_1.getBrandListQuerySchema,
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: brand_schema_1.paginatedBrandListSchema,
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
    // Получить бренд по ID
    fastify.get("/brands/:id", {
        schema: {
            description: "Получить бренд по ID",
            tags: ["Brands"],
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
                        data: brand_schema_1.brandSchema,
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
    // Создать бренд
    fastify.post("/brands", {
        schema: {
            description: "Создать бренд",
            tags: ["Brands"],
            body: brand_schema_1.createBrandSchema,
            response: {
                201: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: brand_schema_1.brandSchema,
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
    // Обновить бренд
    fastify.put("/brands/:id", {
        schema: {
            description: "Обновить бренд",
            tags: ["Brands"],
            params: {
                type: "object",
                properties: {
                    id: { type: "string" },
                },
                required: ["id"],
            },
            body: brand_schema_1.updateBrandSchema,
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: brand_schema_1.brandSchema,
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
    // Удалить бренд
    fastify.delete("/brands/:id", {
        schema: {
            description: "Удалить бренд",
            tags: ["Brands"],
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
exports.brandsPlugin = brandsPlugin;
//# sourceMappingURL=index.js.map