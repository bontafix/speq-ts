import { FastifyPluginAsync } from "fastify";
import { EquipmentService } from "./equipment.service";
import { EquipmentController } from "./equipment.controller";
import {
  getEquipmentByIdParamsSchema,
  equipmentCardSchema,
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
          200: equipmentCardSchema,
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
