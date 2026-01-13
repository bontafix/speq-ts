import { FastifyPluginAsync } from "fastify";
import { BrandService } from "./brand.service";
import { BrandController } from "./brand.controller";
import {
  brandSchema,
  createBrandSchema,
  updateBrandSchema,
} from "./brand.schema";
import { errorResponseSchema } from "../../core/schemas/shared";
import { requireRole } from "../../core/decorators/auth.decorator";

/**
 * Плагин модуля Brands
 * Все эндпоинты требуют роль 'admin'
 */
export const brandsPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new BrandService(fastify);
  const controller = new BrandController(service);

  // Получить все бренды
  fastify.get(
    "/brands",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Получить все бренды (требует роль admin)",
        tags: ["Brands"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: brandSchema,
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

  // Получить бренд по ID
  fastify.get<{ Params: { id: string } }>(
    "/brands/:id",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Получить бренд по ID (требует роль admin)",
        tags: ["Brands"],
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
              data: brandSchema,
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

  // Создать бренд
  fastify.post<{ Body: any }>(
    "/brands",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Создать бренд (требует роль admin)",
        tags: ["Brands"],
        security: [{ bearerAuth: [] }],
        body: createBrandSchema,
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: brandSchema,
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

  // Обновить бренд
  fastify.put<{ Params: { id: string }; Body: any }>(
    "/brands/:id",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Обновить бренд (требует роль admin)",
        tags: ["Brands"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: updateBrandSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: brandSchema,
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

  // Удалить бренд
  fastify.delete<{ Params: { id: string } }>(
    "/brands/:id",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Удалить бренд (требует роль admin)",
        tags: ["Brands"],
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
