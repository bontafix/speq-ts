import { FastifyRequest, FastifyReply } from "fastify";
import { UserService, CreateUserData, UpdateUserData } from "./user.service";
/**
 * Интерфейс параметров пути
 */
interface UserParams {
    id: string;
}
interface RoleParams extends UserParams {
    roleId: string;
}
/**
 * Контроллер управления пользователями
 */
export declare class UserController {
    private service;
    constructor(service: UserService);
    /**
     * Получить всех пользователей
     */
    getAll(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    /**
     * Получить пользователя по ID
     */
    getById(request: FastifyRequest<{
        Params: UserParams;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Создать пользователя
     */
    create(request: FastifyRequest<{
        Body: CreateUserData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Обновить пользователя
     */
    update(request: FastifyRequest<{
        Params: UserParams;
        Body: UpdateUserData;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Удалить пользователя
     */
    delete(request: FastifyRequest<{
        Params: UserParams;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Назначить роль пользователю
     */
    assignRole(request: FastifyRequest<{
        Params: UserParams;
        Body: {
            roleId: number;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Удалить роль у пользователя
     */
    removeRole(request: FastifyRequest<{
        Params: RoleParams;
    }>, reply: FastifyReply): Promise<void>;
}
export {};
//# sourceMappingURL=user.controller.d.ts.map