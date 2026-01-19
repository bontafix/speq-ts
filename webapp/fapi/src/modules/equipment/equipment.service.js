"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EquipmentService = void 0;
const app_error_1 = require("../../core/errors/app-error");
/**
 * Сервис для работы с оборудованием
 */
class EquipmentService {
    constructor(fastify) {
        this.fastify = fastify;
    }
    /**
     * Получить карточку оборудования по ID
     */
    async getById(id) {
        const result = await this.fastify.db.query(`
        SELECT
          e.id::text AS id,
          e.name,
          e.category,
          e.subcategory,
          e.brand,
          e.region,
          e.description,
          e.price,
          e.main_parameters AS main_parameters,
          e.normalized_parameters AS normalized_parameters,
          e.created_at,
          e.updated_at
        FROM equipment e
        LEFT JOIN brands b ON e.brand = b.name AND b.is_active = true
        WHERE e.is_active = true
          AND e.id::text = $1
        LIMIT 1
      `, [id]);
        if (result.rows.length === 0 || !result.rows[0]) {
            throw new app_error_1.NotFoundError("Equipment not found");
        }
        const equipment = result.rows[0];
        // Безопасное преобразование цены
        const rawPrice = equipment.price;
        let price;
        if (rawPrice === null || rawPrice === undefined) {
            price = null;
        }
        else if (typeof rawPrice === "number") {
            price = rawPrice;
        }
        else {
            const parsed = Number(rawPrice);
            price = Number.isNaN(parsed) ? null : parsed;
        }
        // Безопасное преобразование дат
        const createdAt = equipment.created_at instanceof Date
            ? equipment.created_at.toISOString()
            : new Date(equipment.created_at).toISOString();
        const updatedAt = equipment.updated_at instanceof Date
            ? equipment.updated_at.toISOString()
            : new Date(equipment.updated_at).toISOString();
        return {
            id: equipment.id,
            name: equipment.name,
            category: equipment.category,
            subcategory: equipment.subcategory,
            brand: equipment.brand,
            region: equipment.region,
            description: equipment.description,
            price,
            imageUrl: `speq-images/${equipment.id}/200`,
            mainParameters: equipment.main_parameters || {},
            normalizedParameters: equipment.normalized_parameters || {},
            createdAt,
            updatedAt,
        };
    }
    /**
     * Получить список оборудования с пагинацией
     */
    async getList(page = 1, limit = 20, filters = {}) {
        const offset = (page - 1) * limit;
        // Формируем условия WHERE для фильтров
        const whereConditions = ["e.is_active = true"];
        const queryParams = [];
        let paramIndex = 1;
        // Фильтр по категории
        if (filters.category) {
            whereConditions.push(`e.category = $${paramIndex}`);
            queryParams.push(filters.category);
            paramIndex++;
        }
        // Фильтр по бренду
        if (filters.brand) {
            whereConditions.push(`e.brand = $${paramIndex}`);
            queryParams.push(filters.brand);
            paramIndex++;
        }
        const whereClause = whereConditions.join(" AND ");
        // Получаем общее количество записей
        const countResult = await this.fastify.db.query(`
        SELECT COUNT(*)::text AS count
        FROM equipment e
        LEFT JOIN brands b ON e.brand = b.name AND b.is_active = true
        WHERE ${whereClause}
      `, queryParams);
        const total = parseInt(countResult.rows[0]?.count || "0", 10);
        // Получаем данные с пагинацией
        const dataQueryParams = [...queryParams, limit, offset];
        const result = await this.fastify.db.query(`
        SELECT
          e.id::text AS id,
          e.name,
          e.category,
          e.subcategory,
          e.brand,
          e.region,
          e.description,
          e.price,
          e.main_parameters AS main_parameters,
          e.normalized_parameters AS normalized_parameters,
          e.created_at,
          e.updated_at
        FROM equipment e
        LEFT JOIN brands b ON e.brand = b.name AND b.is_active = true
        WHERE ${whereClause}
        ORDER BY e.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, dataQueryParams);
        const items = result.rows.map((equipment) => {
            // Безопасное преобразование дат
            const createdAt = equipment.created_at instanceof Date
                ? equipment.created_at.toISOString()
                : new Date(equipment.created_at).toISOString();
            const updatedAt = equipment.updated_at instanceof Date
                ? equipment.updated_at.toISOString()
                : new Date(equipment.updated_at).toISOString();
            // Безопасное преобразование цены
            const rawPrice = equipment.price;
            let price;
            if (rawPrice === null || rawPrice === undefined) {
                price = null;
            }
            else if (typeof rawPrice === "number") {
                price = rawPrice;
            }
            else {
                const parsed = Number(rawPrice);
                price = Number.isNaN(parsed) ? null : parsed;
            }
            return {
                id: equipment.id,
                name: equipment.name,
                category: equipment.category,
                subcategory: equipment.subcategory,
                brand: equipment.brand,
                region: equipment.region,
                description: equipment.description,
                price,
                imageUrl: `speq-images/${equipment.id}/200`,
                mainParameters: equipment.main_parameters || {},
                normalizedParameters: equipment.normalized_parameters || {},
                createdAt,
                updatedAt,
            };
        });
        const totalPages = Math.ceil(total / limit);
        return {
            items,
            total,
            page,
            limit,
            totalPages,
        };
    }
}
exports.EquipmentService = EquipmentService;
//# sourceMappingURL=equipment.service.js.map