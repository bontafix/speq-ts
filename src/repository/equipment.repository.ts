import { Pool } from "pg";
import type { EquipmentSummary, SearchQuery } from "../catalog";
import { ParameterDictionaryService } from "../normalization/parameter-dictionary.service";

/**
 * EquipmentRepository — слой доступа к данным.
 * Здесь сконцентрированы SQL, FTS и pgvector.
 */
export interface EquipmentForEmbedding {
  id: string;
  textToEmbed: string;
}

export class EquipmentRepository {
  private dictionaryService: ParameterDictionaryService | undefined;

  constructor(private pool: Pool, dictionaryService?: ParameterDictionaryService) {
    this.dictionaryService = dictionaryService;
  }

  /**
   * Конфигурация "активного" embedding в зависимости от провайдера.
   * Для Ollama используем колонку embedding (VECTOR(768)),
   * для OpenAI — embedding_openai (VECTOR(1536)).
   */
  private getActiveEmbeddingConfig(): { column: "embedding" | "embedding_openai"; dim: number } {
    const provider = process.env.LLM_EMBEDDINGS_PROVIDER?.trim();
    if (provider === "openai") {
      return { column: "embedding_openai", dim: 1536 };
    }
    // По умолчанию считаем, что используем Ollama/LOCAL с 768-мерными векторами.
    return { column: "embedding", dim: 768 };
  }

  /**
   * Валидация имени параметра для безопасного использования в SQL.
   */
  private validateParameterKey(key: string): boolean {
    return /^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(key) && key.length > 0 && key.length < 100;
  }

  /**
   * Построение SQL условия для параметра.
   */
  private buildParameterCondition(
    key: string,
    value: string | number
  ): {
    paramKey: string;
    value: number | string;
    operator: '=' | '>=' | '<=';
    sqlCast: string;
  } | null {
    let operator: '=' | '>=' | '<=' = '=';
    let sqlCast = typeof value === 'number' ? '::numeric' : '::text';
    let paramKey = key;

    if (key.endsWith('_min')) {
      operator = '>=';
      sqlCast = '::numeric';
      paramKey = key.slice(0, -4);
    } else if (key.endsWith('_max')) {
      operator = '<=';
      sqlCast = '::numeric';
      paramKey = key.slice(0, -4);
    }

    if (!this.validateParameterKey(paramKey)) {
      console.warn(`[Security] Invalid parameter key: ${paramKey}`);
      return null;
    }

    if (this.dictionaryService) {
      try {
        const paramDef = this.dictionaryService.findCanonicalKey(paramKey);
        if (paramDef && paramDef.sqlExpression) {
          const fieldName = paramDef.sqlExpression.match(/['"]([^'"]+)['"]/)?.[1];
          if (fieldName) {
            paramKey = fieldName;
          }
        }
      } catch (error) {
        // Словарь не загружен - используем paramKey как есть
      }
    }

    if (process.env.DEBUG) {
      console.log(`[Repository] SQL condition: ${paramKey} ${operator} ${value}`);
    }

    return { paramKey, value, operator, sqlCast };
  }

