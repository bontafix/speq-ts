"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EquipmentController = void 0;
const api_response_1 = require("../../shared/utils/api-response");
/**
 * Контроллер для обработки HTTP запросов модуля Equipment
 */
class EquipmentController {
    constructor(service) {
        this.service = service;
    }
    /**
     * Получить список оборудования с пагинацией
     */
    async getList(request, reply) {
        const page = request.query.page || 1;
        const limit = request.query.limit || 20;
        const filters = {};
        if (request.query.category) {
            filters.category = request.query.category;
        }
        if (request.query.brand) {
            filters.brand = request.query.brand;
        }
        const result = await this.service.getList(page, limit, filters);
        (0, api_response_1.sendSuccess)(reply, result);
    }
    /**
     * Получить карточку оборудования по ID
     */
    async getById(request, reply) {
        const { id } = request.params;
        const equipment = await this.service.getById(id);
        (0, api_response_1.sendSuccess)(reply, equipment);
    }
}
exports.EquipmentController = EquipmentController;
//# sourceMappingURL=equipment.controller.js.map