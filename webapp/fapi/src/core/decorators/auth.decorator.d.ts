import { FastifyRequest, FastifyReply } from "fastify";
import { JwtPayload } from "../../shared/lib/jwt";
declare module "@fastify/jwt" {
    interface FastifyJWT {
        user: JwtPayload & {
            roles: string[];
        };
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
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Middleware для проверки наличия конкретной роли
 */
export declare function requireRole(roleName: string): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
/**
 * Middleware для проверки наличия одной из ролей
 */
export declare function requireAnyRole(roleNames: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
//# sourceMappingURL=auth.decorator.d.ts.map