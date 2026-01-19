"use strict";
/**
 * JSON Schema для валидации запросов и ответов модуля Categories
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategorySchema = exports.createCategorySchema = exports.paginatedCategoryListSchema = exports.getCategoryListQuerySchema = exports.categorySchema = void 0;
const shared_1 = require("../../core/schemas/shared");
/**
 * Схема категории
 */
exports.categorySchema = {
    type: "object",
    properties: {
        id: { type: "integer" },
        name: { type: "string" },
        parentId: { type: ["integer", "null"] },
        isActive: { type: ["boolean", "null"] },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
    },
};
/**
 * Схема query параметров для получения списка категорий
 */
exports.getCategoryListQuerySchema = {
    ...shared_1.paginationSchema,
};
/**
 * Схема ответа с пагинированным списком категорий
 */
exports.paginatedCategoryListSchema = {
    type: "object",
    properties: {
        items: {
            type: "array",
            items: exports.categorySchema,
            description: "Список категорий",
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
 * Схема создания категории
 */
exports.createCategorySchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        parentId: { type: ["integer", "null"] },
        isActive: { type: "boolean" },
    },
    required: ["name"],
};
/**
 * Схема обновления категории
 */
exports.updateCategorySchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        parentId: { type: ["integer", "null"] },
        isActive: { type: "boolean" },
    },
};
//# sourceMappingURL=category.schema.js.map