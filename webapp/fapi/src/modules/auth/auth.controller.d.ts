import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService, RegisterData, LoginData } from "./auth.service";
/**
 * Контроллер авторизации
 */
export declare class AuthController {
    private service;
    constructor(service: AuthService);
    /**
     * Регистрация пользователя
     */
    register(request: FastifyRequest<{
        Body: RegisterData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Вход пользователя
     */
    login(request: FastifyRequest<{
        Body: LoginData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Получить текущего пользователя
     */
    me(request: FastifyRequest, reply: FastifyReply): Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map