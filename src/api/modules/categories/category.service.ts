import { FastifyInstance } from "fastify";
import { NotFoundError, ValidationError } from "../../core/errors/app-error";
import { formatTimestamps } from "../../shared/utils/date";
import { calculatePagination, createPaginatedResponse } from "../../shared/utils/pagination";
import { UpdateQueryBuilder } from "../../shared/utils/query-builder";

/**
 * Интерфейс категории для API
 */
export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  isActive: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
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
export class CategoryService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Получить список категорий с пагинацией
   */
  async getAll(page: number = 1, limit: number = 20): Promise<PaginatedCategoryResult> {
    const pagination = calculatePagination(page, limit);

    // Общее количество категорий
    const countResult = await this.fastify.db.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM categories
      `,
    );

    const total = parseInt(countResult.rows[0]?.count || "0", 10);

    // Данные текущей страницы
    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      parent_id: number | null;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT id, name, parent_id, is_active, created_at, updated_at
        FROM categories
        ORDER BY id
        LIMIT $1 OFFSET $2
      `,
      [pagination.limit, pagination.offset],
    );

    const items: Category[] = result.rows.map((row) => {
      const { createdAt, updatedAt } = formatTimestamps(row);

      return {
        id: row.id,
        name: row.name,
        parentId: row.parent_id,
        isActive: row.is_active,
        createdAt,
        updatedAt,
      };
    });

    return createPaginatedResponse(items, total, pagination);
  }

  /**
   * Получить категорию по ID
   */
  async getById(categoryId: number): Promise<Category> {
    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      parent_id: number | null;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT id, name, parent_id, is_active, created_at, updated_at
        FROM categories
        WHERE id = $1
      `,
      [categoryId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Category not found");
    }

    const row = result.rows[0]!;
    const { createdAt, updatedAt } = formatTimestamps(row);

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
  async create(data: CreateCategoryData): Promise<Category> {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("Name is required");
    }

    // Проверка существования родительской категории, если указана
    if (data.parentId !== null && data.parentId !== undefined) {
      const parentResult = await this.fastify.db.query<{ id: number }>(
        `SELECT id FROM categories WHERE id = $1`,
        [data.parentId],
      );
      if (parentResult.rows.length === 0) {
        throw new ValidationError("Parent category not found");
      }
    }

    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      parent_id: number | null;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        INSERT INTO categories (name, parent_id, is_active)
        VALUES ($1, $2, $3)
        RETURNING id, name, parent_id, is_active, created_at, updated_at
      `,
      [
        data.name,
        data.parentId ?? null,
        data.isActive ?? true,
      ],
    );

    const row = result.rows[0]!;
    const { createdAt, updatedAt } = formatTimestamps(row);

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
  async update(categoryId: number, data: UpdateCategoryData): Promise<Category> {
    // Проверка существования
    await this.getById(categoryId);

    // Проверка существования родительской категории, если указана
    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === categoryId) {
        throw new ValidationError("Category cannot be its own parent");
      }
      const parentResult = await this.fastify.db.query<{ id: number }>(
        `SELECT id FROM categories WHERE id = $1`,
        [data.parentId],
      );
      if (parentResult.rows.length === 0) {
        throw new ValidationError("Parent category not found");
      }
    }

    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new ValidationError("Name cannot be empty");
    }

    const builder = new UpdateQueryBuilder();
    builder.addField('name', data.name);
    builder.addField('parent_id', data.parentId);
    builder.addField('is_active', data.isActive);
    
    if (!builder.hasUpdates()) {
      return this.getById(categoryId);
    }
    
    builder.addTimestamp('updated_at');

    const { sql, values } = builder.build('categories', 'id', categoryId);
    
    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      parent_id: number | null;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(sql, values);

    const row = result.rows[0]!;
    const { createdAt, updatedAt } = formatTimestamps(row);

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
  async delete(categoryId: number): Promise<void> {
    await this.getById(categoryId);

    await this.fastify.db.query(
      `
        DELETE FROM categories
        WHERE id = $1
      `,
      [categoryId],
    );
  }
}
