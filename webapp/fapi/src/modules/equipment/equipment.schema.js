"use strict";
/**
 * JSON Schema для валидации запросов и ответов модуля Equipment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginatedEquipmentListSchema = exports.equipmentCardSchema = exports.getEquipmentListQuerySchema = exports.getEquipmentByIdParamsSchema = void 0;
const shared_1 = require("../../core/schemas/shared");
/**
 * Схема параметров пути для получения оборудования по ID
 */
exports.getEquipmentByIdParamsSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "ID оборудования",
        },
    },
    required: ["id"],
};
/**
 * Схема query параметров для получения списка оборудования
 */
exports.getEquipmentListQuerySchema = {
    type: "object",
    properties: {
        ...shared_1.paginationSchema.properties,
        category: {
            type: "string",
            description: "Фильтр по названию категории",
        },
        brand: {
            type: "string",
            description: "Фильтр по названию бренда",
        },
    },
};
/**
 * Схема ответа с карточкой оборудования
 */
exports.equipmentCardSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "Уникальный идентификатор оборудования",
        },
        name: {
            type: "string",
            description: "Название оборудования",
        },
        category: {
            type: "string",
            description: "Категория",
        },
        subcategory: {
            type: ["string", "null"],
            description: "Подкатегория",
        },
        brand: {
            type: ["string", "null"],
            description: "Бренд",
        },
        region: {
            type: ["string", "null"],
            description: "Регион",
        },
        description: {
            type: ["string", "null"],
            description: "Описание",
        },
        price: {
            type: ["number", "null"],
            description: "Цена",
        },
        imageUrl: {
            type: "string",
            description: "Ссылка на изображение оборудования",
        },
        mainParameters: {
            type: "object",
            additionalProperties: {
                type: "string",
            },
            description: "Основные параметры (JSONB)",
        },
        normalizedParameters: {
            type: "object",
            additionalProperties: {
                oneOf: [{ type: "number" }, { type: "string" }],
            },
            description: "Нормализованные параметры (JSONB)",
        },
        createdAt: {
            type: "string",
            format: "date-time",
            description: "Дата создания",
        },
        updatedAt: {
            type: "string",
            format: "date-time",
            description: "Дата обновления",
        },
    },
    required: ["id", "name", "category", "imageUrl", "createdAt", "updatedAt"],
};
/**
 * Схема ответа с пагинированным списком оборудования
 */
exports.paginatedEquipmentListSchema = {
    type: "object",
    properties: {
        items: {
            type: "array",
            items: exports.equipmentCardSchema,
            description: "Список оборудования",
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
//# sourceMappingURL=equipment.schema.js.map