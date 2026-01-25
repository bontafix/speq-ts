/**
 * JSON Schema для валидации запросов и ответов модуля Parameter Dictionary
 */

/**
 * Схема параметра словаря
 */
export const parameterDictionarySchema = {
  type: "object",
  properties: {
    key: { type: "string" },
    labelRu: { type: "string" },
    labelEn: { type: ["string", "null"] },
    descriptionRu: { type: ["string", "null"] },
    category: { type: "string" },
    paramType: { type: "string" },
    unit: { type: ["string", "null"] },
    // numeric из Postgres может приходить строкой, поэтому разрешаем string
    minValue: { type: ["number", "string", "null"] },
    maxValue: { type: ["number", "string", "null"] },
    enumValues: { type: ["array", "null"], items: { type: "string" } },
    aliases: { type: ["array", "null"], items: { type: "string" } },
    sqlExpression: { type: "string" },
    isSearchable: { type: ["boolean", "null"] },
    isFilterable: { type: ["boolean", "null"] },
    priority: { type: ["integer", "null"] },
    version: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["key", "labelRu", "category", "paramType", "sqlExpression"],
} as const;

/**
 * Схема создания параметра словаря
 */
export const createParameterDictionarySchema = {
  type: "object",
  properties: {
    key: { type: "string" },
    labelRu: { type: "string" },
    labelEn: { type: "string" },
    descriptionRu: { type: "string" },
    category: { type: "string" },
    paramType: { type: "string" },
    unit: { type: "string" },
    minValue: { type: "number" },
    maxValue: { type: "number" },
    enumValues: { type: "array", items: { type: "string" } },
    aliases: { type: "array", items: { type: "string" } },
    sqlExpression: { type: "string" },
    isSearchable: { type: "boolean" },
    isFilterable: { type: "boolean" },
    priority: { type: "integer" },
    version: { type: "string" },
  },
  required: ["key", "labelRu", "category", "paramType", "sqlExpression"],
} as const;

/**
 * Схема обновления параметра словаря
 */
export const updateParameterDictionarySchema = {
  type: "object",
  properties: {
    labelRu: { type: "string" },
    labelEn: { type: "string" },
    descriptionRu: { type: "string" },
    category: { type: "string" },
    paramType: { type: "string" },
    unit: { type: "string" },
    minValue: { type: "number" },
    maxValue: { type: "number" },
    enumValues: { type: "array", items: { type: "string" } },
    aliases: { type: "array", items: { type: "string" } },
    sqlExpression: { type: "string" },
    isSearchable: { type: "boolean" },
    isFilterable: { type: "boolean" },
    priority: { type: "integer" },
    version: { type: "string" },
  },
} as const;
