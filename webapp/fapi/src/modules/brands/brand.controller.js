"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandController = void 0;
const api_response_1 = require("../../shared/utils/api-response");
/**
 * Контроллер управления брендами
 */
class BrandController {
    constructor(service) {
        this.service = service;
    }
    /**
     * Получить список брендов с пагинацией
     */
    async getAll(request, reply) {
        const { page = 1, limit = 20 } = request.query || {};
        const result = await this.service.getAll(page, limit);
        (0, api_response_1.sendSuccess)(reply, result);
    }
    /**
     * Получить бренд по ID
     */
    async getById(request, reply) {
        const { id } = request.params;
        const brandId = parseInt(id, 10);
        if (isNaN(brandId)) {
            throw new Error("Invalid brand ID");
        }
        const brand = await this.service.getById(brandId);
        (0, api_response_1.sendSuccess)(reply, brand);
    }
    /**
     * Создать бренд
     */
    async create(request, reply) {
        const data = request.body;
        const brand = await this.service.create(data);
        (0, api_response_1.sendSuccess)(reply, brand, 201);
    }
    /**
     * Обновить бренд
     */
    async update(request, reply) {
        const { id } = request.params;
        const brandId = parseInt(id, 10);
        if (isNaN(brandId)) {
            throw new Error("Invalid brand ID");
        }
        const data = request.body;
        const brand = await this.service.update(brandId, data);
        (0, api_response_1.sendSuccess)(reply, brand);
    }
    /**
     * Удалить бренд
     */
    async delete(request, reply) {
        const { id } = request.params;
        const brandId = parseInt(id, 10);
        if (isNaN(brandId)) {
            throw new Error("Invalid brand ID");
        }
        await this.service.delete(brandId);
        reply.status(204).send();
    }
}
exports.BrandController = BrandController;
//# sourceMappingURL=brand.controller.js.map