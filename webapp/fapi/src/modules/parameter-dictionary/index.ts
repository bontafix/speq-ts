import { FastifyPluginAsync } from "fastify";
import { ParameterDictionaryService } from "./parameter-dictionary.service";
import { ParameterDictionaryController } from "./parameter-dictionary.controller";
import {
  parameterDictionarySchema,
  createParameterDictionarySchema,
  updateParameterDictionarySchema,
} from "./parameter-dictionary.schema";
import { errorResponseSchema } from "../../core/schemas/shared";
import { requireRole } from "../../core/decorators/auth.decorator";

/**
 * Плагин модуля Parameter Dictionary
 * Все эндпоинты требуют роль 'admin'
 */
export const parameterDictionaryPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new ParameterDictionaryService(fastify);
  const controller = new ParameterDictionaryController(service);

  // Получить все параметры словаря
  fastify.get(
    "/parameter-dictionary",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Получить все параметры словаря (требует роль admin)",
        tags: ["Parameter Dictionary"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: parameterDictionarySchema,
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

  // Получить параметр словаря по ключу
  fastify.get<{ Params: { key: string } }>(
    "/parameter-dictionary/:key",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Получить параметр словаря по ключу (требует роль admin)",
        tags: ["Parameter Dictionary"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            key: { type: "string" },
          },
          required: ["key"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: parameterDictionarySchema,
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
      await controller.getByKey(request, reply);
    },
  );

  // Создать параметр словаря
  fastify.post<{ Body: any }>(
    "/parameter-dictionary",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Создать параметр словаря (требует роль admin)",
        tags: ["Parameter Dictionary"],
        security: [{ bearerAuth: [] }],
        body: createParameterDictionarySchema,
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: parameterDictionarySchema,
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

  // Обновить параметр словаря
  fastify.put<{ Params: { key: string }; Body: any }>(
    "/parameter-dictionary/:key",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Обновить параметр словаря (требует роль admin)",
        tags: ["Parameter Dictionary"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            key: { type: "string" },
          },
          required: ["key"],
        },
        body: updateParameterDictionarySchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: parameterDictionarySchema,
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

  // Удалить параметр словаря
  fastify.delete<{ Params: { key: string } }>(
    "/parameter-dictionary/:key",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Удалить параметр словаря (требует роль admin)",
        tags: ["Parameter Dictionary"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            key: { type: "string" },
          },
          required: ["key"],
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
