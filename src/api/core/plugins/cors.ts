import { FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config';

export const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Разрешаем запросы без origin (например, от Postman, curl)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      // Origins загружаются из CORS_ORIGINS env переменной через config
      if (config.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
};