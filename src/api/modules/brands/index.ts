import { FastifyPluginAsync } from "fastify";
import { BrandService } from "./brand.service";
import { BrandController } from "./brand.controller";
import {
  brandSchema,
  createBrandSchema,
  updateBrandSchema,
  getBrandListQuerySchema,
  paginatedBrandListSchema,
} from "./brand.schema";
import { errorResponseSchema } from "../../core/schemas/shared";

/**
 * Плагин модуля Brands
 */
export const brandsPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new BrandService(fastify);
  const controller = new BrandController(service);

  // Получить список брендов с пагинацией
  fastify.get<{
    Querystring: { page?: number; limit?: number };
  }>(
    "/brands",
    {
      schema: {
        description: "Получить список брендов с пагинацией",
        tags: ["Brands"],
        querystring: getBrandListQuerySchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: paginatedBrandListSchema,
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

  // Получить бренд по ID
  fastify.get<{ Params: { id: string } }>(
    "/brands/:id",
    {
      schema: {
        description: "Получить бренд по ID",
        tags: ["Brands"],
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

  // Создать бренд
  fastify.post<{ Body: any }>(
    "/brands",
    {
      schema: {
        description: "Создать бренд",
        tags: ["Brands"],
        body: createBrandSchema,
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: brandSchema,
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

  // Обновить бренд
  fastify.put<{ Params: { id: string }; Body: any }>(
    "/brands/:id",
    {
      schema: {
        description: "Обновить бренд",
        tags: ["Brands"],
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

  // Удалить бренд
  fastify.delete<{ Params: { id: string } }>(
    "/brands/:id",
    {
      schema: {
        description: "Удалить бренд",
        tags: ["Brands"],
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
