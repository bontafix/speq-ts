"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryController = void 0;
const api_response_1 = require("../../shared/utils/api-response");
/**
 * Контроллер управления категориями
 */
class CategoryController {
    constructor(service) {
        this.service = service;
    }
    /**
     * Получить список категорий с пагинацией
     */
    async getAll(request, reply) {
        const { page = 1, limit = 20 } = request.query || {};
        const result = await this.service.getAll(page, limit);
        (0, api_response_1.sendSuccess)(reply, result);
    }
    /**
     * Получить категорию по ID
     */
    async getById(request, reply) {
        const { id } = request.params;
        const categoryId = parseInt(id, 10);
        if (isNaN(categoryId)) {
            throw new Error("Invalid category ID");
        }
        const category = await this.service.getById(categoryId);
        (0, api_response_1.sendSuccess)(reply, category);
    }
    /**
     * Создать категорию
     */
    async create(request, reply) {
        const data = request.body;
        const category = await this.service.create(data);
        (0, api_response_1.sendSuccess)(reply, category, 201);
    }
    /**
     * Обновить категорию
     */
    async update(request, reply) {
        const { id } = request.params;
        const categoryId = parseInt(id, 10);
        if (isNaN(categoryId)) {
            throw new Error("Invalid category ID");
        }
        const data = request.body;
        const category = await this.service.update(categoryId, data);
        (0, api_response_1.sendSuccess)(reply, category);
    }
    /**
     * Удалить категорию
     */
    async delete(request, reply) {
        const { id } = request.params;
        const categoryId = parseInt(id, 10);
        if (isNaN(categoryId)) {
            throw new Error("Invalid category ID");
        }
        await this.service.delete(categoryId);
        reply.status(204).send();
    }
}
exports.CategoryController = CategoryController;
//# sourceMappingURL=category.controller.js.map