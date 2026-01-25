import { createApp } from "./app";
import { config } from "./core/config";

/**
 * Запуск сервера
 * 
 * Настройки загружаются из переменных окружения:
 * - FAPI_PORT: порт (по умолчанию 3002)
 * - FAPI_HOST: хост (по умолчанию 0.0.0.0)
 * - FAPI_DOMAIN: домен для Swagger (по умолчанию http://localhost:PORT)
 * - NODE_ENV: окружение (development/production)
 * 
 * Для разработки используйте .env.development
 * Для продакшн используйте .env.production
 */
async function start() {
  try {
    console.log(`📋 Environment: ${config.env}`);
    console.log(`📋 CORS origins: ${config.corsOrigins?.join(', ') || 'not configured'}`);
    
    const app = await createApp();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`🚀 Fastify API server running on http://${config.host}:${config.port}`);
    console.log(`📚 Swagger docs available at ${config.domain}/api-docs`);
    
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
}

start();