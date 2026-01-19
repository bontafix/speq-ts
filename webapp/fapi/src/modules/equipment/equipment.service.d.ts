import { FastifyInstance } from "fastify";
/**
 * Интерфейс карточки оборудования для API
 */
export interface EquipmentCard {
    id: string;
    name: string;
    category: string;
    subcategory: string | null;
    brand: string | null;
    region: string | null;
    description: string | null;
    price: number | null;
    imageUrl: string;
    mainParameters: Record<string, any>;
    normalizedParameters: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}
/**
 * Интерфейс результата пагинации
 */
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
/**
 * Интерфейс фильтров для списка оборудования
 */
export interface EquipmentFilters {
    category?: string;
    brand?: string;
}
/**
 * Сервис для работы с оборудованием
 */
export declare class EquipmentService {
    private fastify;
    constructor(fastify: FastifyInstance);
    /**
     * Получить карточку оборудования по ID
     */
    getById(id: string): Promise<EquipmentCard>;
    /**
     * Получить список оборудования с пагинацией
     */
    getList(page?: number, limit?: number, filters?: EquipmentFilters): Promise<PaginatedResult<EquipmentCard>>;
}
//# sourceMappingURL=equipment.service.d.ts.map