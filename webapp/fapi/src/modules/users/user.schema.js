"use strict";
/**
 * JSON Schema для валидации запросов и ответов модуля Users
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignRoleSchema = exports.updateUserSchema = exports.createUserSchema = exports.userSchema = void 0;
/**
 * Схема пользователя
 */
exports.userSchema = {
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
};
/**
 * Схема создания пользователя
 */
exports.createUserSchema = {
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
};
/**
 * Схема обновления пользователя
 */
exports.updateUserSchema = {
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
};
/**
 * Схема назначения роли
 */
exports.assignRoleSchema = {
    type: "object",
    properties: {
        roleId: { type: "integer" },
    },
    required: ["roleId"],
};
//# sourceMappingURL=user.schema.js.map