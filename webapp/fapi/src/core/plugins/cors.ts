import { FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';

export const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
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
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
};