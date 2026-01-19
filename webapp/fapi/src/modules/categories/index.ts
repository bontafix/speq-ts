import { FastifyPluginAsync } from "fastify";
import { CategoryService } from "./category.service";
import { CategoryController } from "./category.controller";
import {
  categorySchema,
  createCategorySchema,
  updateCategorySchema,
  getCategoryListQuerySchema,
  paginatedCategoryListSchema,
} from "./category.schema";
import { errorResponseSchema } from "../../core/schemas/shared";

/**
 * Плагин модуля Categories
 */
export const categoriesPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new CategoryService(fastify);
  const controller = new CategoryController(service);

  // Получить список категорий с пагинацией
  fastify.get<{
    Querystring: { page?: number; limit?: number };
  }>(
    "/categories",
    {
      schema: {
        description: "Получить список категорий с пагинацией",
        tags: ["Categories"],
        querystring: getCategoryListQuerySchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: paginatedCategoryListSchema,
              timestamp: { type: "string" },
            },
            required: ["success", "data", "timestamp"],
          },
          500: errorResponseSchema,
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
      schema: {
        description: "Получить категорию по ID",
        tags: ["Categories"],
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
            required: ["success", "data", "timestamp"],
          },
          404: errorResponseSchema,
          500: errorResponseSchema,
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
      schema: {
        description: "Создать категорию",
        tags: ["Categories"],
        body: createCategorySchema,
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: categorySchema,
              timestamp: { type: "string" },
            },
            required: ["success", "data", "timestamp"],
          },
          400: errorResponseSchema,
          500: errorResponseSchema,
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
      schema: {
        description: "Обновить категорию",
        tags: ["Categories"],
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
            required: ["success", "data", "timestamp"],
          },
          404: errorResponseSchema,
          500: errorResponseSchema,
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
      schema: {
        description: "Удалить категорию",
        tags: ["Categories"],
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
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.delete(request, reply);
    },
  );
};
