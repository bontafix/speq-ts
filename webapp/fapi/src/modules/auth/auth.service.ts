import { FastifyInstance } from "fastify";
import { hashPassword, comparePassword } from "../../shared/lib/password";
import { createToken, JwtPayload } from "../../shared/lib/jwt";
import { ValidationError, UnauthorizedError } from "../../core/errors/app-error";

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
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Интерфейс данных регистрации
 */
export interface RegisterData {
  username?: string;
  email?: string;
  password: string;
  name?: string;
}

/**
 * Интерфейс данных входа
 */
export interface LoginData {
  username?: string;
  email?: string;
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
export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Регистрация нового пользователя
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    // Валидация
    if (!data.username && !data.email) {
      throw new ValidationError("Username or email is required");
    }
    if (!data.password || data.password.length < 6) {
      throw new ValidationError("Password must be at least 6 characters");
    }

    // Проверка существования пользователя
    const existingUser = await this.findUserByUsernameOrEmail(
      data.username || undefined,
      data.email || undefined,
    );
    if (existingUser) {
      throw new ValidationError("User with this username or email already exists");
    }

    // Хеширование пароля
    const hashedPassword = await hashPassword(data.password);

    // Создание пользователя
    const result = await this.fastify.db.query<UserRow>(
      `
        INSERT INTO users (username, email, password, name, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, email, password, name, status, "createdAt", "updatedAt"
      `,
      [data.username || null, data.email || null, hashedPassword, data.name || null, true],
    );

    const userRow = result.rows[0];
    if (!userRow) {
      throw new ValidationError("Failed to create user");
    }
    const user = await this.getUserById(userRow.id);

    // Создание токена
    const token = createToken({
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
  async login(data: LoginData): Promise<AuthResponse> {
    if (!data.username && !data.email) {
      throw new ValidationError("Username or email is required");
    }
    if (!data.password) {
      throw new ValidationError("Password is required");
    }

    // Поиск пользователя
    const userRow = await this.findUserByUsernameOrEmail(
      data.username || undefined,
      data.email || undefined,
    );

    if (!userRow) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Проверка пароля
    if (!userRow.password) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const isPasswordValid = await comparePassword(data.password, userRow.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Проверка статуса
    if (userRow.status === false) {
      throw new UnauthorizedError("User account is disabled");
    }

    const user = await this.getUserById(userRow.id);

    // Создание токена
    const token = createToken({
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
  async getUserById(userId: number): Promise<User> {
    const result = await this.fastify.db.query<UserRow>(
      `
        SELECT id, username, email, password, name, status, "createdAt", "updatedAt"
        FROM users
        WHERE id = $1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new ValidationError("User not found");
    }

    const userRow = result.rows[0];
    if (!userRow) {
      throw new ValidationError("User not found");
    }

    // Получаем роли
    const rolesResult = await this.fastify.db.query<{ name: string }>(
      `
        SELECT r.name
        FROM user_roles ur
        JOIN roles r ON ur.roleid = r.id
        WHERE ur.userid = $1
          AND r.status = true
      `,
      [userId],
    );

    const roles = rolesResult.rows.map((row) => row.name);

    return {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      name: userRow.name,
      status: userRow.status,
      roles,
      createdAt: userRow.createdat.toISOString(),
      updatedAt: userRow.updatedat.toISOString(),
    };
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
          SELECT id, username, email, password, name, status, "createdAt", "updatedAt"
          FROM users
          WHERE username = $1
        `,
        [username],
      );
      if (result.rows.length > 0 && result.rows[0]) {
        return result.rows[0];
      }
    }

    if (email) {
      const result = await this.fastify.db.query<UserRow>(
        `
          SELECT id, username, email, password, name, status, "createdAt", "updatedAt"
          FROM users
          WHERE email = $1
        `,
        [email],
      );
      if (result.rows.length > 0 && result.rows[0]) {
        return result.rows[0];
      }
    }

    return null;
  }
}
