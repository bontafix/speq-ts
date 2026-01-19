import { FastifyRequest, FastifyReply } from "fastify";
import { EquipmentService, EquipmentCard } from "./equipment.service";
import { sendSuccess } from "../../shared/utils/api-response";

/**
 * Интерфейс параметров запроса
 */
interface GetEquipmentByIdParams {
  id: string;
}

/**
 * Интерфейс query параметров для списка
 */
interface GetEquipmentListQuery {
  page?: number;
  limit?: number;
  category?: string;
}

/**
 * Контроллер для обработки HTTP запросов модуля Equipment
 */
export class EquipmentController {
  constructor(private service: EquipmentService) {}

  /**
   * Получить список оборудования с пагинацией
   */
  async getList(
    request: FastifyRequest<{ Querystring: GetEquipmentListQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const page = request.query.page || 1;
    const limit = request.query.limit || 20;
    const filters: { category?: string } = {};
    if (request.query.category) {
      filters.category = request.query.category;
    }
    const result = await this.service.getList(page, limit, filters);
    sendSuccess(reply, result);
  }

  /**
   * Получить карточку оборудования по ID
   */
  async getById(
    request: FastifyRequest<{ Params: GetEquipmentByIdParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const equipment = await this.service.getById(id);
    sendSuccess<EquipmentCard>(reply, equipment);
  }
}
