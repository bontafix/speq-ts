import { FastifyPluginAsync } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "../config";

/**
 * Плагин Swagger/OpenAPI документации
 */
export const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "Equipment Catalog API (Fastify)",
        description: "REST API для каталога оборудования",
        version: "1.0.0",
      },
      servers: [
        {
          url: config.domain,
          description: config.env === "development" ? "Development server" : "Production server",
        },
      ],
      tags: [
        { name: "Auth", description: "Авторизация и аутентификация" },
        { name: "Users", description: "Управление пользователями" },
        { name: "Equipment", description: "Операции с оборудованием" },
        { name: "Health", description: "Проверка здоровья сервиса" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/api-docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => {
      // Разрешаем inline стили для Swagger UI
      return header.replace(
        "style-src 'self' https:",
        "style-src 'self' https: 'unsafe-inline'"
      );
    },
  });
};
