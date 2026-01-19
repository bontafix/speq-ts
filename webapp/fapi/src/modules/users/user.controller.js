"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const api_response_1 = require("../../shared/utils/api-response");
/**
 * Контроллер управления пользователями
 */
class UserController {
    constructor(service) {
        this.service = service;
    }
    /**
     * Получить всех пользователей
     */
    async getAll(request, reply) {
        const users = await this.service.getAll();
        (0, api_response_1.sendSuccess)(reply, users);
    }
    /**
     * Получить пользователя по ID
     */
    async getById(request, reply) {
        const { id } = request.params;
        const userId = parseInt(id, 10);
        if (isNaN(userId)) {
            throw new Error("Invalid user ID");
        }
        const user = await this.service.getById(userId);
        (0, api_response_1.sendSuccess)(reply, user);
    }
    /**
     * Создать пользователя
     */
    async create(request, reply) {
        const data = request.body;
        const user = await this.service.create(data);
        (0, api_response_1.sendSuccess)(reply, user, 201);
    }
    /**
     * Обновить пользователя
     */
    async update(request, reply) {
        const { id } = request.params;
        const userId = parseInt(id, 10);
        if (isNaN(userId)) {
            throw new Error("Invalid user ID");
        }
        const data = request.body;
        const user = await this.service.update(userId, data);
        (0, api_response_1.sendSuccess)(reply, user);
    }
    /**
     * Удалить пользователя
     */
    async delete(request, reply) {
        const { id } = request.params;
        const userId = parseInt(id, 10);
        if (isNaN(userId)) {
            throw new Error("Invalid user ID");
        }
        await this.service.delete(userId);
        reply.status(204).send();
    }
    /**
     * Назначить роль пользователю
     */
    async assignRole(request, reply) {
        const { id } = request.params;
        const userId = parseInt(id, 10);
        if (isNaN(userId)) {
            throw new Error("Invalid user ID");
        }
        const { roleId } = request.body;
        await this.service.assignRole(userId, roleId);
        reply.status(204).send();
    }
    /**
     * Удалить роль у пользователя
     */
    async removeRole(request, reply) {
        const { id, roleId } = request.params;
        const userId = parseInt(id, 10);
        const roleIdNum = parseInt(roleId, 10);
        if (isNaN(userId) || isNaN(roleIdNum)) {
            throw new Error("Invalid user ID or role ID");
        }
        await this.service.removeRole(userId, roleIdNum);
        reply.status(204).send();
    }
}
exports.UserController = UserController;
//# sourceMappingURL=user.controller.js.map