import { FastifyRequest, FastifyReply } from "fastify";
import {
  CategoryService,
  CreateCategoryData,
  UpdateCategoryData,
  Category,
  PaginatedCategoryResult,
} from "./category.service";
import { sendSuccess } from "../../shared/utils/api-response";
import { parseId } from "../../shared/utils/validation";

/**
 * Интерфейс параметров пути
 */
interface CategoryParams {
  id: string;
}

/**
 * Контроллер управления категориями
 */
export class CategoryController {
  constructor(private service: CategoryService) {}

  /**
   * Получить список категорий с пагинацией
   */
  async getAll(
    request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { page = 1, limit = 20 } = request.query || {};
    const result = await this.service.getAll(page, limit);
    sendSuccess<PaginatedCategoryResult>(reply, result);
  }

  /**
   * Получить категорию по ID
   */
  async getById(
    request: FastifyRequest<{ Params: CategoryParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const categoryId = parseId(id, 'category');
    const category = await this.service.getById(categoryId);
    sendSuccess<Category>(reply, category);
  }

  /**
   * Создать категорию
   */
  async create(
    request: FastifyRequest<{ Body: CreateCategoryData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const data = request.body;
    const category = await this.service.create(data);
    sendSuccess<Category>(reply, category, 201);
  }

  /**
   * Обновить категорию
   */
  async update(
    request: FastifyRequest<{ Params: CategoryParams; Body: UpdateCategoryData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const categoryId = parseId(id, 'category');
    const data = request.body;
    const category = await this.service.update(categoryId, data);
    sendSuccess<Category>(reply, category);
  }

  /**
   * Удалить категорию
   */
  async delete(
    request: FastifyRequest<{ Params: CategoryParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const categoryId = parseId(id, 'category');
    await this.service.delete(categoryId);
    reply.status(204).send();
  }
}
