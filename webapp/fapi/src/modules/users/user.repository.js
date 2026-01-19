"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
/**
 * Репозиторий для работы с пользователями
 * Содержит общие методы для работы с БД
 */
class UserRepository {
    constructor(fastify) {
        this.fastify = fastify;
    }
    /**
     * Получить роли пользователя
     */
    async getUserRoles(userId) {
        const result = await this.fastify.db.query(`
        SELECT r.name
        FROM user_roles ur
        JOIN roles r ON ur.roleid = r.id
        WHERE ur.userid = $1
          AND r.status = true
      `, [userId]);
        return result.rows.map((row) => row.name);
    }
    /**
     * Найти пользователя по username или email
     */
    async findUserByUsernameOrEmail(username, email) {
        if (username) {
            const result = await this.fastify.db.query(`
          SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
          FROM users
          WHERE username = $1
        `, [username]);
            if (result.rows.length > 0 && result.rows[0]) {
                const row = result.rows[0];
                return {
                    id: row.id,
                    username: row.username,
                    email: row.email,
                    password: row.password,
                    name: row.name,
                    status: row.status,
                    limit_document: row.limit_document,
                    limit_size_pdf: row.limit_size_pdf,
                    createdat: row.createdAt,
                    updatedat: row.updatedAt,
                };
            }
        }
        if (email) {
            const result = await this.fastify.db.query(`
          SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
          FROM users
          WHERE email = $1
        `, [email]);
            if (result.rows.length > 0 && result.rows[0]) {
                const row = result.rows[0];
                return {
                    id: row.id,
                    username: row.username,
                    email: row.email,
                    password: row.password,
                    name: row.name,
                    status: row.status,
                    limit_document: row.limit_document,
                    limit_size_pdf: row.limit_size_pdf,
                    createdat: row.createdAt,
                    updatedat: row.updatedAt,
                };
            }
        }
        return null;
    }
    /**
     * Найти пользователя по username или email (без limit полей для auth)
     */
    async findUserByUsernameOrEmailBasic(username, email) {
        if (username) {
            const result = await this.fastify.db.query(`
          SELECT id, username, email, password, name, status, "createdAt", "updatedAt"
          FROM users
          WHERE username = $1
        `, [username]);
            if (result.rows.length > 0 && result.rows[0]) {
                const row = result.rows[0];
                return {
                    id: row.id,
                    username: row.username,
                    email: row.email,
                    password: row.password,
                    name: row.name,
                    status: row.status,
                    createdat: row.createdAt,
                    updatedat: row.updatedAt,
                };
            }
        }
        if (email) {
            const result = await this.fastify.db.query(`
          SELECT id, username, email, password, name, status, "createdAt", "updatedAt"
          FROM users
          WHERE email = $1
        `, [email]);
            if (result.rows.length > 0 && result.rows[0]) {
                const row = result.rows[0];
                return {
                    id: row.id,
                    username: row.username,
                    email: row.email,
                    password: row.password,
                    name: row.name,
                    status: row.status,
                    createdat: row.createdAt,
                    updatedat: row.updatedAt,
                };
            }
        }
        return null;
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=user.repository.js.map