import { FastifyRequest, FastifyReply } from "fastify";
import { BrandService, CreateBrandData, UpdateBrandData } from "./brand.service";
/**
 * Интерфейс параметров пути
 */
interface BrandParams {
    id: string;
}
/**
 * Контроллер управления брендами
 */
export declare class BrandController {
    private service;
    constructor(service: BrandService);
    /**
     * Получить список брендов с пагинацией
     */
    getAll(request: FastifyRequest<{
        Querystring: {
            page?: number;
            limit?: number;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Получить бренд по ID
     */
    getById(request: FastifyRequest<{
        Params: BrandParams;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Создать бренд
     */
    create(request: FastifyRequest<{
        Body: CreateBrandData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Обновить бренд
     */
    update(request: FastifyRequest<{
        Params: BrandParams;
        Body: UpdateBrandData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Удалить бренд
     */
    delete(request: FastifyRequest<{
        Params: BrandParams;
    }>, reply: FastifyReply): Promise<void>;
}
export {};
//# sourceMappingURL=brand.controller.d.ts.map