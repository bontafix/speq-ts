import { FastifyInstance } from "fastify";
import { NotFoundError, ValidationError } from "../../core/errors/app-error";
import { formatTimestamps } from "../../shared/utils/date";
import { calculatePagination, createPaginatedResponse } from "../../shared/utils/pagination";
import { UpdateQueryBuilder } from "../../shared/utils/query-builder";

/**
 * Интерфейс бренда для API
 */
export interface Brand {
  id: number;
  name: string;
  isActive: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
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
export class BrandService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Получить список брендов с пагинацией
   */
  async getAll(page: number = 1, limit: number = 20): Promise<PaginatedBrandResult> {
    const pagination = calculatePagination(page, limit);

    // Общее количество брендов
    const countResult = await this.fastify.db.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM brands
      `,
    );

    const total = parseInt(countResult.rows[0]?.count || "0", 10);

    // Данные текущей страницы
    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT id, name, is_active, created_at, updated_at
        FROM brands
        ORDER BY id
        LIMIT $1 OFFSET $2
      `,
      [pagination.limit, pagination.offset],
    );

    const items: Brand[] = result.rows.map((row) => {
      const { createdAt, updatedAt } = formatTimestamps(row);

      return {
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        createdAt,
        updatedAt,
      };
    });

    return createPaginatedResponse(items, total, pagination);
  }

  /**
   * Получить бренд по ID
   */
  async getById(brandId: number): Promise<Brand> {
    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT id, name, is_active, created_at, updated_at
        FROM brands
        WHERE id = $1
      `,
      [brandId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Brand not found");
    }

    const row = result.rows[0]!;
    const { createdAt, updatedAt } = formatTimestamps(row);

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
  async create(data: CreateBrandData): Promise<Brand> {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("Name is required");
    }

    // Проверка существования
    const existing = await this.fastify.db.query<{ id: number }>(
      `SELECT id FROM brands WHERE name = $1`,
      [data.name],
    );
    if (existing.rows.length > 0) {
      throw new ValidationError("Brand with this name already exists");
    }

    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        INSERT INTO brands (name, is_active)
        VALUES ($1, $2)
        RETURNING id, name, is_active, created_at, updated_at
      `,
      [
        data.name,
        data.isActive ?? true,
      ],
    );

    const row = result.rows[0]!;
    const { createdAt, updatedAt } = formatTimestamps(row);

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
  async update(brandId: number, data: UpdateBrandData): Promise<Brand> {
    // Проверка существования
    await this.getById(brandId);

    // Проверка уникальности имени, если оно меняется
    if (data.name !== undefined) {
      if (data.name.trim().length === 0) {
        throw new ValidationError("Name cannot be empty");
      }
      const existing = await this.fastify.db.query<{ id: number }>(
        `SELECT id FROM brands WHERE name = $1`,
        [data.name],
      );
      if (existing.rows.length > 0 && existing.rows[0]!.id !== brandId) {
        throw new ValidationError("Brand with this name already exists");
      }
    }

    const builder = new UpdateQueryBuilder();
    builder.addField('name', data.name);
    builder.addField('is_active', data.isActive, 'is_active');
    
    if (!builder.hasUpdates()) {
      return this.getById(brandId);
    }
    
    // Добавляем обновление updated_at
    builder.addTimestamp('updated_at');

    const { sql, values } = builder.build('brands', 'id', brandId);
    
    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(sql, values);

    const row = result.rows[0]!;
    const { createdAt, updatedAt } = formatTimestamps(row);

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
  async delete(brandId: number): Promise<void> {
    await this.getById(brandId);

    await this.fastify.db.query(
      `
        DELETE FROM brands
        WHERE id = $1
      `,
      [brandId],
    );
  }
}
