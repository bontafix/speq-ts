"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const password_1 = require("../../shared/lib/password");
const jwt_1 = require("../../shared/lib/jwt");
const app_error_1 = require("../../core/errors/app-error");
const user_repository_1 = require("../users/user.repository");
/**
 * Сервис авторизации
 */
class AuthService {
    constructor(fastify) {
        this.fastify = fastify;
        this.userRepository = new user_repository_1.UserRepository(fastify);
    }
    /**
     * Регистрация нового пользователя
     */
    async register(data) {
        // Валидация
        if (!data.email) {
            throw new app_error_1.ValidationError("Email is required");
        }
        if (!data.password || data.password.length < 6) {
            throw new app_error_1.ValidationError("Password must be at least 6 characters");
        }
        // Проверка существования пользователя
        const existingUser = await this.userRepository.findUserByUsernameOrEmailBasic(undefined, data.email);
        if (existingUser) {
            throw new app_error_1.ValidationError("User with this email already exists");
        }
        // Хеширование пароля
        const hashedPassword = await (0, password_1.hashPassword)(data.password);
        // Создание пользователя
        const result = await this.fastify.db.query(`
        INSERT INTO users (email, password, name, status)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, password, name, status, "createdAt", "updatedAt"
      `, [data.email, hashedPassword, data.name || null, true]);
        const userRow = result.rows[0];
        if (!userRow) {
            throw new app_error_1.ValidationError("Failed to create user");
        }
        const user = await this.getUserById(userRow.id);
        // Создание токена
        const token = (0, jwt_1.createToken)({
            userId: user.id,
            username: user.username || "",
            email: user.email || "",
        });
        return {
            token,
            user,
        };
    }
    /**
     * Вход пользователя
     */
    async login(data) {
        if (!data.email) {
            throw new app_error_1.ValidationError("Email is required");
        }
        if (!data.password) {
            throw new app_error_1.ValidationError("Password is required");
        }
        // Поиск пользователя по email
        const userRow = await this.userRepository.findUserByUsernameOrEmailBasic(undefined, data.email);
        if (!userRow) {
            throw new app_error_1.UnauthorizedError("Invalid credentials");
        }
        // Проверка пароля
        if (!userRow.password) {
            throw new app_error_1.UnauthorizedError("Invalid credentials");
        }
        const isPasswordValid = await (0, password_1.comparePassword)(data.password, userRow.password);
        if (!isPasswordValid) {
            throw new app_error_1.UnauthorizedError("Invalid credentials");
        }
        // Проверка статуса
        if (userRow.status === false) {
            throw new app_error_1.UnauthorizedError("User account is disabled");
        }
        const user = await this.getUserById(userRow.id);
        // Создание токена
        const token = (0, jwt_1.createToken)({
            userId: user.id,
            username: user.username || "",
            email: user.email || "",
        });
        return {
            token,
            user,
        };
    }
    /**
     * Получить пользователя по ID
     */
    async getUserById(userId) {
        const result = await this.fastify.db.query(`
        SELECT id, username, email, password, name, status, "createdAt", "updatedAt"
        FROM users
        WHERE id = $1
      `, [userId]);
        if (result.rows.length === 0) {
            throw new app_error_1.ValidationError("User not found");
        }
        const userRow = result.rows[0];
        if (!userRow) {
            throw new app_error_1.ValidationError("User not found");
        }
        // Получаем роли
        const roles = await this.userRepository.getUserRoles(userId);
        // Безопасное преобразование дат
        const createdAt = userRow.createdAt instanceof Date
            ? userRow.createdAt.toISOString()
            : new Date(userRow.createdAt).toISOString();
        const updatedAt = userRow.updatedAt instanceof Date
            ? userRow.updatedAt.toISOString()
            : new Date(userRow.updatedAt).toISOString();
        return {
            id: userRow.id,
            username: userRow.username,
            email: userRow.email,
            name: userRow.name,
            status: userRow.status,
            roles,
            createdAt,
            updatedAt,
        };
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map