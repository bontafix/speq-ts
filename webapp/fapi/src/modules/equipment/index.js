"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.equipmentPlugin = void 0;
const equipment_service_1 = require("./equipment.service");
const equipment_controller_1 = require("./equipment.controller");
const equipment_schema_1 = require("./equipment.schema");
const shared_1 = require("../../core/schemas/shared");
/**
 * Плагин модуля Equipment
 * Регистрирует все роуты и настраивает Swagger документацию
 */
const equipmentPlugin = async (fastify) => {
    // Инициализация сервиса и контроллера
    const service = new equipment_service_1.EquipmentService(fastify);
    const controller = new equipment_controller_1.EquipmentController(service);
    // Регистрация роутов
    // Получить список оборудования с пагинацией
    fastify.get("/equipment", {
        schema: {
            description: "Получить список оборудования с пагинацией. Поддерживает фильтрацию по категории (category) и бренду (brand).",
            tags: ["Equipment"],
            querystring: equipment_schema_1.getEquipmentListQuerySchema,
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: equipment_schema_1.paginatedEquipmentListSchema,
                        timestamp: { type: "string" },
                    },
                    required: ["success", "data", "timestamp"],
                },
                500: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.getList(request, reply);
    });
    // Получить карточку оборудования по ID
    fastify.get("/equipment/:id", {
        schema: {
            description: "Получить карточку оборудования по ID",
            tags: ["Equipment"],
            params: equipment_schema_1.getEquipmentByIdParamsSchema,
            response: {
                200: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: equipment_schema_1.equipmentCardSchema,
                        timestamp: { type: "string" },
                    },
                    required: ["success", "data", "timestamp"],
                },
                404: shared_1.errorResponseSchema,
                500: shared_1.errorResponseSchema,
            },
        },
    }, async (request, reply) => {
        await controller.getById(request, reply);
    });
};
exports.equipmentPlugin = equipmentPlugin;
//# sourceMappingURL=index.js.map