/**
 * JSON Schema для валидации запросов и ответов модуля Brands
 */

import { paginationSchema } from "../../core/schemas/shared";

/**
 * Схема бренда
 */
export const brandSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    isActive: { type: ["boolean", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

/**
 * Схема query параметров для получения списка брендов
 */
export const getBrandListQuerySchema = {
  ...paginationSchema,
} as const;

/**
 * Схема ответа с пагинированным списком брендов
 */
export const paginatedBrandListSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: brandSchema,
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
} as const;

/**
 * Схема создания бренда
 */
export const createBrandSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    isActive: { type: "boolean" },
  },
  required: ["name"],
} as const;

/**
 * Схема обновления бренда
 */
export const updateBrandSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    isActive: { type: "boolean" },
  },
} as const;
