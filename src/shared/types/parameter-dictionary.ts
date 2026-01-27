/**
 * Общий интерфейс для parameter dictionary
 * Используется как в API, так и в нормализации
 */
export interface ParameterDictionary {
  key: string;
  labelRu: string;
  labelEn: string | null;
  descriptionRu: string | null;
  category: string;
  paramType: 'number' | 'enum' | 'boolean' | 'string';
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  enumValues: Record<string, string> | null;
  aliases: string[] | null;
  sqlExpression: string;
  isSearchable: boolean | null;
  isFilterable: boolean | null;
  priority: number | null;
  version: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Внутренний формат из БД (snake_case)
 */
export interface ParameterDictionaryRow {
  key: string;
  label_ru: string;
  label_en?: string | null;
  description_ru?: string | null;
  category: string;
  param_type: string;
  unit?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  enum_values?: any;
  aliases: any;
  sql_expression: string;
  is_searchable?: boolean | null;
  is_filterable?: boolean | null;
  priority: number | null;
  version?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Преобразует row из БД в ParameterDictionary
 */
export function rowToParameterDictionary(row: ParameterDictionaryRow): ParameterDictionary {
  return {
    key: row.key,
    labelRu: row.label_ru,
    labelEn: row.label_en ?? null,
    descriptionRu: row.description_ru ?? null,
    category: row.category,
    paramType: row.param_type as ParameterDictionary['paramType'],
    unit: row.unit ?? null,
    minValue: typeof row.min_value === 'string' ? parseFloat(row.min_value) : (row.min_value ?? null),
    maxValue: typeof row.max_value === 'string' ? parseFloat(row.max_value) : (row.max_value ?? null),
    enumValues: row.enum_values ?? null,
    aliases: Array.isArray(row.aliases) ? row.aliases : null,
    sqlExpression: row.sql_expression,
    isSearchable: row.is_searchable ?? null,
    isFilterable: row.is_filterable ?? null,
    priority: row.priority,
    version: row.version ?? null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}
