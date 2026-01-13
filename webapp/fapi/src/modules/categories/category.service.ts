import { FastifyInstance } from "fastify";
import { NotFoundError, ValidationError } from "../../core/errors/app-error";

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
 * Сервис управления категориями
 */
export class CategoryService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Получить все категории
   */
  async getAll(): Promise<Category[]> {
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
      `,
    );

    return result.rows.map((row) => {
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
  async update(categoryId: number, data: UpdateCategoryData): Promise<Category> {
    // Проверка существования
    await this.getById(categoryId);

    // Проверка существования родительской категории, если указана
    if (data.parentId !== null && data.parentId !== undefined) {
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

    // Подготовка данных для обновления
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      if (data.name.trim().length === 0) {
        throw new ValidationError("Name cannot be empty");
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

    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      parent_id: number | null;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        UPDATE categories
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, name, parent_id, is_active, created_at, updated_at
      `,
      values,
    );

    const row = result.rows[0]!;
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
