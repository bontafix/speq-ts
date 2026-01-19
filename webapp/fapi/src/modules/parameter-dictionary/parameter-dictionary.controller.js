"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParameterDictionaryController = void 0;
const api_response_1 = require("../../shared/utils/api-response");
/**
 * Контроллер управления параметрами словаря
 */
class ParameterDictionaryController {
    constructor(service) {
        this.service = service;
    }
    /**
     * Получить все параметры словаря
     */
    async getAll(request, reply) {
        const parameters = await this.service.getAll();
        (0, api_response_1.sendSuccess)(reply, parameters);
    }
    /**
     * Получить параметр словаря по ключу
     */
    async getByKey(request, reply) {
        const { key } = request.params;
        const parameter = await this.service.getByKey(key);
        (0, api_response_1.sendSuccess)(reply, parameter);
    }
    /**
     * Создать параметр словаря
     */
    async create(request, reply) {
        const data = request.body;
        const parameter = await this.service.create(data);
        (0, api_response_1.sendSuccess)(reply, parameter, 201);
    }
    /**
     * Обновить параметр словаря
     */
    async update(request, reply) {
        const { key } = request.params;
        const data = request.body;
        const parameter = await this.service.update(key, data);
        (0, api_response_1.sendSuccess)(reply, parameter);
    }
    /**
     * Удалить параметр словаря
     */
    async delete(request, reply) {
        const { key } = request.params;
        await this.service.delete(key);
        reply.status(204).send();
    }
}
exports.ParameterDictionaryController = ParameterDictionaryController;
//# sourceMappingURL=parameter-dictionary.controller.js.map