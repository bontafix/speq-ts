import { FastifyPluginAsync } from "fastify";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { registerSchema, loginSchema, authResponseSchema } from "./auth.schema";
import { errorResponseSchema } from "../../core/schemas/shared";
import { authenticate } from "../../core/decorators/auth.decorator";

/**
 * Плагин модуля Auth
 */
export const authPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new AuthService(fastify);
  const controller = new AuthController(service);

  // Регистрация
  fastify.post<{ Body: any }>(
    "/auth/register",
    {
      schema: {
        description: "Регистрация нового пользователя",
        tags: ["Auth"],
        body: registerSchema,
        // Не указываем security для публичного эндпоинта
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: authResponseSchema,
              timestamp: { type: "string" },
            },
            required: ["success", "data", "timestamp"],
          },
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.register(request, reply);
    },
  );

  // Вход
  fastify.post<{ Body: any }>(
    "/auth/login",
    {
      schema: {
        description: "Вход пользователя",
        tags: ["Auth"],
        body: loginSchema,
        // Не указываем security для публичного эндпоинта
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: authResponseSchema,
              timestamp: { type: "string" },
            },
            required: ["success", "data", "timestamp"],
          },
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.login(request, reply);
    },
  );

  // Получить текущего пользователя
  fastify.get(
    "/auth/me",
    {
      preHandler: [authenticate],
      schema: {
        description: "Получить информацию о текущем пользователе",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "integer" },
              username: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              name: { type: ["string", "null"] },
              status: { type: ["boolean", "null"] },
              roles: {
                type: "array",
                items: { type: "string" },
              },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await controller.me(request, reply);
    },
  );
};
