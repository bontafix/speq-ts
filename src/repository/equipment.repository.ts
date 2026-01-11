import { pgPool } from "../db/pg";
import type { EquipmentSummary, SearchQuery } from "../catalog";
import { ParameterDictionaryService } from "../normalization/parameter-dictionary.service";

/**
 * EquipmentRepository — слой доступа к данным.
 * Здесь сконцентрированы SQL, FTS и pgvector.
 *
 * Пример реализации триггерной функции для FTS и схемы pgvector.
 *
 * 1) FTS: функция, которая заполняет search_vector при INSERT/UPDATE.
 *
 *   CREATE OR REPLACE FUNCTION equipment_search_vector_update()
 *   RETURNS trigger AS $$
 *   BEGIN
 *     NEW.search_vector :=
 *       setweight(to_tsvector('russian', coalesce(NEW.name, '')), 'A') ||
 *       setweight(to_tsvector('russian', coalesce(NEW.category, '')), 'B') ||
 *       setweight(to_tsvector('russian', coalesce(NEW.subcategory, '')), 'B') ||
 *       setweight(to_tsvector('russian', coalesce(NEW.brand, '')), 'C') ||
 *       setweight(to_tsvector('russian', coalesce(NEW.region, '')), 'C') ||
 *       setweight(to_tsvector('russian', coalesce(NEW.description, '')), 'D');
 *
 *     RETURN NEW;
 *   END;
 *   $$ LANGUAGE plpgsql;
 *
 *   CREATE TRIGGER equipment_search_vector_trigger
 *   BEFORE INSERT OR UPDATE ON equipment
 *   FOR EACH ROW EXECUTE FUNCTION equipment_search_vector_update();
 *
 * 2) Пример функции vector search (pgvector) на стороне БД:
 *
 *   -- Функция должна сама посчитать embedding для запроса
 *   -- через локальный сервис, background job и т.п.
 *   -- Здесь приведён упрощённый пример с фиктивным вектором.
 *
 *   CREATE OR REPLACE FUNCTION equipment_vector_search(p_query text, p_limit int)
 *   RETURNS SETOF equipment AS $$
 *   DECLARE
 *     q_embedding vector(768);
 *   BEGIN
 *     -- TODO: заменить на реальный вызов модели nomic-embed-text
 *     -- и заполнение q_embedding.
 *     q_embedding := (SELECT embedding FROM equipment WHERE embedding IS NOT NULL LIMIT 1);
 *
 *     RETURN QUERY
 *     SELECT e.*
 *     FROM equipment e
 *     WHERE e.embedding IS NOT NULL
 *     ORDER BY e.embedding <-> q_embedding
 *     LIMIT p_limit;
 *   END;
 *   $$ LANGUAGE plpgsql STABLE;
 *
 * 3) Пример безопасного полного переиндекса эмбеддингов с бэкапом:
 *
 *   -- Добавляем колонку-бэкап, если её ещё нет:
 *   ALTER TABLE equipment ADD COLUMN IF NOT EXISTS embedding_backup vector;
 *
 *   -- Делаем бэкап текущих эмбеддингов:
 *   UPDATE equipment
 *   SET embedding_backup = embedding
 *   WHERE embedding IS NOT NULL;
 *
 *   -- Обнуляем embedding, чтобы worker пересчитал все значения:
 *   UPDATE equipment
 *   SET embedding = NULL;
 *
 *   -- Запускаем worker из проекта (Node.js):
 *   --   npm run embed:equipment
 *
 *   -- После проверки, что новые эмбеддинги корректны,
 *   -- можно удалить бэкап:
 *   --   ALTER TABLE equipment DROP COLUMN embedding_backup;
 */
export interface EquipmentForEmbedding {
  id: string;
  textToEmbed: string;
}

export class EquipmentRepository {
  private dictionaryService: ParameterDictionaryService | undefined;

  constructor(dictionaryService?: ParameterDictionaryService) {
    this.dictionaryService = dictionaryService;
  }

  /**
   * Валидация имени параметра для безопасного использования в SQL.
   * Разрешаем только буквы (латиница + кириллица), цифры и подчеркивания.
   */
  private validateParameterKey(key: string): boolean {
    // Защита от SQL инъекций через имена параметров
    return /^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(key) && key.length > 0 && key.length < 100;
  }

