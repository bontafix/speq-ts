"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const api_response_1 = require("../../shared/utils/api-response");
/**
 * Контроллер авторизации
 */
class AuthController {
    constructor(service) {
        this.service = service;
    }
    /**
     * Регистрация пользователя
     */
    async register(request, reply) {
        const data = request.body;
        const result = await this.service.register(data);
        (0, api_response_1.sendSuccess)(reply, result, 201);
    }
    /**
     * Вход пользователя
     */
    async login(request, reply) {
        const data = request.body;
        const result = await this.service.login(data);
        (0, api_response_1.sendSuccess)(reply, result);
    }
    /**
     * Получить текущего пользователя
     */
    async me(request, reply) {
        if (!request.user || typeof request.user === "string" || Buffer.isBuffer(request.user)) {
            throw new Error("User not authenticated");
        }
        // TypeScript guard: проверяем что user имеет нужную структуру
        const authenticatedUser = request.user;
        const user = await this.service.getUserById(authenticatedUser.userId);
        (0, api_response_1.sendSuccess)(reply, user);
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map