import Fastify, { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./core/config";
import { databasePlugin } from "./core/database";
import { corsPlugin } from "./core/plugins/cors";
import { jwtPlugin } from "./core/plugins/jwt";
import { loggerPlugin } from "./core/plugins/logger";
import { errorHandler } from "./core/errors/error-handler";
import { equipmentPlugin } from "./modules/equipment";
import { healthPlugin } from "./modules/health";
import { authPlugin } from "./modules/auth";
import { usersPlugin } from "./modules/users";

/**
 * Создание и настройка Fastify приложения
 */
export async function createApp(): Promise<FastifyInstance> {
  const loggerConfig: any = {
    level: config.env === "development" ? "info" : "warn",
  };

  if (config.env === "development") {
    loggerConfig.transport = {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    };
  }

  const app = Fastify({
    logger: loggerConfig,
    trustProxy: true, // Доверять заголовкам X-Forwarded-* от nginx прокси
  });

  // Регистрация плагинов ядра
  await app.register(databasePlugin);
  await app.register(corsPlugin);
  await app.register(jwtPlugin);
  await app.register(loggerPlugin);

  // Регистрация Swagger НАПРЯМУЮ (не через плагин, чтобы видеть все роуты)
  await app.register(swagger, {
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

  await app.register(swaggerUi, {
    routePrefix: "/api-docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => {
      return header.replace(
        "style-src 'self' https:",
        "style-src 'self' https: 'unsafe-inline'"
      );
    },
  });

  // Регистрация бизнес-модулей (ПОСЛЕ Swagger, чтобы он мог собрать все схемы)
  await app.register(authPlugin);
  await app.register(usersPlugin);
  await app.register(equipmentPlugin);
  await app.register(healthPlugin);

  // Глобальный обработчик ошибок
  app.setErrorHandler(errorHandler);

  return app;
}
