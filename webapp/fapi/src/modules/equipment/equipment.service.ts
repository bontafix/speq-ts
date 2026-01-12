import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../core/errors/app-error";

/**
 * Интерфейс данных оборудования из БД
 */
interface EquipmentRow {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  region: string | null;
  description: string | null;
  price: number | null;
  main_parameters: Record<string, any>;
  normalized_parameters: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

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
  mainParameters: Record<string, any>;
  normalizedParameters: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Сервис для работы с оборудованием
 */
export class EquipmentService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Получить карточку оборудования по ID
   */
  async getById(id: string): Promise<EquipmentCard> {
    const result = await this.fastify.db.query<EquipmentRow>(
      `
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
      `,
      [id],
    );

    if (result.rows.length === 0 || !result.rows[0]) {
      throw new NotFoundError("Equipment not found");
    }

    const equipment = result.rows[0];

    return {
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      subcategory: equipment.subcategory,
      brand: equipment.brand,
      region: equipment.region,
      description: equipment.description,
      price: equipment.price,
      mainParameters: equipment.main_parameters || {},
      normalizedParameters: equipment.normalized_parameters || {},
      createdAt: equipment.created_at.toISOString(),
      updatedAt: equipment.updated_at.toISOString(),
    };
  }
}
