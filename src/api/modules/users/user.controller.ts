import { FastifyRequest, FastifyReply } from "fastify";
import { UserService, CreateUserData, UpdateUserData, User } from "./user.service";
import { sendSuccess } from "../../shared/utils/api-response";
import { parseId } from "../../shared/utils/validation";

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
    const userId = parseId(id, 'user');
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
    const userId = parseId(id, 'user');
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
    const userId = parseId(id, 'user');
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
    const userId = parseId(id, 'user');
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
    const userId = parseId(id, 'user');
    const roleIdNum = parseId(roleId, 'role');
    await this.service.removeRole(userId, roleIdNum);
    reply.status(204).send();
  }
}
