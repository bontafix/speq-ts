import { FastifyInstance } from "fastify";
import { hashPassword, comparePassword } from "../../shared/lib/password";
import { createToken, JwtPayload } from "../../shared/lib/jwt";
import { ValidationError, UnauthorizedError } from "../../core/errors/app-error";
import { UserRepository, UserRow } from "../users/user.repository";
import { formatDate } from "../../shared/utils/date";

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
  createdAt: string | null;
  updatedAt: string | null;
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
export class AuthService {
  private userRepository: UserRepository;

  constructor(private fastify: FastifyInstance) {
    this.userRepository = new UserRepository(fastify);
  }

  /**
   * Регистрация нового пользователя
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    // Валидация
    if (!data.email) {
      throw new ValidationError("Email is required");
    }
    if (!data.password || data.password.length < 6) {
      throw new ValidationError("Password must be at least 6 characters");
    }

    // Проверка существования пользователя
    const existingUser = await this.userRepository.findUserByUsernameOrEmailBasic(
      undefined,
      data.email,
    );
    if (existingUser) {
      throw new ValidationError("User with this email already exists");
    }

    // Хеширование пароля
    const hashedPassword = await hashPassword(data.password);

    // Создание пользователя
    const result = await this.fastify.db.query<UserRow>(
      `
        INSERT INTO users (email, password, name, status)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, password, name, status, "createdAt", "updatedAt"
      `,
      [data.email, hashedPassword, data.name || null, true],
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
    if (!data.email) {
      throw new ValidationError("Email is required");
    }
    if (!data.password) {
      throw new ValidationError("Password is required");
    }

    // Поиск пользователя по email
    const userRow = await this.userRepository.findUserByUsernameOrEmailBasic(
      undefined,
      data.email,
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
    const roles = await this.userRepository.getUserRoles(userId);

    return {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      name: userRow.name,
      status: userRow.status,
      roles,
      createdAt: formatDate(userRow.createdAt),
      updatedAt: formatDate(userRow.updatedAt),
    };
  }

}
