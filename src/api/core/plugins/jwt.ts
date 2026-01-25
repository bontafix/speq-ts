import { FastifyPluginAsync } from "fastify";
import jwt from "@fastify/jwt";
import { config } from "../config";

/**
 * Плагин JWT для Fastify
 * Регистрирует JWT плагин, но не использует его для автоматической верификации
 * Верификация происходит через наш кастомный декоратор authenticate
 */
export const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });
};
