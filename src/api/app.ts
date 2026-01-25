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
import { categoriesPlugin } from "./modules/categories";
import { parameterDictionaryPlugin } from "./modules/parameter-dictionary";
import { brandsPlugin } from "./modules/brands";
import { versionPlugin } from "./modules/version";
import { telegramPlugin } from "./modules/telegram";
import { searchPlugin } from "./modules/search";
import { llmPlugin } from "./modules/llm";

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

  // Глобальный хук для обработки CORS (до регистрации плагинов)
  // Origins загружаются из CORS_ORIGINS env переменной через config
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    
    // Обработка OPTIONS запроса (preflight)
    if (request.method === 'OPTIONS') {
      if (origin && config.corsOrigins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        reply.header('Access-Control-Max-Age', '86400'); // 24 часа
        reply.code(204).send();
        return;
      }
    }
    
    // Добавляем CORS заголовки для всех запросов
    if (origin && config.corsOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  });

  // Регистрация плагинов ядра
  await app.register(corsPlugin);
  await app.register(databasePlugin);
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
        { name: "Categories", description: "Управление категориями" },
        { name: "Parameter Dictionary", description: "Управление словарем параметров" },
        { name: "Brands", description: "Управление брендами" },
        { name: "Version", description: "Версия API" },
        { name: "Telegram", description: "Управление Telegram ботом" },
        { name: "Search", description: "Поиск оборудования" },
        { name: "LLM", description: "Управление LLM провайдерами" },
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
    // staticCSP: true,
    staticCSP: config.env === "production" ? true : false, 
    transformStaticCSP: (header) => {
      return header.replace(
        "style-src 'self' https:",
        "style-src 'self' https: 'unsafe-inline'"
      );
    },
  });

  // Глобальный обработчик ошибок (ВАЖНО: до регистрации бизнес-роутов из-за encapsulation)
  app.setErrorHandler(errorHandler);

  // Регистрация бизнес-модулей (ПОСЛЕ Swagger, чтобы он мог собрать все схемы)
  await app.register(authPlugin);
  await app.register(usersPlugin);
  await app.register(equipmentPlugin);
  await app.register(categoriesPlugin);
  await app.register(parameterDictionaryPlugin);
  await app.register(brandsPlugin);
  await app.register(healthPlugin);
  await app.register(versionPlugin);
  await app.register(telegramPlugin);
  await app.register(searchPlugin);
  await app.register(llmPlugin);
  
  // Хук onError для добавления CORS заголовков при ошибках
  app.addHook('onError', async (request, reply, error) => {
    const origin = request.headers.origin;
    
    // Добавляем CORS заголовки даже при ошибках
    if (origin && config.corsOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  });
  
  // Хук onSend для финальной проверки CORS заголовков
  app.addHook('onSend', async (request, reply, payload) => {
    const origin = request.headers.origin;
    
    // Если заголовки отсутствуют, добавляем их (на всякий случай)
    if (!reply.getHeader('access-control-allow-origin')) {
      if (origin && config.corsOrigins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
    }
    
    return payload;
  });

  return app;
}
