/**
 * JSON Schema для валидации запросов и ответов модуля Brands
 */

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
