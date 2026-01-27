import { FastifyRequest, FastifyReply } from "fastify";
import {
  BrandService,
  CreateBrandData,
  UpdateBrandData,
  Brand,
  PaginatedBrandResult,
} from "./brand.service";
import { sendSuccess } from "../../shared/utils/api-response";
import { parseId } from "../../shared/utils/validation";

/**
 * Интерфейс параметров пути
 */
interface BrandParams {
  id: string;
}

/**
 * Контроллер управления брендами
 */
export class BrandController {
  constructor(private service: BrandService) {}

  /**
   * Получить список брендов с пагинацией
   */
  async getAll(
    request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { page = 1, limit = 20 } = request.query || {};
    const result = await this.service.getAll(page, limit);
    sendSuccess<PaginatedBrandResult>(reply, result);
  }

  /**
   * Получить бренд по ID
   */
  async getById(
    request: FastifyRequest<{ Params: BrandParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const brandId = parseId(id, 'brand');
    const brand = await this.service.getById(brandId);
    sendSuccess<Brand>(reply, brand);
  }

  /**
   * Создать бренд
   */
  async create(
    request: FastifyRequest<{ Body: CreateBrandData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const data = request.body;
    const brand = await this.service.create(data);
    sendSuccess<Brand>(reply, brand, 201);
  }

  /**
   * Обновить бренд
   */
  async update(
    request: FastifyRequest<{ Params: BrandParams; Body: UpdateBrandData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const brandId = parseId(id, 'brand');
    const data = request.body;
    const brand = await this.service.update(brandId, data);
    sendSuccess<Brand>(reply, brand);
  }

  /**
   * Удалить бренд
   */
  async delete(
    request: FastifyRequest<{ Params: BrandParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const brandId = parseId(id, 'brand');
    await this.service.delete(brandId);
    reply.status(204).send();
  }
}
