/**
 * JSON Schema для валидации запросов и ответов модуля Users
 */

export const userSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    username: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    name: { type: ["string", "null"] },
    status: { type: ["boolean", "null"] },
    limit_document: { type: ["number", "null"] },
    limit_size_pdf: { type: ["number", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

export const userWithRolesSchema = {
  type: "object",
  properties: {
    ...userSchema.properties,
    roles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
          title: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export const createUserSchema = {
  type: "object",
  properties: {
    username: { type: "string", minLength: 3 },
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 6 },
    name: { type: "string" },
    status: { type: "boolean" },
    limit_document: { type: "number" },
    limit_size_pdf: { type: "number" },
  },
  required: ["username", "email", "password"],
} as const;

export const updateUserSchema = {
  type: "object",
  properties: {
    username: { type: "string", minLength: 3 },
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 6 },
    name: { type: "string" },
    status: { type: "boolean" },
    limit_document: { type: "number" },
    limit_size_pdf: { type: "number" },
  },
} as const;

export const assignRoleSchema = {
  type: "object",
  properties: {
    roleId: { type: "number" },
  },
  required: ["roleId"],
} as const;
