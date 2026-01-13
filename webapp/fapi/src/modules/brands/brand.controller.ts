import { FastifyRequest, FastifyReply } from "fastify";
import { BrandService, CreateBrandData, UpdateBrandData, Brand } from "./brand.service";
import { sendSuccess } from "../../shared/utils/api-response";

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
   * Получить все бренды
   */
  async getAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const brands = await this.service.getAll();
    sendSuccess<Brand[]>(reply, brands);
  }

  /**
   * Получить бренд по ID
   */
  async getById(
    request: FastifyRequest<{ Params: BrandParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;
    const brandId = parseInt(id, 10);
    if (isNaN(brandId)) {
      throw new Error("Invalid brand ID");
    }
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
    const brandId = parseInt(id, 10);
    if (isNaN(brandId)) {
      throw new Error("Invalid brand ID");
    }
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
    const brandId = parseInt(id, 10);
    if (isNaN(brandId)) {
      throw new Error("Invalid brand ID");
    }
    await this.service.delete(brandId);
    reply.status(204).send();
  }
}
