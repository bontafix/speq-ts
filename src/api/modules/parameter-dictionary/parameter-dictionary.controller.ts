import { FastifyRequest, FastifyReply } from "fastify";
import {
  ParameterDictionaryService,
  CreateParameterDictionaryData,
  UpdateParameterDictionaryData,
  ParameterDictionary,
} from "./parameter-dictionary.service";
import { sendSuccess } from "../../shared/utils/api-response";

/**
 * Интерфейс параметров пути
 */
interface ParameterDictionaryParams {
  key: string;
}

/**
 * Контроллер управления параметрами словаря
 */
export class ParameterDictionaryController {
  constructor(private service: ParameterDictionaryService) {}

  /**
   * Получить все параметры словаря
   */
  async getAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parameters = await this.service.getAll();
    sendSuccess<ParameterDictionary[]>(reply, parameters);
  }

  /**
   * Получить параметр словаря по ключу
   */
  async getByKey(
    request: FastifyRequest<{ Params: ParameterDictionaryParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { key } = request.params;
    const parameter = await this.service.getByKey(key);
    sendSuccess<ParameterDictionary>(reply, parameter);
  }

  /**
   * Создать параметр словаря
   */
  async create(
    request: FastifyRequest<{ Body: CreateParameterDictionaryData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const data = request.body;
    const parameter = await this.service.create(data);
    sendSuccess<ParameterDictionary>(reply, parameter, 201);
  }

  /**
   * Обновить параметр словаря
   */
  async update(
    request: FastifyRequest<{ Params: ParameterDictionaryParams; Body: UpdateParameterDictionaryData }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { key } = request.params;
    const data = request.body;
    const parameter = await this.service.update(key, data);
    sendSuccess<ParameterDictionary>(reply, parameter);
  }

  /**
   * Удалить параметр словаря
   */
  async delete(
    request: FastifyRequest<{ Params: ParameterDictionaryParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { key } = request.params;
    await this.service.delete(key);
    reply.status(204).send();
  }
}
