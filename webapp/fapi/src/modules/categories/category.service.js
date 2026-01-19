"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const app_error_1 = require("../../core/errors/app-error");
/**
 * Сервис управления категориями
 */
class CategoryService {
    constructor(fastify) {
        this.fastify = fastify;
    }
    /**
     * Получить список категорий с пагинацией
     */
    async getAll(page = 1, limit = 20) {
        const safePage = page > 0 ? page : 1;
        const safeLimit = limit > 0 ? limit : 20;
        const offset = (safePage - 1) * safeLimit;
        // Общее количество категорий
        const countResult = await this.fastify.db.query(`
        SELECT COUNT(*)::text AS count
        FROM categories
      `);
        const total = parseInt(countResult.rows[0]?.count || "0", 10);
        // Данные текущей страницы
        const result = await this.fastify.db.query(`
        SELECT id, name, parent_id, is_active, created_at, updated_at
        FROM categories
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [safeLimit, offset]);
        const items = result.rows.map((row) => {
            const createdAt = row.created_at instanceof Date
                ? row.created_at.toISOString()
                : new Date(row.created_at).toISOString();
            const updatedAt = row.updated_at instanceof Date
                ? row.updated_at.toISOString()
                : new Date(row.updated_at).toISOString();
            return {
                id: row.id,
                name: row.name,
                parentId: row.parent_id,
                isActive: row.is_active,
                createdAt,
                updatedAt,
            };
        });
        const totalPages = Math.ceil(total / safeLimit) || 1;
        return {
            items,
            total,
            page: safePage,
            limit: safeLimit,
            totalPages,
        };
    }
    /**
     * Получить категорию по ID
     */
    async getById(categoryId) {
        const result = await this.fastify.db.query(`
        SELECT id, name, parent_id, is_active, created_at, updated_at
        FROM categories
        WHERE id = $1
      `, [categoryId]);
        if (result.rows.length === 0) {
            throw new app_error_1.NotFoundError("Category not found");
        }
        const row = result.rows[0];
        const createdAt = row.created_at instanceof Date
            ? row.created_at.toISOString()
            : new Date(row.created_at).toISOString();
        const updatedAt = row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : new Date(row.updated_at).toISOString();
        return {
            id: row.id,
            name: row.name,
            parentId: row.parent_id,
            isActive: row.is_active,
            createdAt,
            updatedAt,
        };
    }
    /**
     * Создать категорию
     */
    async create(data) {
        if (!data.name || data.name.trim().length === 0) {
            throw new app_error_1.ValidationError("Name is required");
        }
        // Проверка существования родительской категории, если указана
        if (data.parentId !== null && data.parentId !== undefined) {
            const parentResult = await this.fastify.db.query(`SELECT id FROM categories WHERE id = $1`, [data.parentId]);
            if (parentResult.rows.length === 0) {
                throw new app_error_1.ValidationError("Parent category not found");
            }
        }
        const result = await this.fastify.db.query(`
        INSERT INTO categories (name, parent_id, is_active)
        VALUES ($1, $2, $3)
        RETURNING id, name, parent_id, is_active, created_at, updated_at
      `, [
            data.name,
            data.parentId ?? null,
            data.isActive ?? true,
        ]);
        const row = result.rows[0];
        const createdAt = row.created_at instanceof Date
            ? row.created_at.toISOString()
            : new Date(row.created_at).toISOString();
        const updatedAt = row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : new Date(row.updated_at).toISOString();
        return {
            id: row.id,
            name: row.name,
            parentId: row.parent_id,
            isActive: row.is_active,
            createdAt,
            updatedAt,
        };
    }
    /**
     * Обновить категорию
     */
    async update(categoryId, data) {
        // Проверка существования
        await this.getById(categoryId);
        // Проверка существования родительской категории, если указана
        if (data.parentId !== null && data.parentId !== undefined) {
            if (data.parentId === categoryId) {
                throw new app_error_1.ValidationError("Category cannot be its own parent");
            }
            const parentResult = await this.fastify.db.query(`SELECT id FROM categories WHERE id = $1`, [data.parentId]);
            if (parentResult.rows.length === 0) {
                throw new app_error_1.ValidationError("Parent category not found");
            }
        }
        // Подготовка данных для обновления
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (data.name !== undefined) {
            if (data.name.trim().length === 0) {
                throw new app_error_1.ValidationError("Name cannot be empty");
            }
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.parentId !== undefined) {
            updates.push(`parent_id = $${paramIndex++}`);
            values.push(data.parentId);
        }
        if (data.isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(data.isActive);
        }
        if (updates.length === 0) {
            return this.getById(categoryId);
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(categoryId);
        const result = await this.fastify.db.query(`
        UPDATE categories
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, name, parent_id, is_active, created_at, updated_at
      `, values);
        const row = result.rows[0];
        const createdAt = row.created_at instanceof Date
            ? row.created_at.toISOString()
            : new Date(row.created_at).toISOString();
        const updatedAt = row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : new Date(row.updated_at).toISOString();
        return {
            id: row.id,
            name: row.name,
            parentId: row.parent_id,
            isActive: row.is_active,
            createdAt,
            updatedAt,
        };
    }
    /**
     * Удалить категорию
     */
    async delete(categoryId) {
        await this.getById(categoryId);
        await this.fastify.db.query(`
        DELETE FROM categories
        WHERE id = $1
      `, [categoryId]);
    }
}
exports.CategoryService = CategoryService;
//# sourceMappingURL=category.service.js.map