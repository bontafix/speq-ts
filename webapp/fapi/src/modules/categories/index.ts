import { FastifyPluginAsync } from "fastify";
import { CategoryService } from "./category.service";
import { CategoryController } from "./category.controller";
import {
  categorySchema,
  createCategorySchema,
  updateCategorySchema,
} from "./category.schema";
import { errorResponseSchema } from "../../core/schemas/shared";
import { requireRole } from "../../core/decorators/auth.decorator";

/**
 * Плагин модуля Categories
 * Все эндпоинты требуют роль 'admin'
 */
export const categoriesPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new CategoryService(fastify);
  const controller = new CategoryController(service);

  // Получить все категории
  fastify.get(
    "/categories",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Получить все категории (требует роль admin)",
        tags: ["Categories"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: categorySchema,
              },
              timestamp: { type: "string" },
            },
          },
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.getAll(request, reply);
    },
  );

  // Получить категорию по ID
  fastify.get<{ Params: { id: string } }>(
    "/categories/:id",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Получить категорию по ID (требует роль admin)",
        tags: ["Categories"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: categorySchema,
              timestamp: { type: "string" },
            },
          },
          404: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.getById(request, reply);
    },
  );

  // Создать категорию
  fastify.post<{ Body: any }>(
    "/categories",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Создать категорию (требует роль admin)",
        tags: ["Categories"],
        security: [{ bearerAuth: [] }],
        body: createCategorySchema,
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: categorySchema,
              timestamp: { type: "string" },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.create(request, reply);
    },
  );

  // Обновить категорию
  fastify.put<{ Params: { id: string }; Body: any }>(
    "/categories/:id",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Обновить категорию (требует роль admin)",
        tags: ["Categories"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: updateCategorySchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: categorySchema,
              timestamp: { type: "string" },
            },
          },
          404: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.update(request, reply);
    },
  );

  // Удалить категорию
  fastify.delete<{ Params: { id: string } }>(
    "/categories/:id",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Удалить категорию (требует роль admin)",
        tags: ["Categories"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        response: {
          204: { type: "null" },
          404: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.delete(request, reply);
    },
  );
};
