import { FastifyInstance } from "fastify";
import { hashPassword } from "../../shared/utils/password";
import { NotFoundError, ValidationError } from "../../core/errors/app-error";
import { User, UserWithRoles, CreateUserRequest, UpdateUserRequest } from "./users.types";

/**
 * Сервис для работы с пользователями
 */
export class UsersService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Получить всех пользователей
   */
  async getAll(): Promise<User[]> {
    const result = await this.fastify.db.query<{
      id: number;
      username: string | null;
      email: string | null;
      name: string | null;
      status: boolean | null;
      limit_document: number | null;
      limit_size_pdf: number | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT id, username, email, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
       FROM users
       ORDER BY id`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      name: row.name,
      status: row.status,
      limit_document: row.limit_document,
      limit_size_pdf: row.limit_size_pdf,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /**
   * Получить пользователя по ID
   */
  async getById(id: number): Promise<UserWithRoles> {
    const result = await this.fastify.db.query<{
      id: number;
      username: string | null;
      email: string | null;
      name: string | null;
      status: boolean | null;
      limit_document: number | null;
      limit_size_pdf: number | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT id, username, email, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"
       FROM users
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("User not found");
    }

    const user = result.rows[0];

    // Загрузка ролей
    const rolesResult = await this.fastify.db.query<{
      id: number;
      name: string;
      title: string | null;
    }>(
      `SELECT r.id, r.name, r.title
       FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.roleid
       WHERE ur.userid = $1 AND r.status = true`,
      [user.id],
    );

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      status: user.status,
      limit_document: user.limit_document,
      limit_size_pdf: user.limit_size_pdf,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      roles: rolesResult.rows,
    };
  }

  /**
   * Создать пользователя
   */
  async create(data: CreateUserRequest): Promise<UserWithRoles> {
    // Проверка существования пользователя
    const existingUser = await this.fastify.db.query<{ id: number }>(
      `SELECT id FROM users WHERE username = $1 OR email = $2`,
      [data.username, data.email],
    );

    if (existingUser.rows.length > 0) {
      throw new ValidationError("User with this username or email already exists");
    }

    // Хеширование пароля
    const hashedPassword = await hashPassword(data.password);

    // Создание пользователя
    const result = await this.fastify.db.query<{
      id: number;
      username: string | null;
      email: string | null;
      name: string | null;
      status: boolean | null;
      limit_document: number | null;
      limit_size_pdf: number | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `INSERT INTO users (username, email, password, name, status, limit_document, limit_size_pdf)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, email, name, status, limit_document, limit_size_pdf, "createdAt", "updatedAt"`,
      [
        data.username,
        data.email,
        hashedPassword,
        data.name || null,
        data.status !== undefined ? data.status : true,
        data.limit_document || null,
        data.limit_size_pdf || null,
      ],
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error("Failed to create user");
    }

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      roles: [],
    };
  }

  /**
   * Обновить пользователя
   */
  async update(id: number, data: UpdateUserRequest): Promise<UserWithRoles> {
    // Проверка существования пользователя
    await this.getById(id);

    // Подготовка полей для обновления
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(data.email);
    }
    if (data.password !== undefined) {
      const hashedPassword = await hashPassword(data.password);
      updates.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.limit_document !== undefined) {
      updates.push(`limit_document = $${paramIndex++}`);
      values.push(data.limit_document);
    }
    if (data.limit_size_pdf !== undefined) {
      updates.push(`limit_size_pdf = $${paramIndex++}`);
      values.push(data.limit_size_pdf);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    values.push(id);

    await this.fastify.db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values,
    );

    return this.getById(id);
  }

  /**
   * Удалить пользователя
   */
  async delete(id: number): Promise<void> {
    const result = await this.fastify.db.query(
      `DELETE FROM users WHERE id = $1`,
      [id],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("User not found");
    }
  }

  /**
   * Назначить роль пользователю
   */
  async assignRole(userId: number, roleId: number): Promise<void> {
    // Проверка существования пользователя и роли
    await this.getById(userId);

    const roleResult = await this.fastify.db.query<{ id: number }>(
      `SELECT id FROM roles WHERE id = $1 AND status = true`,
      [roleId],
    );

    if (roleResult.rows.length === 0) {
      throw new NotFoundError("Role not found");
    }

    // Проверка, не назначена ли уже роль
    const existingRole = await this.fastify.db.query<{ id: number }>(
      `SELECT id FROM user_roles WHERE userid = $1 AND roleid = $2`,
      [userId, roleId],
    );

    if (existingRole.rows.length > 0) {
      throw new ValidationError("Role already assigned to user");
    }

    // Назначение роли
    await this.fastify.db.query(
      `INSERT INTO user_roles (userid, roleid) VALUES ($1, $2)`,
      [userId, roleId],
    );
  }

  /**
   * Удалить роль у пользователя
   */
  async removeRole(userId: number, roleId: number): Promise<void> {
    const result = await this.fastify.db.query(
      `DELETE FROM user_roles WHERE userid = $1 AND roleid = $2`,
      [userId, roleId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError("User role not found");
    }
  }
}