  /**
   * FTS-поиск по тексту и фильтрам.
   */
  async fullTextSearch(query: SearchQuery, limit: number, offset: number = 0): Promise<EquipmentSummary[]> {
    const values: any[] = [];
    const whereParts: string[] = ["e.is_active = true"];
    let rankExpression = "0::float4";

    if (query.text && query.text.trim()) {
      values.push(query.text.trim());
      const placeholder = `$${values.length}`;
      whereParts.push(`e.search_vector @@ plainto_tsquery('russian', ${placeholder})`);
      rankExpression = `ts_rank(e.search_vector, plainto_tsquery('russian', ${placeholder}))`;
    }

    if (query.category && query.category.trim()) {
      values.push(`%${query.category.trim()}%`);
      whereParts.push(`e.category ILIKE $${values.length}`);
    }
    if (query.brand && query.brand.trim()) {
      values.push(query.brand.trim());
      whereParts.push(`e.brand = $${values.length}`);
    }
    if (query.region && query.region.trim()) {
      values.push(query.region.trim());
      whereParts.push(`e.region = $${values.length}`);
    }

    if (query.parameters && Object.keys(query.parameters).length > 0) {
      for (const [key, value] of Object.entries(query.parameters)) {
        const condition = this.buildParameterCondition(key, value);
        if (!condition) continue;
        
        const { paramKey, value: conditionValue, operator, sqlCast } = condition;
        
        values.push(paramKey, conditionValue);
        const keyIndex = values.length - 1;
        const valueIndex = values.length;
        
        whereParts.push(
        `(e.normalized_parameters->>$${keyIndex})${sqlCast} ${operator} $${valueIndex}`
        );
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;

    const sql = `
      SELECT
        e.id::text AS id,
        e.name,
        e.category,
        e.brand,
        e.price,
        e.main_parameters AS "mainParameters"
      FROM equipment e
      INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
      ${whereClause}
      ORDER BY ${rankExpression} DESC, e.name ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    if (process.env.DEBUG_SEARCH) {
      console.log('\n--- FTS SQL Log ---');
      console.log('Query:', sql.replace(/\s+/g, ' ').trim());
      console.log('Params:', [...values, safeLimit, safeOffset]);
      console.log('-------------------\n');
    }

    const result = await this.pool.query(sql, [...values, safeLimit, safeOffset]);
    return result.rows;
  }

  /**
   * Подсчет общего количества записей, соответствующих запросу.
   */
  async countEquipment(query: SearchQuery): Promise<number> {
    const values: any[] = [];
    const whereParts: string[] = ["e.is_active = true"];

    if (query.text && query.text.trim()) {
      values.push(query.text.trim());
      const placeholder = `$${values.length}`;
      whereParts.push(`e.search_vector @@ plainto_tsquery('russian', ${placeholder})`);
    }

    if (query.category && query.category.trim()) {
      values.push(`%${query.category.trim()}%`);
      whereParts.push(`e.category ILIKE $${values.length}`);
    }
    if (query.brand && query.brand.trim()) {
      values.push(query.brand.trim());
      whereParts.push(`e.brand = $${values.length}`);
    }
    if (query.region && query.region.trim()) {
      values.push(query.region.trim());
      whereParts.push(`e.region = $${values.length}`);
    }

    if (query.parameters && Object.keys(query.parameters).length > 0) {
      for (const [key, value] of Object.entries(query.parameters)) {
        const condition = this.buildParameterCondition(key, value);
        if (!condition) continue;
        
        const { paramKey, value: conditionValue, operator, sqlCast } = condition;
        
        values.push(paramKey, conditionValue);
        const keyIndex = values.length - 1;
        const valueIndex = values.length;
        
        whereParts.push(
          `(e.normalized_parameters->>$${keyIndex})${sqlCast} ${operator} $${valueIndex}`
        );
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const sql = `
      SELECT COUNT(*)::int AS total
      FROM equipment e
      INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
      ${whereClause}
    `;

    const result = await this.pool.query<{ total: number }>(sql, values);
    return result.rows[0]?.total ?? 0;
  }

  /**
   * Vector search (pgvector) по эмбеддингу запроса.
   */
  async vectorSearch(query: SearchQuery, limit: number): Promise<EquipmentSummary[]> {
    if (!query.text || !query.text.trim()) {
      return [];
    }

    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    const values: any[] = [query.text.trim(), safeLimit];

    const sql = `
      SELECT
        id::text AS id,
        name,
        category,
        brand,
        price,
        main_parameters AS "mainParameters"
      FROM equipment_vector_search($1, $2)
    `;

    try {
      const result = await this.pool.query(sql, values);
      return result.rows;
    } catch (err: any) {
      console.warn(
        `Ошибка vector search (equipment_vector_search): ${String(
          err,
        )}. Векторный поиск отключён для этого запроса, используется только FTS.`,
      );
      return [];
    }
  }

  private validateEmbedding(embedding: number[], expectedDim: number): boolean {
    if (!Array.isArray(embedding)) return false;
    if (embedding.length !== expectedDim) {
      console.warn(`[Security] Invalid embedding dimension: expected ${expectedDim}, got ${embedding.length}`);
      return false;
    }
    for (let i = 0; i < embedding.length; i++) {
      if (typeof embedding[i] !== 'number' || !Number.isFinite(embedding[i])) {
        console.warn(`[Security] Invalid embedding value at index ${i}: ${embedding[i]}`);
        return false;
      }
    }
    return true;
  }

  async vectorSearchWithEmbedding(
    queryText: string,
    queryEmbedding: number[],
    limit: number,
    filters?: {
      category?: string;
      brand?: string;
      region?: string;
      parameters?: Record<string, string | number>;
    },
    offset: number = 0
  ): Promise<EquipmentSummary[]> {
    const { column, dim } = this.getActiveEmbeddingConfig();

    if (!this.validateEmbedding(queryEmbedding, dim)) {
      console.error('[Security] Invalid embedding provided, aborting vector search');
      return [];
    }
    
    const embeddingLiteral = `[${queryEmbedding.join(",")}]`;
    const whereParts: string[] = [
      `e.${column} IS NOT NULL`,
      "e.is_active = true"
    ];
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
    const params: any[] = [embeddingLiteral, safeLimit, safeOffset];
    
    if (filters?.category && filters.category.trim()) {
      params.push(`%${filters.category.trim()}%`);
      whereParts.push(`e.category ILIKE $${params.length}`);
    }
    
    if (filters?.brand && filters.brand.trim()) {
      params.push(filters.brand.trim());
      whereParts.push(`e.brand = $${params.length}`);
    }
    
    if (filters?.region && filters.region.trim()) {
      params.push(filters.region.trim());
      whereParts.push(`e.region = $${params.length}`);
    }
    
    if (filters?.parameters && Object.keys(filters.parameters).length > 0) {
      for (const [key, value] of Object.entries(filters.parameters)) {
        const condition = this.buildParameterCondition(key, value);
        if (!condition) continue;
        
        const { paramKey, value: conditionValue, operator, sqlCast } = condition;
        
        params.push(paramKey, conditionValue);
        whereParts.push(
          `(e.normalized_parameters->>$${params.length - 1})${sqlCast} ${operator} $${params.length}`
        );
      }
    }

    const sql = `
      SELECT
        e.id::text AS id,
        e.name,
        e.category,
        e.brand,
        e.price,
        e.main_parameters AS "mainParameters",
        1 - (e.${column} <=> $1::vector) AS similarity
      FROM equipment e
      INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
      WHERE ${whereParts.join(" AND ")}
      ORDER BY e.${column} <=> $1::vector
      LIMIT $2 OFFSET $3
    `;

    try {
      if (process.env.DEBUG || process.env.DEBUG_SEARCH) {
        console.log('\n--- Vector Search SQL Log ---');
        console.log('SQL:', sql.replace(/\s+/g, ' ').trim());
        console.log('Params (except vector):', params.slice(1).map((p, i) => `$${i+2}=${p}`).join(', '));
        console.log('-----------------------------\n');
      }
      
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (err: any) {
      console.warn(`Ошибка vector search с embedding: ${String(err)}`);
      return [];
    }
  }

  async findWithoutEmbedding(limit: number): Promise<EquipmentForEmbedding[]> {
    const { column } = this.getActiveEmbeddingConfig();

    const sql = `
      SELECT
        e.id::text AS id,
        trim(
          concat_ws(
            ' ',
            e.name,
            e.category,
            e.brand,
            e.region,
            e.description
          )
        ) AS "textToEmbed"
      FROM equipment e
      INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
      WHERE e.${column} IS NULL
        AND e.is_active = true
      ORDER BY e.id
      LIMIT $1
    `;

    const result = await this.pool.query(sql, [limit]);
    return result.rows as EquipmentForEmbedding[];
  }

  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    const { column, dim } = this.getActiveEmbeddingConfig();

    if (!this.validateEmbedding(embedding, dim)) {
      throw new Error(`Invalid embedding for id ${id}: must be array of ${dim} valid numbers`);
    }
    
    const literal = `[${embedding.join(",")}]`;
    const idParam = /^\d+$/.test(id) ? parseInt(id, 10) : id;
    await this.pool.query(
      `
        UPDATE equipment
        SET ${column} = $2::vector
        WHERE id = $1
      `,
      [idParam, literal],
    );
  }
}
