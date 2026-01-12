import { FastifyRequest, FastifyReply } from "fastify";
import { UsersService } from "./users.service";
import { CreateUserRequest, UpdateUserRequest } from "./users.types";
import { sendSuccess } from "../../shared/utils/api-response";

/**
 * Контроллер для работы с пользователями
 */
export class UsersController {
  constructor(private service: UsersService) {}

  /**
   * Получить всех пользователей
   */
  async getAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const users = await this.service.getAll();
    sendSuccess(reply, users);
  }

  /**
   * Получить пользователя по ID
   */
  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      throw new Error("Invalid user ID");
    }
    const user = await this.service.getById(id);
    sendSuccess(reply, user);
  }

  /**
   * Создать пользователя
   */
  async create(
    request: FastifyRequest<{ Body: CreateUserRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const user = await this.service.create(request.body);
    sendSuccess(reply, user, 201);
  }

  /**
   * Обновить пользователя
   */
  async update(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      throw new Error("Invalid user ID");
    }
    const user = await this.service.update(id, request.body);
    sendSuccess(reply, user);
  }

  /**
   * Удалить пользователя
   */
  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      throw new Error("Invalid user ID");
    }
    await this.service.delete(id);
    sendSuccess(reply, { message: "User deleted successfully" });
  }

  /**
   * Назначить роль пользователю
   */
  async assignRole(
    request: FastifyRequest<{ Params: { id: string }; Body: { roleId: number } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = parseInt(request.params.id, 10);
    if (isNaN(userId)) {
      throw new Error("Invalid user ID");
    }
    await this.service.assignRole(userId, request.body.roleId);
    sendSuccess(reply, { message: "Role assigned successfully" });
  }

  /**
   * Удалить роль у пользователя
   */
  async removeRole(
    request: FastifyRequest<{ Params: { id: string; roleId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = parseInt(request.params.id, 10);
    const roleId = parseInt(request.params.roleId, 10);
    if (isNaN(userId) || isNaN(roleId)) {
      throw new Error("Invalid user ID or role ID");
    }
    await this.service.removeRole(userId, roleId);
    sendSuccess(reply, { message: "Role removed successfully" });
  }
}
