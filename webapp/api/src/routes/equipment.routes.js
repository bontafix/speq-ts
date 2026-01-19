"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.equipmentRouter = void 0;
const express_1 = require("express");
const equipment_controller_1 = require("../controllers/equipment.controller");
exports.equipmentRouter = (0, express_1.Router)();
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
exports.equipmentRouter.get("/:id", equipment_controller_1.getEquipmentById);
//# sourceMappingURL=equipment.routes.js.map