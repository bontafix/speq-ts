import { Router } from "express";
import { getEquipmentById } from "../controllers/equipment.controller";

export const equipmentRouter = Router();

/**
 * @swagger
 * /equipment/{id}:
 *   get:
 *     summary: Получить карточку оборудования по ID
 *     tags: [Equipment]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID оборудования
 *     responses:
 *       200:
 *         description: Карточка оборудования
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EquipmentCard'
 *       404:
 *         description: Оборудование не найдено
 *       500:
 *         description: Ошибка сервера
 */
equipmentRouter.get("/:id", getEquipmentById);
