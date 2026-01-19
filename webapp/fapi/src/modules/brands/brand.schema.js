"use strict";
/**
 * JSON Schema для валидации запросов и ответов модуля Brands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBrandSchema = exports.createBrandSchema = exports.paginatedBrandListSchema = exports.getBrandListQuerySchema = exports.brandSchema = void 0;
const shared_1 = require("../../core/schemas/shared");
/**
 * Схема бренда
 */
exports.brandSchema = {
    type: "object",
    properties: {
        id: { type: "integer" },
        name: { type: "string" },
        isActive: { type: ["boolean", "null"] },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
    },
};
/**
 * Схема query параметров для получения списка брендов
 */
exports.getBrandListQuerySchema = {
    ...shared_1.paginationSchema,
};
/**
 * Схема ответа с пагинированным списком брендов
 */
exports.paginatedBrandListSchema = {
    type: "object",
    properties: {
        items: {
            type: "array",
            items: exports.brandSchema,
            description: "Список брендов",
        },
        total: {
            type: "integer",
            description: "Общее количество записей",
        },
        page: {
            type: "integer",
            description: "Номер текущей страницы",
        },
        limit: {
            type: "integer",
            description: "Количество элементов на странице",
        },
        totalPages: {
            type: "integer",
            description: "Общее количество страниц",
        },
    },
    required: ["items", "total", "page", "limit", "totalPages"],
};
/**
 * Схема создания бренда
 */
exports.createBrandSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        isActive: { type: "boolean" },
    },
    required: ["name"],
};
/**
 * Схема обновления бренда
 */
exports.updateBrandSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        isActive: { type: "boolean" },
    },
};
//# sourceMappingURL=brand.schema.js.map