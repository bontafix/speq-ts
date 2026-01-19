"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./core/config");
/**
 * Запуск сервера
 */
async function start() {
    try {
        const app = await (0, app_1.createApp)();
        await app.listen({
            port: config_1.config.port,
            host: config_1.config.host,
        });
        console.log(`🚀 Fastify API server running on http://${config_1.config.host}:${config_1.config.port}`);
        console.log(`📚 Swagger docs available at http://${config_1.config.host}:${config_1.config.port}/api-docs`);
    }
    catch (err) {
        console.error("Error starting server:", err);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=server%20copy.js.map