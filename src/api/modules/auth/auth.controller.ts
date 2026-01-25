import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService, RegisterData, LoginData, AuthResponse } from "./auth.service";
import { sendSuccess } from "../../shared/utils/api-response";

/**
 * Контроллер авторизации
 */
export class AuthController {
  constructor(private service: AuthService) {}

  /**
   * Регистрация пользователя
   */
  async register(
    request: FastifyRequest<{ Body: RegisterData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const data = request.body;
    const result = await this.service.register(data);
    sendSuccess<AuthResponse>(reply, result, 201);
  }

  /**
   * Вход пользователя
   */
  async login(
    request: FastifyRequest<{ Body: LoginData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const data = request.body;
    const result = await this.service.login(data);
    sendSuccess<AuthResponse>(reply, result);
  }

  /**
   * Получить текущего пользователя
   */
  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user || typeof request.user === "string" || Buffer.isBuffer(request.user)) {
      throw new Error("User not authenticated");
    }

    // TypeScript guard: проверяем что user имеет нужную структуру
    const authenticatedUser = request.user as { userId: number; roles: string[] };
    const user = await this.service.getUserById(authenticatedUser.userId);
    sendSuccess(reply, user);
  }
}
