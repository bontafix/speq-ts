/**
 * JSON Schema для валидации запросов и ответов модуля Auth
 */

/**
 * Схема регистрации
 */
export const registerSchema = {
  type: "object",
  properties: {
    username: {
      type: "string",
      description: "Имя пользователя",
    },
    email: {
      type: "string",
      format: "email",
      description: "Email",
    },
    password: {
      type: "string",
      minLength: 6,
      description: "Пароль (минимум 6 символов)",
    },
    name: {
      type: "string",
      description: "Полное имя",
    },
  },
  required: ["password"],
  anyOf: [{ required: ["username"] }, { required: ["email"] }],
} as const;

/**
 * Схема входа
 */
export const loginSchema = {
  type: "object",
  properties: {
    username: {
      type: "string",
      description: "Имя пользователя",
    },
    email: {
      type: "string",
      format: "email",
      description: "Email",
    },
    password: {
      type: "string",
      description: "Пароль",
    },
  },
  required: ["password"],
  anyOf: [{ required: ["username"] }, { required: ["email"] }],
} as const;

/**
 * Схема ответа авторизации
 */
export const authResponseSchema = {
  type: "object",
  properties: {
    token: {
      type: "string",
      description: "JWT токен",
    },
    user: {
      type: "object",
      properties: {
        id: { type: "integer" },
        username: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        name: { type: ["string", "null"] },
        status: { type: ["boolean", "null"] },
        roles: {
          type: "array",
          items: { type: "string" },
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  },
} as const;
