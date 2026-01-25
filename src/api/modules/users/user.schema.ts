/**
 * JSON Schema для валидации запросов и ответов модуля Users
 */

/**
 * Схема пользователя
 */
export const userSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    username: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    name: { type: ["string", "null"] },
    status: { type: ["boolean", "null"] },
    limitDocument: { type: ["integer", "null"] },
    limitSizePdf: { type: ["integer", "null"] },
    roles: {
      type: "array",
      items: { type: "string" },
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

/**
 * Схема создания пользователя
 */
export const createUserSchema = {
  type: "object",
  properties: {
    username: { type: "string" },
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 6 },
    name: { type: "string" },
    status: { type: "boolean" },
    limitDocument: { type: "integer" },
    limitSizePdf: { type: "integer" },
  },
  required: ["password"],
  anyOf: [{ required: ["username"] }, { required: ["email"] }],
} as const;

/**
 * Схема обновления пользователя
 */
export const updateUserSchema = {
  type: "object",
  properties: {
    username: { type: "string" },
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 6 },
    name: { type: "string" },
    status: { type: "boolean" },
    limitDocument: { type: "integer" },
    limitSizePdf: { type: "integer" },
  },
} as const;

/**
 * Схема назначения роли
 */
export const assignRoleSchema = {
  type: "object",
  properties: {
    roleId: { type: "integer" },
  },
  required: ["roleId"],
} as const;
