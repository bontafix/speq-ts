import { FastifyInstance } from "fastify";
import { NotFoundError, ValidationError, InternalServerError } from "../../core/errors/app-error";
import { UpdateQueryBuilder } from "../../shared/utils/query-builder";
import { 
  ParameterDictionary, 
  ParameterDictionaryRow, 
  rowToParameterDictionary 
} from "../../../shared/types/parameter-dictionary";

export type { ParameterDictionary };

/**
 * Интерфейс данных создания параметра словаря
 */
export interface CreateParameterDictionaryData {
  key: string;
  labelRu: string;
  labelEn?: string | null;
  descriptionRu?: string | null;
  category: string;
  paramType: string;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  enumValues?: Record<string, string> | null;
  aliases?: string[] | null;
  sqlExpression: string;
  isSearchable?: boolean;
  isFilterable?: boolean;
  priority?: number;
  version?: string;
}

/**
 * Интерфейс данных обновления параметра словаря
 */
export interface UpdateParameterDictionaryData {
  labelRu?: string;
  labelEn?: string | null;
  descriptionRu?: string | null;
  category?: string;
  paramType?: string;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  enumValues?: Record<string, string> | null;
  aliases?: string[] | null;
  sqlExpression?: string;
  isSearchable?: boolean;
  isFilterable?: boolean;
  priority?: number;
  version?: string;
}

/**
 * Сервис управления параметрами словаря
 */
export class ParameterDictionaryService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Получить все параметры словаря
   */
  async getAll(): Promise<ParameterDictionary[]> {
    const result = await this.fastify.db.query<ParameterDictionaryRow>(
      `
        SELECT key, label_ru, label_en, description_ru, category, param_type, unit,
               min_value, max_value, enum_values, aliases, sql_expression,
               is_searchable, is_filterable, priority, version, created_at, updated_at
        FROM parameter_dictionary
        ORDER BY priority DESC, key
      `,
    );

    return result.rows.map(rowToParameterDictionary);
  }

  /**
   * Получить параметр словаря по ключу
   */
  async getByKey(key: string): Promise<ParameterDictionary> {
    const result = await this.fastify.db.query<ParameterDictionaryRow>(
      `
        SELECT key, label_ru, label_en, description_ru, category, param_type, unit,
               min_value, max_value, enum_values, aliases, sql_expression,
               is_searchable, is_filterable, priority, version, created_at, updated_at
        FROM parameter_dictionary
        WHERE key = $1
      `,
      [key],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Parameter dictionary entry not found");
    }

    const row = result.rows[0];
    // Дополнительная проверка для TypeScript, чтобы исключить undefined
    if (!row) {
      throw new InternalServerError("Failed to load parameter dictionary entry");
    }

    return rowToParameterDictionary(row);
  }

  /**
   * Создать параметр словаря
   */
  async create(data: CreateParameterDictionaryData): Promise<ParameterDictionary> {
    if (!data.key || data.key.trim().length === 0) {
      throw new ValidationError("Key is required");
    }
    if (!data.labelRu || data.labelRu.trim().length === 0) {
      throw new ValidationError("LabelRu is required");
    }
    if (!data.category || data.category.trim().length === 0) {
      throw new ValidationError("Category is required");
    }
    if (!data.paramType || data.paramType.trim().length === 0) {
      throw new ValidationError("ParamType is required");
    }
    if (!data.sqlExpression || data.sqlExpression.trim().length === 0) {
      throw new ValidationError("SqlExpression is required");
    }

    // Проверка существования
    const existing = await this.fastify.db.query<{ key: string }>(
      `SELECT key FROM parameter_dictionary WHERE key = $1`,
      [data.key],
    );
    if (existing.rows.length > 0) {
      throw new ValidationError("Parameter dictionary entry with this key already exists");
    }

    const result = await this.fastify.db.query<ParameterDictionaryRow>(
      `
        INSERT INTO parameter_dictionary (
          key, label_ru, label_en, description_ru, category, param_type, unit,
          min_value, max_value, enum_values, aliases, sql_expression,
          is_searchable, is_filterable, priority, version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING key, label_ru, label_en, description_ru, category, param_type, unit,
                  min_value, max_value, enum_values, aliases, sql_expression,
                  is_searchable, is_filterable, priority, version, created_at, updated_at
      `,
      [
        data.key,
        data.labelRu,
        data.labelEn ?? null,
        data.descriptionRu ?? null,
        data.category,
        data.paramType,
        data.unit ?? null,
        data.minValue ?? null,
        data.maxValue ?? null,
        data.enumValues ? JSON.stringify(data.enumValues) : null,
        data.aliases ? JSON.stringify(data.aliases) : null,
        data.sqlExpression,
        data.isSearchable ?? true,
        data.isFilterable ?? true,
        data.priority ?? 0,
        data.version ?? "1.0.0",
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new InternalServerError("Failed to create parameter dictionary entry");
    }
    return rowToParameterDictionary(row);
  }

  /**
   * Обновить параметр словаря
   */
  async update(key: string, data: UpdateParameterDictionaryData): Promise<ParameterDictionary> {
    // Проверка существования
    await this.getByKey(key);

    const builder = new UpdateQueryBuilder();
    builder.addFieldSnakeCase('labelRu', data.labelRu);
    builder.addFieldSnakeCase('labelEn', data.labelEn);
    builder.addFieldSnakeCase('descriptionRu', data.descriptionRu);
    builder.addField('category', data.category);
    builder.addFieldSnakeCase('paramType', data.paramType);
    builder.addField('unit', data.unit);
    builder.addFieldSnakeCase('minValue', data.minValue);
    builder.addFieldSnakeCase('maxValue', data.maxValue);
    builder.addFieldSnakeCase('sqlExpression', data.sqlExpression);
    builder.addFieldSnakeCase('isSearchable', data.isSearchable);
    builder.addFieldSnakeCase('isFilterable', data.isFilterable);
    builder.addField('priority', data.priority);
    builder.addField('version', data.version);

    if (data.enumValues !== undefined) {
      builder.addFieldSnakeCase('enumValues', data.enumValues ? JSON.stringify(data.enumValues) : null);
    }
    if (data.aliases !== undefined) {
      builder.addField('aliases', data.aliases ? JSON.stringify(data.aliases) : null);
    }
    
    if (!builder.hasUpdates()) {
      return this.getByKey(key);
    }

    builder.addTimestamp('updated_at');

    const { sql, values } = builder.build('parameter_dictionary', 'key', key);

    const result = await this.fastify.db.query<ParameterDictionaryRow>(sql, values);

    const row = result.rows[0];
    if (!row) {
      throw new InternalServerError("Failed to update parameter dictionary entry");
    }
    return rowToParameterDictionary(row);
  }

  /**
   * Удалить параметр словаря
   */
  async delete(key: string): Promise<void> {
    await this.getByKey(key);

    await this.fastify.db.query(
      `
        DELETE FROM parameter_dictionary
        WHERE key = $1
      `,
      [key],
    );
  }
}
