"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandService = void 0;
const app_error_1 = require("../../core/errors/app-error");
/**
 * Сервис управления брендами
 */
class BrandService {
    constructor(fastify) {
        this.fastify = fastify;
    }
    /**
     * Получить список брендов с пагинацией
     */
    async getAll(page = 1, limit = 20) {
        const safePage = page > 0 ? page : 1;
        const safeLimit = limit > 0 ? limit : 20;
        const offset = (safePage - 1) * safeLimit;
        // Общее количество брендов
        const countResult = await this.fastify.db.query(`
        SELECT COUNT(*)::text AS count
        FROM brands
      `);
        const total = parseInt(countResult.rows[0]?.count || "0", 10);
        // Данные текущей страницы
        const result = await this.fastify.db.query(`
        SELECT id, name, is_active, created_at, updated_at
        FROM brands
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
     * Получить бренд по ID
     */
    async getById(brandId) {
        const result = await this.fastify.db.query(`
        SELECT id, name, is_active, created_at, updated_at
        FROM brands
        WHERE id = $1
      `, [brandId]);
        if (result.rows.length === 0) {
            throw new app_error_1.NotFoundError("Brand not found");
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
            isActive: row.is_active,
            createdAt,
            updatedAt,
        };
    }
    /**
     * Создать бренд
     */
    async create(data) {
        if (!data.name || data.name.trim().length === 0) {
            throw new app_error_1.ValidationError("Name is required");
        }
        // Проверка существования
        const existing = await this.fastify.db.query(`SELECT id FROM brands WHERE name = $1`, [data.name]);
        if (existing.rows.length > 0) {
            throw new app_error_1.ValidationError("Brand with this name already exists");
        }
        const result = await this.fastify.db.query(`
        INSERT INTO brands (name, is_active)
        VALUES ($1, $2)
        RETURNING id, name, is_active, created_at, updated_at
      `, [
            data.name,
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
            isActive: row.is_active,
            createdAt,
            updatedAt,
        };
    }
    /**
     * Обновить бренд
     */
    async update(brandId, data) {
        // Проверка существования
        await this.getById(brandId);
        // Проверка уникальности имени, если оно меняется
        if (data.name !== undefined) {
            if (data.name.trim().length === 0) {
                throw new app_error_1.ValidationError("Name cannot be empty");
            }
            const existing = await this.fastify.db.query(`SELECT id FROM brands WHERE name = $1`, [data.name]);
            if (existing.rows.length > 0 && existing.rows[0].id !== brandId) {
                throw new app_error_1.ValidationError("Brand with this name already exists");
            }
        }
        // Подготовка данных для обновления
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(data.isActive);
        }
        if (updates.length === 0) {
            return this.getById(brandId);
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(brandId);
        const result = await this.fastify.db.query(`
        UPDATE brands
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, name, is_active, created_at, updated_at
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
            isActive: row.is_active,
            createdAt,
            updatedAt,
        };
    }
    /**
     * Удалить бренд
     */
    async delete(brandId) {
        await this.getById(brandId);
        await this.fastify.db.query(`
        DELETE FROM brands
        WHERE id = $1
      `, [brandId]);
    }
}
exports.BrandService = BrandService;
//# sourceMappingURL=brand.service.js.map