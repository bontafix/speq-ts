import { FastifyRequest, FastifyReply } from "fastify";
import { UserService, CreateUserData, UpdateUserData, User } from "./user.service";
import { sendSuccess } from "../../shared/utils/api-response";

/**
 * Интерфейс параметров пути
 */
interface UserParams {
  id: string;
}

interface RoleParams extends UserParams {
  roleId: string;
}

/**
 * Контроллер управления пользователями
 */
export class UserController {
  constructor(private service: UserService) {}

  /**
   * Получить всех пользователей
   */
  async getAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const users = await this.service.getAll();
    sendSuccess<User[]>(reply, users);
  }

  /**
   * Получить пользователя по ID
   */
  async getById(
    request: FastifyRequest<{ Params: UserParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new Error("Invalid user ID");
    }
    const user = await this.service.getById(userId);
    sendSuccess<User>(reply, user);
  }

  /**
   * Создать пользователя
   */
  async create(
    request: FastifyRequest<{ Body: CreateUserData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const data = request.body;
    const user = await this.service.create(data);
    sendSuccess<User>(reply, user, 201);
  }

  /**
   * Обновить пользователя
   */
  async update(
    request: FastifyRequest<{ Params: UserParams; Body: UpdateUserData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new Error("Invalid user ID");
    }
    const data = request.body;
    const user = await this.service.update(userId, data);
    sendSuccess<User>(reply, user);
  }

  /**
   * Удалить пользователя
   */
  async delete(
    request: FastifyRequest<{ Params: UserParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new Error("Invalid user ID");
    }
    await this.service.delete(userId);
    reply.status(204).send();
  }

  /**
   * Назначить роль пользователю
   */
  async assignRole(
    request: FastifyRequest<{ Params: UserParams; Body: { roleId: number } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new Error("Invalid user ID");
    }
    const { roleId } = request.body;
    await this.service.assignRole(userId, roleId);
    reply.status(204).send();
  }

  /**
   * Удалить роль у пользователя
   */
  async removeRole(
    request: FastifyRequest<{ Params: RoleParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id, roleId } = request.params;
    const userId = parseInt(id, 10);
    const roleIdNum = parseInt(roleId, 10);
    if (isNaN(userId) || isNaN(roleIdNum)) {
      throw new Error("Invalid user ID or role ID");
    }
    await this.service.removeRole(userId, roleIdNum);
    reply.status(204).send();
  }
}
