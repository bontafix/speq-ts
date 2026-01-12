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
 * Контроллер для обработки HTTP запросов модуля Equipment
 */
export class EquipmentController {
  constructor(private service: EquipmentService) {}

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
