import { FastifyPluginAsync } from "fastify";
import { EquipmentService } from "./equipment.service";
import { EquipmentController } from "./equipment.controller";
import {
  getEquipmentByIdParamsSchema,
  getEquipmentListQuerySchema,
  equipmentCardSchema,
  paginatedEquipmentListSchema,
} from "./equipment.schema";
import { errorResponseSchema } from "../../core/schemas/shared";

/**
 * Плагин модуля Equipment
 * Регистрирует все роуты и настраивает Swagger документацию
 */
export const equipmentPlugin: FastifyPluginAsync = async (fastify) => {
  // Инициализация сервиса и контроллера
  const service = new EquipmentService(fastify);
  const controller = new EquipmentController(service);

  // Регистрация роутов
  // Получить список оборудования с пагинацией
  fastify.get<{
    Querystring: { page?: number; limit?: number };
  }>(
    "/equipment",
    {
      schema: {
        description: "Получить список оборудования с пагинацией",
        tags: ["Equipment"],
        querystring: getEquipmentListQuerySchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: paginatedEquipmentListSchema,
              timestamp: { type: "string" },
            },
            required: ["success", "data", "timestamp"],
          },
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.getList(request, reply);
    },
  );

  // Получить карточку оборудования по ID
  fastify.get<{
    Params: { id: string };
  }>(
    "/equipment/:id",
    {
      schema: {
        description: "Получить карточку оборудования по ID",
        tags: ["Equipment"],
        params: getEquipmentByIdParamsSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: equipmentCardSchema,
              timestamp: { type: "string" },
            },
            required: ["success", "data", "timestamp"],
          },
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.getById(request, reply);
    },
  );
};
