import { FastifyPluginAsync } from "fastify";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import {
  userSchema,
  createUserSchema,
  updateUserSchema,
  assignRoleSchema,
} from "./user.schema";
import { errorResponseSchema } from "../../core/schemas/shared";
import { requireRole } from "../../core/decorators/auth.decorator";

/**
 * Плагин модуля Users
 * Все эндпоинты требуют роль 'admin'
 */
export const usersPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new UserService(fastify);
  const controller = new UserController(service);

  // Получить всех пользователей
  fastify.get(
    "/users",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Получить всех пользователей (требует роль admin)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: userSchema,
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

  // Получить пользователя по ID
  fastify.get<{ Params: { id: string } }>(
    "/users/:id",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Получить пользователя по ID (требует роль admin)",
        tags: ["Users"],
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
              data: userSchema,
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

  // Создать пользователя
  fastify.post<{ Body: any }>(
    "/users",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Создать пользователя (требует роль admin)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        body: createUserSchema,
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: userSchema,
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

  // Обновить пользователя
  fastify.put<{ Params: { id: string }; Body: any }>(
    "/users/:id",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Обновить пользователя (требует роль admin)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: updateUserSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: userSchema,
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

  // Удалить пользователя
  fastify.delete<{ Params: { id: string } }>(
    "/users/:id",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Удалить пользователя (требует роль admin)",
        tags: ["Users"],
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

  // Назначить роль пользователю
  fastify.post<{ Params: { id: string }; Body: any }>(
    "/users/:id/roles",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Назначить роль пользователю (требует роль admin)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: assignRoleSchema,
        response: {
          204: { type: "null" },
          400: errorResponseSchema,
          404: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.assignRole(request, reply);
    },
  );

  // Удалить роль у пользователя
  fastify.delete<{ Params: { id: string; roleId: string } }>(
    "/users/:id/roles/:roleId",
    {
      preHandler: [requireRole("admin")],
      schema: {
        description: "Удалить роль у пользователя (требует роль admin)",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
            roleId: { type: "string" },
          },
          required: ["id", "roleId"],
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
      await controller.removeRole(request, reply);
    },
  );
};
