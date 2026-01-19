import { FastifyInstance } from "fastify";
/**
 * Интерфейс категории для API
 */
export interface Category {
    id: number;
    name: string;
    parentId: number | null;
    isActive: boolean | null;
    createdAt: string;
    updatedAt: string;
}
/**
 * Интерфейс данных создания категории
 */
export interface CreateCategoryData {
    name: string;
    parentId?: number | null;
    isActive?: boolean;
}
/**
 * Интерфейс данных обновления категории
 */
export interface UpdateCategoryData {
    name?: string;
    parentId?: number | null;
    isActive?: boolean;
}
/**
 * Результат пагинации категорий
 */
export interface PaginatedCategoryResult {
    items: Category[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
/**
 * Сервис управления категориями
 */
export declare class CategoryService {
    private fastify;
    constructor(fastify: FastifyInstance);
    /**
     * Получить список категорий с пагинацией
     */
    getAll(page?: number, limit?: number): Promise<PaginatedCategoryResult>;
    /**
     * Получить категорию по ID
     */
    getById(categoryId: number): Promise<Category>;
    /**
     * Создать категорию
     */
    create(data: CreateCategoryData): Promise<Category>;
    /**
     * Обновить категорию
     */
    update(categoryId: number, data: UpdateCategoryData): Promise<Category>;
    /**
     * Удалить категорию
     */
    delete(categoryId: number): Promise<void>;
}
//# sourceMappingURL=category.service.d.ts.map