import { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, JwtPayload } from "../../shared/lib/jwt";
import { UnauthorizedError, ForbiddenError } from "../errors/app-error";

// Расширение типов Fastify для добавления user в request
declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload & { roles: string[] };
  }
}

/**
 * Интерфейс пользователя с ролями
 */
export interface AuthenticatedUser extends JwtPayload {
  roles: string[];
}

/**
 * Middleware для проверки авторизации
 * Добавляет user в request
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Authorization header is required");
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    // Получаем роли пользователя из БД
    const roles = await getUserRoles(request.server.db, payload.userId);
    request.user = {
      ...payload,
      roles,
    };
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

/**
 * Middleware для проверки наличия конкретной роли
 */
export function requireRole(roleName: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Сначала проверяем авторизацию
    await authenticate(request, reply);

    if (!request.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    if (!request.user.roles.includes(roleName)) {
      throw new ForbiddenError(`Role '${roleName}' is required`);
    }
  };
}

/**
 * Middleware для проверки наличия одной из ролей
 */
export function requireAnyRole(roleNames: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Сначала проверяем авторизацию
    await authenticate(request, reply);

    if (!request.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    const hasRole = roleNames.some((role) => request.user!.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenError(`One of roles [${roleNames.join(", ")}] is required`);
    }
  };
}

/**
 * Получить роли пользователя из БД
 */
async function getUserRoles(pool: { query: (text: string, params: any[]) => Promise<any> }, userId: number): Promise<string[]> {
  const result = await pool.query<{ name: string }>(
    `
      SELECT r.name
      FROM user_roles ur
      JOIN roles r ON ur.roleid = r.id
      WHERE ur.userid = $1
        AND r.status = true
    `,
    [userId],
  );

  return result.rows.map((row) => row.name);
}
