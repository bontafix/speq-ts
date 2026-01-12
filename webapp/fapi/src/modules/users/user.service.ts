import { FastifyInstance } from "fastify";
import { hashPassword } from "../../shared/lib/password";
import { NotFoundError, ValidationError } from "../../core/errors/app-error";

/**
 * Интерфейс данных пользователя из БД
 */
interface UserRow {
  id: number;
  username: string | null;
  email: string | null;
  password: string | null;
  name: string | null;
  status: boolean | null;
  limit_document: number | null;
  limit_size_pdf: number | null;
  createdat: Date;
  updatedat: Date;
}

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
export class UserService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Получить всех пользователей
   */
  async getAll(): Promise<User[]> {
    const result = await this.fastify.db.query<UserRow>(
      `
        SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
        FROM users
        ORDER BY id
      `,
    );

    const users: User[] = [];

    for (const row of result.rows) {
      const roles = await this.getUserRoles(row.id);
      users.push({
        id: row.id,
        username: row.username,
        email: row.email,
        name: row.name,
        status: row.status,
        limitDocument: row.limit_document,
        limitSizePdf: row.limit_size_pdf,
        roles,
        createdAt: row.createdat.toISOString(),
        updatedAt: row.updatedat.toISOString(),
      });
    }

    return users;
  }

  /**
   * Получить пользователя по ID
   */
  async getById(userId: number): Promise<User> {
    const result = await this.fastify.db.query<UserRow>(
      `
        SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
        FROM users
        WHERE id = $1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("User not found");
    }

    const row = result.rows[0];
    const roles = await this.getUserRoles(row.id);

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      name: row.name,
      status: row.status,
      limitDocument: row.limit_document,
      limitSizePdf: row.limit_size_pdf,
      roles,
      createdAt: row.createdat.toISOString(),
      updatedAt: row.updatedat.toISOString(),
    };
  }

  /**
   * Создать пользователя
   */
  async create(data: CreateUserData): Promise<User> {
    if (!data.username && !data.email) {
      throw new ValidationError("Username or email is required");
    }
    if (!data.password || data.password.length < 6) {
      throw new ValidationError("Password must be at least 6 characters");
    }

    // Проверка существования
    const existing = await this.findUserByUsernameOrEmail(
      data.username || undefined,
      data.email || undefined,
    );
    if (existing) {
      throw new ValidationError("User with this username or email already exists");
    }

    // Хеширование пароля
    const hashedPassword = await hashPassword(data.password);

    // Создание
    const result = await this.fastify.db.query<UserRow>(
      `
        INSERT INTO users (username, email, password, name, status, limit_document, limit_size_pdf)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
      `,
      [
        data.username || null,
        data.email || null,
        hashedPassword,
        data.name || null,
        data.status ?? true,
        data.limitDocument || null,
        data.limitSizePdf || null,
      ],
    );

    const row = result.rows[0];
    const roles = await this.getUserRoles(row.id);

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      name: row.name,
      status: row.status,
      limitDocument: row.limit_document,
      limitSizePdf: row.limit_size_pdf,
      roles,
      createdAt: row.createdat.toISOString(),
      updatedAt: row.updatedat.toISOString(),
    };
  }

  /**
   * Обновить пользователя
   */
  async update(userId: number, data: UpdateUserData): Promise<User> {
    // Проверка существования
    await this.getById(userId);

    // Проверка уникальности username/email если они меняются
    if (data.username || data.email) {
      const existing = await this.findUserByUsernameOrEmail(
        data.username || undefined,
        data.email || undefined,
      );
      if (existing && existing.id !== userId) {
        throw new ValidationError("User with this username or email already exists");
      }
    }

    // Подготовка данных для обновления
    const updates: string[] = [];
    const values: any[] = [];
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
      const hashedPassword = await hashPassword(data.password);
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

    const result = await this.fastify.db.query<UserRow>(
      `
        UPDATE users
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
      `,
      values,
    );

    const row = result.rows[0];
    const roles = await this.getUserRoles(row.id);

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      name: row.name,
      status: row.status,
      limitDocument: row.limit_document,
      limitSizePdf: row.limit_size_pdf,
      roles,
      createdAt: row.createdat.toISOString(),
      updatedAt: row.updatedat.toISOString(),
    };
  }

  /**
   * Удалить пользователя
   */
  async delete(userId: number): Promise<void> {
    await this.getById(userId);

    await this.fastify.db.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [userId],
    );
  }

  /**
   * Назначить роль пользователю
   */
  async assignRole(userId: number, roleId: number): Promise<void> {
    // Проверка существования пользователя
    await this.getById(userId);

    // Проверка существования роли
    const roleResult = await this.fastify.db.query<{ id: number }>(
      `
        SELECT id FROM roles WHERE id = $1 AND status = true
      `,
      [roleId],
    );

    if (roleResult.rows.length === 0) {
      throw new NotFoundError("Role not found or inactive");
    }

    // Проверка, не назначена ли уже роль
    const existingResult = await this.fastify.db.query<{ id: number }>(
      `
        SELECT id FROM user_roles WHERE userid = $1 AND roleid = $2
      `,
      [userId, roleId],
    );

    if (existingResult.rows.length > 0) {
      throw new ValidationError("Role already assigned to user");
    }

    // Назначение роли
    await this.fastify.db.query(
      `
        INSERT INTO user_roles (userid, roleid)
        VALUES ($1, $2)
      `,
      [userId, roleId],
    );
  }

  /**
   * Удалить роль у пользователя
   */
  async removeRole(userId: number, roleId: number): Promise<void> {
    await this.getById(userId);

    const result = await this.fastify.db.query(
      `
        DELETE FROM user_roles
        WHERE userid = $1 AND roleid = $2
      `,
      [userId, roleId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("Role not assigned to user");
    }
  }

  /**
   * Получить роли пользователя
   */
  private async getUserRoles(userId: number): Promise<string[]> {
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
  private async findUserByUsernameOrEmail(
    username?: string,
    email?: string,
  ): Promise<UserRow | null> {
    if (username) {
      const result = await this.fastify.db.query<UserRow>(
        `
          SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
          FROM users
          WHERE username = $1
        `,
        [username],
      );
      if (result.rows.length > 0) {
        return result.rows[0];
      }
    }

    if (email) {
      const result = await this.fastify.db.query<UserRow>(
        `
          SELECT id, username, email, password, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
          FROM users
          WHERE email = $1
        `,
        [email],
      );
      if (result.rows.length > 0) {
        return result.rows[0];
      }
    }

    return null;
  }
}
