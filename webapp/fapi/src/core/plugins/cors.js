"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsPlugin = void 0;
const cors_1 = __importDefault(require("@fastify/cors"));
const corsPlugin = async (fastify) => {
    await fastify.register(cors_1.default, {
        origin: (origin, callback) => {
            // Разрешаем запросы без origin (например, от Postman, curl)
            if (!origin) {
                callback(null, true);
                return;
            }
            const allowedOrigins = [
                'http://localhost:9527',
                'http://localhost:3000',
                'http://localhost:5173',
                'https://botfix.ru'
            ];
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'), false);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
};
exports.corsPlugin = corsPlugin;
//# sourceMappingURL=cors.js.map