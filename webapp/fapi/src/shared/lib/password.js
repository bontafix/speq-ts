"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10;
/**
 * Хеширование пароля
 */
async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}
/**
 * Проверка пароля
 */
async function comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
}
//# sourceMappingURL=password.js.map