/**
 * JSON Schema для валидации запросов и ответов модуля Categories
 */

import { paginationSchema } from "../../core/schemas/shared";

/**
 * Схема категории
 */
export const categorySchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    parentId: { type: ["integer", "null"] },
    isActive: { type: ["boolean", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

/**
 * Схема query параметров для получения списка категорий
 */
export const getCategoryListQuerySchema = {
  ...paginationSchema,
} as const;

/**
 * Схема ответа с пагинированным списком категорий
 */
export const paginatedCategoryListSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: categorySchema,
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
} as const;

/**
 * Схема создания категории
 */
export const createCategorySchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    parentId: { type: ["integer", "null"] },
    isActive: { type: "boolean" },
  },
  required: ["name"],
} as const;

/**
 * Схема обновления категории
 */
export const updateCategorySchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    parentId: { type: ["integer", "null"] },
    isActive: { type: "boolean" },
  },
} as const;
