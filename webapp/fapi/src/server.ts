import "dotenv/config";
import { createApp } from "./app";
import { config } from "./core/config";

/**
 * Запуск сервера
 */
async function start() {
  try {
    const app = await createApp();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`🚀 Fastify API server running on http://${config.host}:${config.port}`);
    console.log(`📚 Swagger docs available at http://${config.host}:${config.port}/api-docs`);
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
}

start();
