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
    roles: string[];
    createdAt: string;
    updatedAt: string;
}
/**
 * Интерфейс данных регистрации
 */
export interface RegisterData {
    email: string;
    password: string;
    name?: string;
}
/**
 * Интерфейс данных входа
 */
export interface LoginData {
    email: string;
    password: string;
}
/**
 * Интерфейс ответа авторизации
 */
export interface AuthResponse {
    token: string;
    user: User;
}
/**
 * Сервис авторизации
 */
export declare class AuthService {
    private fastify;
    private userRepository;
    constructor(fastify: FastifyInstance);
    /**
     * Регистрация нового пользователя
     */
    register(data: RegisterData): Promise<AuthResponse>;
    /**
     * Вход пользователя
     */
    login(data: LoginData): Promise<AuthResponse>;
    /**
     * Получить пользователя по ID
     */
    getUserById(userId: number): Promise<User>;
}
//# sourceMappingURL=auth.service.d.ts.map