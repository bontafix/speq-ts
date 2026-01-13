import { FastifyRequest, FastifyReply } from "fastify";
import { CategoryService, CreateCategoryData, UpdateCategoryData, Category } from "./category.service";
import { sendSuccess } from "../../shared/utils/api-response";

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
   * Получить все категории
   */
  async getAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const categories = await this.service.getAll();
    sendSuccess<Category[]>(reply, categories);
  }

  /**
   * Получить категорию по ID
   */
  async getById(
    request: FastifyRequest<{ Params: CategoryParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      throw new Error("Invalid category ID");
    }
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
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      throw new Error("Invalid category ID");
    }
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
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      throw new Error("Invalid category ID");
    }
    await this.service.delete(categoryId);
    reply.status(204).send();
  }
}
