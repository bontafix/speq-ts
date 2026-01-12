import jwt from "jsonwebtoken";
import { config } from "../../core/config";

/**
 * Интерфейс payload JWT токена
 */
export interface JwtPayload {
  userId: number;
  username: string;
  email: string;
}

/**
 * Создание JWT токена
 */
export function createToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Верификация JWT токена
 */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch (error) {
    throw new Error("Invalid token");
  }
}
