import { FastifyRequest, FastifyReply } from "fastify";
import { EquipmentService } from "./equipment.service";
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
    brand?: string;
}
/**
 * Контроллер для обработки HTTP запросов модуля Equipment
 */
export declare class EquipmentController {
    private service;
    constructor(service: EquipmentService);
    /**
     * Получить список оборудования с пагинацией
     */
    getList(request: FastifyRequest<{
        Querystring: GetEquipmentListQuery;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Получить карточку оборудования по ID
     */
    getById(request: FastifyRequest<{
        Params: GetEquipmentByIdParams;
    }>, reply: FastifyReply): Promise<void>;
}
export {};
//# sourceMappingURL=equipment.controller.d.ts.map