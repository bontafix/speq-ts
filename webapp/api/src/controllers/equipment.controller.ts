import { Request, Response } from "express";
import { pgPool } from "../../../src/db/pg";

/**
 * @swagger
 * components:
 *   schemas:
 *     EquipmentCard:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Уникальный идентификатор оборудования
 *         name:
 *           type: string
 *           description: Название оборудования
 *         category:
 *           type: string
 *           description: Категория
 *         subcategory:
 *           type: string
 *           nullable: true
 *           description: Подкатегория
 *         brand:
 *           type: string
 *           nullable: true
 *           description: Бренд
 *         region:
 *           type: string
 *           nullable: true
 *           description: Регион
 *         description:
 *           type: string
 *           nullable: true
 *           description: Описание
 *         price:
 *           type: number
 *           nullable: true
 *           description: Цена
 *         mainParameters:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           description: Основные параметры (JSONB)
 *         normalizedParameters:
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *               - type: number
 *               - type: string
 *           description: Нормализованные параметры (JSONB)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Дата создания
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Дата обновления
 */
export async function getEquipmentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: "ID is required" });
      return;
    }

    const result = await pgPool.query<{
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
    }>(
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

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Equipment not found" });
      return;
    }

    const equipment = result.rows[0];

    res.json({
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
    });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
