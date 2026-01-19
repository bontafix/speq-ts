import { FastifyRequest, FastifyReply } from "fastify";
import { CategoryService, CreateCategoryData, UpdateCategoryData } from "./category.service";
/**
 * Интерфейс параметров пути
 */
interface CategoryParams {
    id: string;
}
/**
 * Контроллер управления категориями
 */
export declare class CategoryController {
    private service;
    constructor(service: CategoryService);
    /**
     * Получить список категорий с пагинацией
     */
    getAll(request: FastifyRequest<{
        Querystring: {
            page?: number;
            limit?: number;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Получить категорию по ID
     */
    getById(request: FastifyRequest<{
        Params: CategoryParams;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Создать категорию
     */
    create(request: FastifyRequest<{
        Body: CreateCategoryData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Обновить категорию
     */
    update(request: FastifyRequest<{
        Params: CategoryParams;
        Body: UpdateCategoryData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Удалить категорию
     */
    delete(request: FastifyRequest<{
        Params: CategoryParams;
    }>, reply: FastifyReply): Promise<void>;
}
export {};
//# sourceMappingURL=category.controller.d.ts.map