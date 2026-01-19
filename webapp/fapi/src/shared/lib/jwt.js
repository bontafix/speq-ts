"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createToken = createToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../core/config");
/**
 * Создание JWT токена
 */
function createToken(payload) {
    const options = {
        expiresIn: config_1.config.jwt.expiresIn,
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, options);
}
/**
 * Верификация JWT токена
 */
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
    }
    catch (error) {
        throw new Error("Invalid token");
    }
}
//# sourceMappingURL=jwt.js.map