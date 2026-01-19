import { FastifyInstance } from "fastify";
/**
 * Интерфейс бренда для API
 */
export interface Brand {
    id: number;
    name: string;
    isActive: boolean | null;
    createdAt: string;
    updatedAt: string;
}
/**
 * Интерфейс данных создания бренда
 */
export interface CreateBrandData {
    name: string;
    isActive?: boolean;
}
/**
 * Интерфейс данных обновления бренда
 */
export interface UpdateBrandData {
    name?: string;
    isActive?: boolean;
}
/**
 * Результат пагинации брендов
 */
export interface PaginatedBrandResult {
    items: Brand[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
/**
 * Сервис управления брендами
 */
export declare class BrandService {
    private fastify;
    constructor(fastify: FastifyInstance);
    /**
     * Получить список брендов с пагинацией
     */
    getAll(page?: number, limit?: number): Promise<PaginatedBrandResult>;
    /**
     * Получить бренд по ID
     */
    getById(brandId: number): Promise<Brand>;
    /**
     * Создать бренд
     */
    create(data: CreateBrandData): Promise<Brand>;
    /**
     * Обновить бренд
     */
    update(brandId: number, data: UpdateBrandData): Promise<Brand>;
    /**
     * Удалить бренд
     */
    delete(brandId: number): Promise<void>;
}
//# sourceMappingURL=brand.service.d.ts.map