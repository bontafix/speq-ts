import { FastifyInstance } from "fastify";
import { NotFoundError, ValidationError } from "../../core/errors/app-error";

/**
 * Интерфейс параметра словаря для API
 */
export interface ParameterDictionary {
  key: string;
  labelRu: string;
  labelEn: string | null;
  descriptionRu: string | null;
  category: string;
  paramType: string;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  enumValues: string[] | null;
  aliases: string[] | null;
  sqlExpression: string;
  isSearchable: boolean | null;
  isFilterable: boolean | null;
  priority: number | null;
  version: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  enumValues?: string[] | null;
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
  enumValues?: string[] | null;
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
    const result = await this.fastify.db.query<{
      key: string;
      label_ru: string;
      label_en: string | null;
      description_ru: string | null;
      category: string;
      param_type: string;
      unit: string | null;
      min_value: number | null;
      max_value: number | null;
      enum_values: any;
      aliases: any;
      sql_expression: string;
      is_searchable: boolean | null;
      is_filterable: boolean | null;
      priority: number | null;
      version: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT key, label_ru, label_en, description_ru, category, param_type, unit,
               min_value, max_value, enum_values, aliases, sql_expression,
               is_searchable, is_filterable, priority, version, created_at, updated_at
        FROM parameter_dictionary
        ORDER BY priority DESC, key
      `,
    );

    return result.rows.map((row) => {
      const createdAt = row.created_at instanceof Date 
        ? row.created_at.toISOString() 
        : new Date(row.created_at).toISOString();
      const updatedAt = row.updated_at instanceof Date 
        ? row.updated_at.toISOString() 
        : new Date(row.updated_at).toISOString();

      return {
        key: row.key,
        labelRu: row.label_ru,
        labelEn: row.label_en,
        descriptionRu: row.description_ru,
        category: row.category,
        paramType: row.param_type,
        unit: row.unit,
        minValue: row.min_value,
        maxValue: row.max_value,
        enumValues: Array.isArray(row.enum_values) ? row.enum_values : null,
        aliases: Array.isArray(row.aliases) ? row.aliases : null,
        sqlExpression: row.sql_expression,
        isSearchable: row.is_searchable,
        isFilterable: row.is_filterable,
        priority: row.priority,
        version: row.version,
        createdAt,
        updatedAt,
      };
    });
  }

  /**
   * Получить параметр словаря по ключу
   */
  async getByKey(key: string): Promise<ParameterDictionary> {
    const result = await this.fastify.db.query<{
      key: string;
      label_ru: string;
      label_en: string | null;
      description_ru: string | null;
      category: string;
      param_type: string;
      unit: string | null;
      min_value: number | null;
      max_value: number | null;
      enum_values: any;
      aliases: any;
      sql_expression: string;
      is_searchable: boolean | null;
      is_filterable: boolean | null;
      priority: number | null;
      version: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
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

    const row = result.rows[0]!;
    const createdAt = row.created_at instanceof Date 
      ? row.created_at.toISOString() 
      : new Date(row.created_at).toISOString();
    const updatedAt = row.updated_at instanceof Date 
      ? row.updated_at.toISOString() 
      : new Date(row.updated_at).toISOString();

    return {
      key: row.key,
      labelRu: row.label_ru,
      labelEn: row.label_en,
      descriptionRu: row.description_ru,
      category: row.category,
      paramType: row.param_type,
      unit: row.unit,
      minValue: row.min_value,
      maxValue: row.max_value,
      enumValues: Array.isArray(row.enum_values) ? row.enum_values : null,
      aliases: Array.isArray(row.aliases) ? row.aliases : null,
      sqlExpression: row.sql_expression,
      isSearchable: row.is_searchable,
      isFilterable: row.is_filterable,
      priority: row.priority,
      version: row.version,
      createdAt,
      updatedAt,
    };
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

    const result = await this.fastify.db.query<{
      key: string;
      label_ru: string;
      label_en: string | null;
      description_ru: string | null;
      category: string;
      param_type: string;
      unit: string | null;
      min_value: number | null;
      max_value: number | null;
      enum_values: any;
      aliases: any;
      sql_expression: string;
      is_searchable: boolean | null;
      is_filterable: boolean | null;
      priority: number | null;
      version: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
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

    const row = result.rows[0]!;
    const createdAt = row.created_at instanceof Date 
      ? row.created_at.toISOString() 
      : new Date(row.created_at).toISOString();
    const updatedAt = row.updated_at instanceof Date 
      ? row.updated_at.toISOString() 
      : new Date(row.updated_at).toISOString();

    return {
      key: row.key,
      labelRu: row.label_ru,
      labelEn: row.label_en,
      descriptionRu: row.description_ru,
      category: row.category,
      paramType: row.param_type,
      unit: row.unit,
      minValue: row.min_value,
      maxValue: row.max_value,
      enumValues: Array.isArray(row.enum_values) ? row.enum_values : null,
      aliases: Array.isArray(row.aliases) ? row.aliases : null,
      sqlExpression: row.sql_expression,
      isSearchable: row.is_searchable,
      isFilterable: row.is_filterable,
      priority: row.priority,
      version: row.version,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Обновить параметр словаря
   */
  async update(key: string, data: UpdateParameterDictionaryData): Promise<ParameterDictionary> {
    // Проверка существования
    await this.getByKey(key);

    // Подготовка данных для обновления
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.labelRu !== undefined) {
      if (data.labelRu.trim().length === 0) {
        throw new ValidationError("LabelRu cannot be empty");
      }
      updates.push(`label_ru = $${paramIndex++}`);
      values.push(data.labelRu);
    }
    if (data.labelEn !== undefined) {
      updates.push(`label_en = $${paramIndex++}`);
      values.push(data.labelEn);
    }
    if (data.descriptionRu !== undefined) {
      updates.push(`description_ru = $${paramIndex++}`);
      values.push(data.descriptionRu);
    }
    if (data.category !== undefined) {
      if (data.category.trim().length === 0) {
        throw new ValidationError("Category cannot be empty");
      }
      updates.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }
    if (data.paramType !== undefined) {
      if (data.paramType.trim().length === 0) {
        throw new ValidationError("ParamType cannot be empty");
      }
      updates.push(`param_type = $${paramIndex++}`);
      values.push(data.paramType);
    }
    if (data.unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`);
      values.push(data.unit);
    }
    if (data.minValue !== undefined) {
      updates.push(`min_value = $${paramIndex++}`);
      values.push(data.minValue);
    }
    if (data.maxValue !== undefined) {
      updates.push(`max_value = $${paramIndex++}`);
      values.push(data.maxValue);
    }
    if (data.enumValues !== undefined) {
      updates.push(`enum_values = $${paramIndex++}`);
      values.push(data.enumValues ? JSON.stringify(data.enumValues) : null);
    }
    if (data.aliases !== undefined) {
      updates.push(`aliases = $${paramIndex++}`);
      values.push(data.aliases ? JSON.stringify(data.aliases) : null);
    }
    if (data.sqlExpression !== undefined) {
      if (data.sqlExpression.trim().length === 0) {
        throw new ValidationError("SqlExpression cannot be empty");
      }
      updates.push(`sql_expression = $${paramIndex++}`);
      values.push(data.sqlExpression);
    }
    if (data.isSearchable !== undefined) {
      updates.push(`is_searchable = $${paramIndex++}`);
      values.push(data.isSearchable);
    }
    if (data.isFilterable !== undefined) {
      updates.push(`is_filterable = $${paramIndex++}`);
      values.push(data.isFilterable);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(data.priority);
    }
    if (data.version !== undefined) {
      updates.push(`version = $${paramIndex++}`);
      values.push(data.version);
    }

    if (updates.length === 0) {
      return this.getByKey(key);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(key);

    const result = await this.fastify.db.query<{
      key: string;
      label_ru: string;
      label_en: string | null;
      description_ru: string | null;
      category: string;
      param_type: string;
      unit: string | null;
      min_value: number | null;
      max_value: number | null;
      enum_values: any;
      aliases: any;
      sql_expression: string;
      is_searchable: boolean | null;
      is_filterable: boolean | null;
      priority: number | null;
      version: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        UPDATE parameter_dictionary
        SET ${updates.join(", ")}
        WHERE key = $${paramIndex}
        RETURNING key, label_ru, label_en, description_ru, category, param_type, unit,
                  min_value, max_value, enum_values, aliases, sql_expression,
                  is_searchable, is_filterable, priority, version, created_at, updated_at
      `,
      values,
    );

    const row = result.rows[0]!;
    const createdAt = row.created_at instanceof Date 
      ? row.created_at.toISOString() 
      : new Date(row.created_at).toISOString();
    const updatedAt = row.updated_at instanceof Date 
      ? row.updated_at.toISOString() 
      : new Date(row.updated_at).toISOString();

    return {
      key: row.key,
      labelRu: row.label_ru,
      labelEn: row.label_en,
      descriptionRu: row.description_ru,
      category: row.category,
      paramType: row.param_type,
      unit: row.unit,
      minValue: row.min_value,
      maxValue: row.max_value,
      enumValues: Array.isArray(row.enum_values) ? row.enum_values : null,
      aliases: Array.isArray(row.aliases) ? row.aliases : null,
      sqlExpression: row.sql_expression,
      isSearchable: row.is_searchable,
      isFilterable: row.is_filterable,
      priority: row.priority,
      version: row.version,
      createdAt,
      updatedAt,
    };
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
