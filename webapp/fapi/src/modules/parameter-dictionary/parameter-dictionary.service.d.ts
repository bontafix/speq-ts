import { FastifyInstance } from "fastify";
/**
 * Интерфейс параметра словаря для API
 */
export interface ParameterDictionary {
    key: string;
    labelRu: string;
    labelEn: string | null;
    descriptionRu: string | null;
    category: string;
    paramType: string;
    unit: string | null;
    minValue: number | null;
    maxValue: number | null;
    enumValues: string[] | null;
    aliases: string[] | null;
    sqlExpression: string;
    isSearchable: boolean | null;
    isFilterable: boolean | null;
    priority: number | null;
    version: string | null;
    createdAt: string;
    updatedAt: string;
}
/**
 * Интерфейс данных создания параметра словаря
 */
export interface CreateParameterDictionaryData {
    key: string;
    labelRu: string;
    labelEn?: string | null;
    descriptionRu?: string | null;
    category: string;
    paramType: string;
    unit?: string | null;
    minValue?: number | null;
    maxValue?: number | null;
    enumValues?: string[] | null;
    aliases?: string[] | null;
    sqlExpression: string;
    isSearchable?: boolean;
    isFilterable?: boolean;
    priority?: number;
    version?: string;
}
/**
 * Интерфейс данных обновления параметра словаря
 */
export interface UpdateParameterDictionaryData {
    labelRu?: string;
    labelEn?: string | null;
    descriptionRu?: string | null;
    category?: string;
    paramType?: string;
    unit?: string | null;
    minValue?: number | null;
    maxValue?: number | null;
    enumValues?: string[] | null;
    aliases?: string[] | null;
    sqlExpression?: string;
    isSearchable?: boolean;
    isFilterable?: boolean;
    priority?: number;
    version?: string;
}
/**
 * Сервис управления параметрами словаря
 */
export declare class ParameterDictionaryService {
    private fastify;
    constructor(fastify: FastifyInstance);
    /**
     * Получить все параметры словаря
     */
    getAll(): Promise<ParameterDictionary[]>;
    /**
     * Получить параметр словаря по ключу
     */
    getByKey(key: string): Promise<ParameterDictionary>;
    /**
     * Создать параметр словаря
     */
    create(data: CreateParameterDictionaryData): Promise<ParameterDictionary>;
    /**
     * Обновить параметр словаря
     */
    update(key: string, data: UpdateParameterDictionaryData): Promise<ParameterDictionary>;
    /**
     * Удалить параметр словаря
     */
    delete(key: string): Promise<void>;
}
//# sourceMappingURL=parameter-dictionary.service.d.ts.map