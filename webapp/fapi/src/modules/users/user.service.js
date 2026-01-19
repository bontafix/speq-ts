"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const password_1 = require("../../shared/lib/password");
const app_error_1 = require("../../core/errors/app-error");
const user_repository_1 = require("./user.repository");
/**
 * Сервис управления пользователями
 */
class UserService {
    constructor(fastify) {
        this.fastify = fastify;
        this.userRepository = new user_repository_1.UserRepository(fastify);
    }
    /**
     * Получить всех пользователей
     */
    async getAll() {
        const result = await this.fastify.db.query(`
        SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
        FROM users
        ORDER BY id
      `);
        const users = [];
        for (const row of result.rows) {
            const roles = await this.userRepository.getUserRoles(row.id);
            // Безопасное преобразование дат
            const createdAt = row.createdAt instanceof Date
                ? row.createdAt.toISOString()
                : new Date(row.createdAt).toISOString();
            const updatedAt = row.updatedAt instanceof Date
                ? row.updatedAt.toISOString()
                : new Date(row.updatedAt).toISOString();
            users.push({
                id: row.id,
                username: row.username,
                email: row.email,
                name: row.name,
                status: row.status,
                limitDocument: row.limit_document ?? null,
                limitSizePdf: row.limit_size_pdf ?? null,
                roles,
                createdAt,
                updatedAt,
            });
        }
        return users;
    }
    /**
     * Получить пользователя по ID
     */
    async getById(userId) {
        const result = await this.fastify.db.query(`
        SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
        FROM users
        WHERE id = $1
      `, [userId]);
        if (result.rows.length === 0) {
            throw new app_error_1.NotFoundError("User not found");
        }
        const row = result.rows[0];
        const roles = await this.userRepository.getUserRoles(row.id);
        // Безопасное преобразование дат
        const createdAt = row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : new Date(row.createdAt).toISOString();
        const updatedAt = row.updatedAt instanceof Date
            ? row.updatedAt.toISOString()
            : new Date(row.updatedAt).toISOString();
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            name: row.name,
            status: row.status,
            limitDocument: row.limit_document ?? null,
            limitSizePdf: row.limit_size_pdf ?? null,
            roles,
            createdAt,
            updatedAt,
        };
    }
    /**
     * Создать пользователя
     */
    async create(data) {
        if (!data.username && !data.email) {
            throw new app_error_1.ValidationError("Username or email is required");
        }
        if (!data.password || data.password.length < 6) {
            throw new app_error_1.ValidationError("Password must be at least 6 characters");
        }
        // Проверка существования
        const existing = await this.userRepository.findUserByUsernameOrEmail(data.username || undefined, data.email || undefined);
        if (existing) {
            throw new app_error_1.ValidationError("User with this username or email already exists");
        }
        // Хеширование пароля
        const hashedPassword = await (0, password_1.hashPassword)(data.password);
        // Создание
        const result = await this.fastify.db.query(`
        INSERT INTO users (username, email, password, name, status, limit_document, limit_size_pdf)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
      `, [
            data.username || null,
            data.email || null,
            hashedPassword,
            data.name || null,
            data.status ?? true,
            data.limitDocument || null,
            data.limitSizePdf || null,
        ]);
        const row = result.rows[0];
        const roles = await this.userRepository.getUserRoles(row.id);
        // Безопасное преобразование дат
        const createdAt = row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : new Date(row.createdAt).toISOString();
        const updatedAt = row.updatedAt instanceof Date
            ? row.updatedAt.toISOString()
            : new Date(row.updatedAt).toISOString();
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            name: row.name,
            status: row.status,
            limitDocument: row.limit_document ?? null,
            limitSizePdf: row.limit_size_pdf ?? null,
            roles,
            createdAt,
            updatedAt,
        };
    }
    /**
     * Обновить пользователя
     */
    async update(userId, data) {
        // Проверка существования
        await this.getById(userId);
        // Проверка уникальности username/email если они меняются
        if (data.username || data.email) {
            const existing = await this.userRepository.findUserByUsernameOrEmail(data.username || undefined, data.email || undefined);
            if (existing && existing.id !== userId) {
                throw new app_error_1.ValidationError("User with this username or email already exists");
            }
        }
        // Подготовка данных для обновления
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (data.username !== undefined) {
            updates.push(`username = $${paramIndex++}`);
            values.push(data.username || null);
        }
        if (data.email !== undefined) {
            updates.push(`email = $${paramIndex++}`);
            values.push(data.email || null);
        }
        if (data.password !== undefined) {
            const hashedPassword = await (0, password_1.hashPassword)(data.password);
            updates.push(`password = $${paramIndex++}`);
            values.push(hashedPassword);
        }
        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name || null);
        }
        if (data.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(data.status);
        }
        if (data.limitDocument !== undefined) {
            updates.push(`limit_document = $${paramIndex++}`);
            values.push(data.limitDocument || null);
        }
        if (data.limitSizePdf !== undefined) {
            updates.push(`limit_size_pdf = $${paramIndex++}`);
            values.push(data.limitSizePdf || null);
        }
        if (updates.length === 0) {
            return this.getById(userId);
        }
        updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);
        values.push(userId);
        const result = await this.fastify.db.query(`
        UPDATE users
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
      `, values);
        const row = result.rows[0];
        const roles = await this.userRepository.getUserRoles(row.id);
        // Безопасное преобразование дат
        const createdAt = row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : new Date(row.createdAt).toISOString();
        const updatedAt = row.updatedAt instanceof Date
            ? row.updatedAt.toISOString()
            : new Date(row.updatedAt).toISOString();
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            name: row.name,
            status: row.status,
            limitDocument: row.limit_document ?? null,
            limitSizePdf: row.limit_size_pdf ?? null,
            roles,
            createdAt,
            updatedAt,
        };
    }
    /**
     * Удалить пользователя
     */
    async delete(userId) {
        await this.getById(userId);
        await this.fastify.db.query(`
        DELETE FROM users
        WHERE id = $1
      `, [userId]);
    }
    /**
     * Назначить роль пользователю
     */
    async assignRole(userId, roleId) {
        // Проверка существования пользователя
        await this.getById(userId);
        // Проверка существования роли
        const roleResult = await this.fastify.db.query(`
        SELECT id FROM roles WHERE id = $1 AND status = true
      `, [roleId]);
        if (roleResult.rows.length === 0) {
            throw new app_error_1.NotFoundError("Role not found or inactive");
        }
        // Проверка, не назначена ли уже роль
        const existingResult = await this.fastify.db.query(`
        SELECT id FROM user_roles WHERE userid = $1 AND roleid = $2
      `, [userId, roleId]);
        if (existingResult.rows.length > 0) {
            throw new app_error_1.ValidationError("Role already assigned to user");
        }
        // Назначение роли
        await this.fastify.db.query(`
        INSERT INTO user_roles (userid, roleid)
        VALUES ($1, $2)
      `, [userId, roleId]);
    }
    /**
     * Удалить роль у пользователя
     */
    async removeRole(userId, roleId) {
        await this.getById(userId);
        const result = await this.fastify.db.query(`
        DELETE FROM user_roles
        WHERE userid = $1 AND roleid = $2
      `, [userId, roleId]);
        if (result.rowCount === 0) {
            throw new app_error_1.NotFoundError("Role not assigned to user");
        }
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map