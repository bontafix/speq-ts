/**
 * JSON Schema для валидации запросов и ответов модуля Categories
 */

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
