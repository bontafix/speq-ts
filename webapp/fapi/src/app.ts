import Fastify, { FastifyInstance } from "fastify";
import { config } from "./core/config";
import { databasePlugin } from "./core/database";
import { corsPlugin } from "./core/plugins/cors";
import { swaggerPlugin } from "./core/plugins/swagger";
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
  const app = Fastify({
    logger: {
      level: config.env === "development" ? "info" : "warn",
      transport:
        config.env === "development"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            }
          : undefined,
    },
  });

  // Регистрация плагинов ядра
  await app.register(databasePlugin);
  await app.register(corsPlugin);
  await app.register(jwtPlugin);
  await app.register(swaggerPlugin);
  await app.register(loggerPlugin);

  // Регистрация бизнес-модулей
  await app.register(authPlugin);
  await app.register(usersPlugin);
  await app.register(equipmentPlugin);
  await app.register(healthPlugin);

  // Глобальный обработчик ошибок
  app.setErrorHandler(errorHandler);

  return app;
}