  /**
   * Построение SQL условия для параметра.
   * 
   * ВАЖНО: Параметры УЖЕ нормализованы в SearchEngine через QueryParameterNormalizer.
   * Этот метод только определяет оператор и тип cast на основе суффикса.
   * 
   * @returns { paramKey, value, operator, sqlCast }
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
    // Параметры УЖЕ в canonical формате (например, "engine_power_kw_min")
    // Просто определяем оператор и cast
    
    let operator: '=' | '>=' | '<=' = '=';
    let sqlCast = typeof value === 'number' ? '::numeric' : '::text';
    let paramKey = key;

    // Определяем оператор из суффикса
    if (key.endsWith('_min')) {
      operator = '>=';
      sqlCast = '::numeric';
      paramKey = key.slice(0, -4); // Убираем суффикс _min
    } else if (key.endsWith('_max')) {
      operator = '<=';
      sqlCast = '::numeric';
      paramKey = key.slice(0, -4); // Убираем суффикс _max
    }

    // Валидация ключа (защита от SQL инъекций)
    if (!this.validateParameterKey(paramKey)) {
      console.warn(`[Security] Invalid parameter key: ${paramKey}`);
      return null;
    }

    // Пытаемся получить SQL expression из словаря (если доступен)
    if (this.dictionaryService) {
      try {
        const paramDef = this.dictionaryService.findCanonicalKey(paramKey);
        if (paramDef && paramDef.sql_expression) {
          // Извлекаем имя поля из sql_expression
          const fieldName = paramDef.sql_expression.match(/['"]([^'"]+)['"]/)?.[1];
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

    // Текстовый поиск через tsvector-колонку search_vector
    if (query.text && query.text.trim()) {
      values.push(query.text.trim());
      const placeholder = `$${values.length}`;
      whereParts.push(`e.search_vector @@ plainto_tsquery('russian', ${placeholder})`);
      rankExpression = `ts_rank(e.search_vector, plainto_tsquery('russian', ${placeholder}))`;
    }

    if (query.category && query.category.trim()) {
      // Раньше было строгое равенство, но LLM часто возвращает "Кран",
      // тогда как в БД категория может быть "Краны"/"Автокраны"/"Гусеничные краны".
      // Делаем мягкий матч по подстроке (case-insensitive).
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

    // Обработка параметров из main_parameters (JSONB)
    if (query.parameters && Object.keys(query.parameters).length > 0) {
      for (const [key, value] of Object.entries(query.parameters)) {
        // Параметры УЖЕ нормализованы в SearchEngine
        // Просто строим SQL условие
        const condition = this.buildParameterCondition(key, value);
        if (!condition) continue;
        
        const { paramKey, value: conditionValue, operator, sqlCast } = condition;
        
        // Добавляем условие в WHERE с параметризацией
      values.push(paramKey, conditionValue);
        const keyIndex = values.length - 1;
        const valueIndex = values.length;
        
      // Используем normalized_parameters для быстрого поиска по canonical параметрам
        whereParts.push(
        `(e.normalized_parameters->>$${keyIndex})${sqlCast} ${operator} $${valueIndex}`
        );
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    // Безопасное использование limit и offset через параметры
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

    const result = await pgPool.query(sql, [...values, safeLimit, safeOffset]);
    return result.rows;
  }

  /**
   * Подсчет общего количества записей, соответствующих запросу.
   * Использует те же WHERE условия, что и fullTextSearch.
   */
  async countEquipment(query: SearchQuery): Promise<number> {
    const values: any[] = [];
    const whereParts: string[] = ["e.is_active = true"];

    // Текстовый поиск через tsvector-колонку search_vector
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

    // Обработка параметров из main_parameters (JSONB)
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

    const result = await pgPool.query<{ total: number }>(sql, values);
    return result.rows[0]?.total ?? 0;
  }

