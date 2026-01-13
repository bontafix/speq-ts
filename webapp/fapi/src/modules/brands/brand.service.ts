import { FastifyInstance } from "fastify";
import { NotFoundError, ValidationError } from "../../core/errors/app-error";

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
 * Сервис управления брендами
 */
export class BrandService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Получить все бренды
   */
  async getAll(): Promise<Brand[]> {
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
        isActive: row.is_active,
        createdAt,
        updatedAt,
      };
    });
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

    // Подготовка данных для обновления
    const updates: string[] = [];
    const values: any[] = [];
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

    const result = await this.fastify.db.query<{
      id: number;
      name: string;
      is_active: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        UPDATE brands
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, name, is_active, created_at, updated_at
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
