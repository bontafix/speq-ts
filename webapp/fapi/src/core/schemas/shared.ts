/**
 * Общие JSON Schema определения для валидации
 */

/**
 * Схема для пагинации
 */
export const paginationSchema = {
  type: "object",
  properties: {
    page: {
      type: "integer",
      minimum: 1,
      default: 1,
      description: "Номер страницы",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Количество элементов на странице",
    },
  },
} as const;

/**
 * Схема стандартного ответа с ошибкой
 */
export const errorResponseSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: { type: "object" },
      },
      required: ["code", "message"],
    },
  },
  required: ["error"],
} as const;
