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
export class UserRepository {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Получить роли пользователя
   */
  async getUserRoles(userId: number): Promise<string[]> {
    const result = await this.fastify.db.query<{ name: string }>(
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

  /**
   * Найти пользователя по username или email
   */
  async findUserByUsernameOrEmail(
    username?: string,
    email?: string,
  ): Promise<UserRow | null> {
    if (username) {
      const result = await this.fastify.db.query<{
        id: number;
        username: string | null;
        email: string | null;
        password: string | null;
        name: string | null;
        status: boolean | null;
        limit_document: number | null;
        limit_size_pdf: number | null;
        createdAt: Date;
        updatedAt: Date;
      }>(
        `
          SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
          FROM users
          WHERE username = $1
        `,
        [username],
      );
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
      const result = await this.fastify.db.query<{
        id: number;
        username: string | null;
        email: string | null;
        password: string | null;
        name: string | null;
        status: boolean | null;
        limit_document: number | null;
        limit_size_pdf: number | null;
        createdAt: Date;
        updatedAt: Date;
      }>(
        `
          SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
          FROM users
          WHERE email = $1
        `,
        [email],
      );
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
  async findUserByUsernameOrEmailBasic(
    username?: string,
    email?: string,
  ): Promise<UserRow | null> {
    if (username) {
      const result = await this.fastify.db.query<{
        id: number;
        username: string | null;
        email: string | null;
        password: string | null;
        name: string | null;
        status: boolean | null;
        createdAt: Date;
        updatedAt: Date;
      }>(
        `
          SELECT id, username, email, password, name, status, "createdAt", "updatedAt"
          FROM users
          WHERE username = $1
        `,
        [username],
      );
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
      const result = await this.fastify.db.query<{
        id: number;
        username: string | null;
        email: string | null;
        password: string | null;
        name: string | null;
        status: boolean | null;
        createdAt: Date;
        updatedAt: Date;
      }>(
        `
          SELECT id, username, email, password, name, status, "createdAt", "updatedAt"
          FROM users
          WHERE email = $1
        `,
        [email],
      );
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
