"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtPlugin = void 0;
const jwt_1 = __importDefault(require("@fastify/jwt"));
const config_1 = require("../config");
/**
 * Плагин JWT для Fastify
 * Регистрирует JWT плагин, но не использует его для автоматической верификации
 * Верификация происходит через наш кастомный декоратор authenticate
 */
const jwtPlugin = async (fastify) => {
    await fastify.register(jwt_1.default, {
        secret: config_1.config.jwt.secret,
        sign: {
            expiresIn: config_1.config.jwt.expiresIn,
        },
    });
};
exports.jwtPlugin = jwtPlugin;
//# sourceMappingURL=jwt.js.map