  /**
   * Vector search (pgvector) по эмбеддингу запроса.
   * 
   * ВАЖНО: Этот метод требует передачи LLM провайдера для генерации embedding запроса.
   * Если провайдер не передан, используется упрощённая SQL-функция equipment_vector_search.
   * 
   * Для правильной работы рекомендуется использовать метод с провайдером:
   * vectorSearchWithProvider(query, limit, llmProvider)
   */
  async vectorSearch(query: SearchQuery, limit: number): Promise<EquipmentSummary[]> {
    if (!query.text || !query.text.trim()) {
      return [];
    }

    // Безопасное использование limit
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;

    // Пытаемся использовать SQL-функцию (упрощённая версия)
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
      const result = await pgPool.query(sql, values);
      return result.rows;
    } catch (err: any) {
      // Если vector search не работает (например, нет функции) — не роняем поиск,
      // а просто возвращаем пустой набор и остаёмся только на FTS.
      // eslint-disable-next-line no-console
      console.warn(
        `Ошибка vector search (equipment_vector_search): ${String(
          err,
        )}. Векторный поиск отключён для этого запроса, используется только FTS.`,
      );
      return [];
    }
  }

  /**
   * Валидация embedding вектора перед использованием в SQL.
   * Проверяет, что это массив чисел правильной размерности.
   */
  private validateEmbedding(embedding: number[], expectedDim: number = 768): boolean {
    // Проверяем, что это массив
    if (!Array.isArray(embedding)) {
      return false;
    }
    
    // Проверяем размерность
    if (embedding.length !== expectedDim) {
      console.warn(`[Security] Invalid embedding dimension: expected ${expectedDim}, got ${embedding.length}`);
      return false;
    }
    
    // Проверяем, что все элементы - валидные числа
    for (let i = 0; i < embedding.length; i++) {
      if (typeof embedding[i] !== 'number' || !Number.isFinite(embedding[i])) {
        console.warn(`[Security] Invalid embedding value at index ${i}: ${embedding[i]}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Vector search с генерацией embedding запроса через LLM.
   * Это правильный способ использования векторного поиска.
   * 
   * @param queryText - текст запроса
   * @param queryEmbedding - вектор embedding
   * @param limit - количество результатов
   * @param filters - дополнительные фильтры (category, brand, region, parameters)
   */
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
    // Валидация embedding для защиты от инъекций и некорректных данных
    if (!this.validateEmbedding(queryEmbedding, 768)) {
      console.error('[Security] Invalid embedding provided, aborting vector search');
      return [];
    }
    
    const embeddingLiteral = `[${queryEmbedding.join(",")}]`;
    
    // Формируем дополнительные WHERE условия
    const whereParts: string[] = [
      "e.embedding IS NOT NULL",
      "e.is_active = true"
    ];
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
    const params: any[] = [embeddingLiteral, safeLimit, safeOffset];
    
    if (filters?.category && filters.category.trim()) {
      // Как и в FTS: делаем мягкий матч по подстроке (LLM часто дает "Бульдозер",
      // а в БД может быть "Бульдозеры"/"Колесные бульдозеры" и т.п.)
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
    
    // Обработка параметров (JSONB)
    if (filters?.parameters && Object.keys(filters.parameters).length > 0) {
      for (const [key, value] of Object.entries(filters.parameters)) {
        // Параметры УЖЕ нормализованы в SearchEngine
        const condition = this.buildParameterCondition(key, value);
        if (!condition) continue;
        
        const { paramKey, value: conditionValue, operator, sqlCast } = condition;
        
        params.push(paramKey, conditionValue);
        // Используем normalized_parameters для быстрого поиска по canonical параметрам
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
        1 - (e.embedding <=> $1::vector) AS similarity
      FROM equipment e
      INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
      WHERE ${whereParts.join(" AND ")}
      ORDER BY e.embedding <=> $1::vector
      LIMIT $2 OFFSET $3
    `;

    try {
      if (process.env.DEBUG || process.env.DEBUG_SEARCH) {
        console.log('\n--- Vector Search SQL Log ---');
        console.log('SQL:', sql.replace(/\s+/g, ' ').trim());
        console.log('Params (except vector):', params.slice(1).map((p, i) => `$${i+2}=${p}`).join(', '));
        console.log('-----------------------------\n');
      }
      
      const result = await pgPool.query(sql, params);
      return result.rows;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`Ошибка vector search с embedding: ${String(err)}`);
      return [];
    }
  }

  /**
   * Найти объекты каталога без эмбеддинга для offline-обработки.
   * Текст для эмбеддинга формируется из основных полей (name, category, brand и т.п.).
   */
  async findWithoutEmbedding(limit: number): Promise<EquipmentForEmbedding[]> {
    const sql = `
      SELECT
        e.id::text AS id,
        trim(
          concat_ws(
            ' ',
            e.name,
            e.category,
            e.brand,
            e.region
          )
        ) AS "textToEmbed"
      FROM equipment e
      INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
      WHERE e.embedding IS NULL
        AND e.is_active = true
      ORDER BY e.id
      LIMIT $1
    `;

    const result = await pgPool.query(sql, [limit]);
    return result.rows as EquipmentForEmbedding[];
  }

  /**
   * Сохранить эмбеддинг для конкретной записи.
   * Ожидается, что размер эмбеддинга совпадает с размером vector(N) в БД.
   */
  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    // Валидация embedding для защиты от инъекций и некорректных данных
    if (!this.validateEmbedding(embedding, 768)) {
      throw new Error(`Invalid embedding for id ${id}: must be array of 768 valid numbers`);
    }
    
    const literal = `[${embedding.join(",")}]`;
    // Поддержка как integer id (serial4), так и text id
    const idParam = /^\d+$/.test(id) ? parseInt(id, 10) : id;
    await pgPool.query(
      `
        UPDATE equipment
        SET embedding = $2::vector
        WHERE id = $1
      `,
      [idParam, literal],
    );
  }
}

