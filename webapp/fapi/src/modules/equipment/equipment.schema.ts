/**
 * JSON Schema для валидации запросов и ответов модуля Equipment
 */

/**
 * Схема параметров пути для получения оборудования по ID
 */
export const getEquipmentByIdParamsSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "ID оборудования",
    },
  },
  required: ["id"],
} as const;

/**
 * Схема ответа с карточкой оборудования
 */
export const equipmentCardSchema = {
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
  required: ["id", "name", "category", "createdAt", "updatedAt"],
} as const;
