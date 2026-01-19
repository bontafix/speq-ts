"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerPlugin = void 0;
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const config_1 = require("../config");
/**
 * Плагин Swagger/OpenAPI документации
 */
const swaggerPlugin = async (fastify) => {
    await fastify.register(swagger_1.default, {
        openapi: {
            info: {
                title: "Equipment Catalog API (Fastify)",
                description: "REST API для каталога оборудования",
                version: "1.0.0",
            },
            servers: [
                {
                    url: config_1.config.domain,
                    description: config_1.config.env === "development" ? "Development server" : "Production server",
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
    await fastify.register(swagger_ui_1.default, {
        routePrefix: "/api-docs",
        uiConfig: {
            docExpansion: "list",
            deepLinking: false,
        },
        staticCSP: true,
        transformStaticCSP: (header) => {
            // Разрешаем inline стили для Swagger UI
            return header.replace("style-src 'self' https:", "style-src 'self' https: 'unsafe-inline'");
        },
    });
};
exports.swaggerPlugin = swaggerPlugin;
//# sourceMappingURL=swagger.js.map