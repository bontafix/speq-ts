import { FastifyRequest, FastifyReply } from "fastify";
import { ParameterDictionaryService, CreateParameterDictionaryData, UpdateParameterDictionaryData } from "./parameter-dictionary.service";
/**
 * Интерфейс параметров пути
 */
interface ParameterDictionaryParams {
    key: string;
}
/**
 * Контроллер управления параметрами словаря
 */
export declare class ParameterDictionaryController {
    private service;
    constructor(service: ParameterDictionaryService);
    /**
     * Получить все параметры словаря
     */
    getAll(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    /**
     * Получить параметр словаря по ключу
     */
    getByKey(request: FastifyRequest<{
        Params: ParameterDictionaryParams;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Создать параметр словаря
     */
    create(request: FastifyRequest<{
        Body: CreateParameterDictionaryData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Обновить параметр словаря
     */
    update(request: FastifyRequest<{
        Params: ParameterDictionaryParams;
        Body: UpdateParameterDictionaryData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Удалить параметр словаря
     */
    delete(request: FastifyRequest<{
        Params: ParameterDictionaryParams;
    }>, reply: FastifyReply): Promise<void>;
}
export {};
//# sourceMappingURL=parameter-dictionary.controller.d.ts.map