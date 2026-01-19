import { FastifyInstance } from "fastify";
/**
 * Интерфейс пользователя для API
 */
export interface User {
    id: number;
    username: string | null;
    email: string | null;
    name: string | null;
    status: boolean | null;
    limitDocument: number | null;
    limitSizePdf: number | null;
    roles: string[];
    createdAt: string;
    updatedAt: string;
}
/**
 * Интерфейс данных создания пользователя
 */
export interface CreateUserData {
    username?: string;
    email?: string;
    password: string;
    name?: string;
    status?: boolean;
    limitDocument?: number;
    limitSizePdf?: number;
}
/**
 * Интерфейс данных обновления пользователя
 */
export interface UpdateUserData {
    username?: string;
    email?: string;
    password?: string;
    name?: string;
    status?: boolean;
    limitDocument?: number;
    limitSizePdf?: number;
}
/**
 * Сервис управления пользователями
 */
export declare class UserService {
    private fastify;
    private userRepository;
    constructor(fastify: FastifyInstance);
    /**
     * Получить всех пользователей
     */
    getAll(): Promise<User[]>;
    /**
     * Получить пользователя по ID
     */
    getById(userId: number): Promise<User>;
    /**
     * Создать пользователя
     */
    create(data: CreateUserData): Promise<User>;
    /**
     * Обновить пользователя
     */
    update(userId: number, data: UpdateUserData): Promise<User>;
    /**
     * Удалить пользователя
     */
    delete(userId: number): Promise<void>;
    /**
     * Назначить роль пользователю
     */
    assignRole(userId: number, roleId: number): Promise<void>;
    /**
     * Удалить роль у пользователя
     */
    removeRole(userId: number, roleId: number): Promise<void>;
}
//# sourceMappingURL=user.service.d.ts.map