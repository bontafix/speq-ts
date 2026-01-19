import { FastifyInstance } from "fastify";
/**
 * Интерфейс данных пользователя из БД
 */
export interface UserRow {
    id: number;
    username: string | null;
    email: string | null;
    password: string | null;
    name: string | null;
    status: boolean | null;
    limit_document?: number | null;
    limit_size_pdf?: number | null;
    createdat: Date;
    updatedat: Date;
}
/**
 * Репозиторий для работы с пользователями
 * Содержит общие методы для работы с БД
 */
export declare class UserRepository {
    private fastify;
    constructor(fastify: FastifyInstance);
    /**
     * Получить роли пользователя
     */
    getUserRoles(userId: number): Promise<string[]>;
    /**
     * Найти пользователя по username или email
     */
    findUserByUsernameOrEmail(username?: string, email?: string): Promise<UserRow | null>;
    /**
     * Найти пользователя по username или email (без limit полей для auth)
     */
    findUserByUsernameOrEmailBasic(username?: string, email?: string): Promise<UserRow | null>;
}
//# sourceMappingURL=user.repository.d.ts.map