"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const fastify_1 = __importDefault(require("fastify"));
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const config_1 = require("./core/config");
const database_1 = require("./core/database");
const cors_1 = require("./core/plugins/cors");
const jwt_1 = require("./core/plugins/jwt");
const logger_1 = require("./core/plugins/logger");
const error_handler_1 = require("./core/errors/error-handler");
const equipment_1 = require("./modules/equipment");
const health_1 = require("./modules/health");
const auth_1 = require("./modules/auth");
const users_1 = require("./modules/users");
const categories_1 = require("./modules/categories");
const parameter_dictionary_1 = require("./modules/parameter-dictionary");
const brands_1 = require("./modules/brands");
const version_1 = require("./modules/version");
/**
 * Создание и настройка Fastify приложения
 */
async function createApp() {
    const loggerConfig = {
        level: config_1.config.env === "development" ? "info" : "warn",
    };
    if (config_1.config.env === "development") {
        loggerConfig.transport = {
            target: "pino-pretty",
            options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
            },
        };
    }
    const app = (0, fastify_1.default)({
        logger: loggerConfig,
        trustProxy: true, // Доверять заголовкам X-Forwarded-* от nginx прокси
    });
    // Глобальный хук для обработки CORS (до регистрации плагинов)
    app.addHook('onRequest', async (request, reply) => {
        const origin = request.headers.origin;
        // Разрешенные origins
        const allowedOrigins = [
            'http://localhost:9527',
            'http://localhost:3000',
            'http://localhost:5173',
            'https://botfix.ru'
        ];
        // Обработка OPTIONS запроса (preflight)
        if (request.method === 'OPTIONS') {
            if (origin && allowedOrigins.includes(origin)) {
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
        if (origin && allowedOrigins.includes(origin)) {
            reply.header('Access-Control-Allow-Origin', origin);
            reply.header('Access-Control-Allow-Credentials', 'true');
            reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }
    });
    // Регистрация плагинов ядра
    await app.register(cors_1.corsPlugin);
    await app.register(database_1.databasePlugin);
    await app.register(jwt_1.jwtPlugin);
    await app.register(logger_1.loggerPlugin);
    // Регистрация Swagger НАПРЯМУЮ (не через плагин, чтобы видеть все роуты)
    await app.register(swagger_1.default, {
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
                { name: "Categories", description: "Управление категориями" },
                { name: "Parameter Dictionary", description: "Управление словарем параметров" },
                { name: "Brands", description: "Управление брендами" },
                { name: "Version", description: "Версия API" },
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
    await app.register(swagger_ui_1.default, {
        routePrefix: "/api-docs",
        uiConfig: {
            docExpansion: "list",
            deepLinking: false,
        },
        // staticCSP: true,
        staticCSP: config_1.config.env === "production" ? true : false,
        transformStaticCSP: (header) => {
            return header.replace("style-src 'self' https:", "style-src 'self' https: 'unsafe-inline'");
        },
    });
    // Регистрация бизнес-модулей (ПОСЛЕ Swagger, чтобы он мог собрать все схемы)
    await app.register(auth_1.authPlugin);
    await app.register(users_1.usersPlugin);
    await app.register(equipment_1.equipmentPlugin);
    await app.register(categories_1.categoriesPlugin);
    await app.register(parameter_dictionary_1.parameterDictionaryPlugin);
    await app.register(brands_1.brandsPlugin);
    await app.register(health_1.healthPlugin);
    await app.register(version_1.versionPlugin);
    // Глобальный обработчик ошибок
    app.setErrorHandler(error_handler_1.errorHandler);
    // Хук onError для добавления CORS заголовков при ошибках
    app.addHook('onError', async (request, reply, error) => {
        const origin = request.headers.origin;
        const allowedOrigins = [
            'http://localhost:9527',
            'http://localhost:3000',
            'http://localhost:5173',
            'https://botfix.ru'
        ];
        // Добавляем CORS заголовки даже при ошибках
        if (origin && allowedOrigins.includes(origin)) {
            reply.header('Access-Control-Allow-Origin', origin);
            reply.header('Access-Control-Allow-Credentials', 'true');
            reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }
    });
    // Хук onSend для финальной проверки CORS заголовков
    app.addHook('onSend', async (request, reply, payload) => {
        const origin = request.headers.origin;
        const allowedOrigins = [
            'http://localhost:9527',
            'http://localhost:3000',
            'http://localhost:5173',
            'https://botfix.ru'
        ];
        // Если заголовки отсутствуют, добавляем их (на всякий случай)
        if (!reply.getHeader('access-control-allow-origin')) {
            if (origin && allowedOrigins.includes(origin)) {
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
//# sourceMappingURL=app.js.map