import { Request, Response } from "express";
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
export declare function getEquipmentById(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=equipment.controller.d.ts.map