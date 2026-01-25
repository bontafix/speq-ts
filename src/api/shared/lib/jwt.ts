import jwt, { SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
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
  const options: SignOptions = {
    expiresIn: config.jwt.expiresIn as StringValue,
  };
  return jwt.sign(payload, config.jwt.secret, options);
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
