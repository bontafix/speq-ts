import { pgPool } from "../db/pg";
import type { EquipmentSummary, SearchQuery } from "../catalog";

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
  /**
   * FTS-поиск по тексту и фильтрам.
   */
  async fullTextSearch(query: SearchQuery, limit: number): Promise<EquipmentSummary[]> {
    const values: any[] = [];
    const whereParts: string[] = ["is_active = true"];
    let rankExpression = "0::float4";

    // Текстовый поиск через tsvector-колонку search_vector
    if (query.text && query.text.trim()) {
      values.push(query.text.trim());
      const placeholder = `$${values.length}`;
      whereParts.push(`search_vector @@ plainto_tsquery('russian', ${placeholder})`);
      rankExpression = `ts_rank(search_vector, plainto_tsquery('russian', ${placeholder}))`;
    }

    if (query.category && query.category.trim()) {
      values.push(query.category.trim());
      whereParts.push(`category = $${values.length}`);
    }
    if (query.subcategory && query.subcategory.trim()) {
      values.push(query.subcategory.trim());
      whereParts.push(`subcategory = $${values.length}`);
    }
    if (query.brand && query.brand.trim()) {
      values.push(query.brand.trim());
      whereParts.push(`brand = $${values.length}`);
    }
    if (query.region && query.region.trim()) {
      values.push(query.region.trim());
      whereParts.push(`region = $${values.length}`);
    }

    // Обработка параметров из main_parameters (JSONB)
    if (query.parameters && Object.keys(query.parameters).length > 0) {
      for (const [key, value] of Object.entries(query.parameters)) {
        // Поддержка суффиксов _min и _max для диапазонов
        if (key.endsWith("_min")) {
          const paramKey = key.replace("_min", "");
          const numValue = typeof value === "string" ? parseFloat(value) : Number(value);
          if (!Number.isNaN(numValue)) {
            values.push(paramKey, numValue);
            const keyIndex = values.length - 1;
            const valueIndex = values.length;
            whereParts.push(
              `(main_parameters->>$${keyIndex})::numeric >= $${valueIndex}`,
            );
          }
        } else if (key.endsWith("_max")) {
          const paramKey = key.replace("_max", "");
          const numValue = typeof value === "string" ? parseFloat(value) : Number(value);
          if (!Number.isNaN(numValue)) {
            values.push(paramKey, numValue);
            const keyIndex = values.length - 1;
            const valueIndex = values.length;
            whereParts.push(
              `(main_parameters->>$${keyIndex})::numeric <= $${valueIndex}`,
            );
          }
        } else {
          // Точное совпадение (как строка или число)
          values.push(key, value);
          const keyIndex = values.length - 1;
          const valueIndex = values.length;
          whereParts.push(
            `main_parameters->>$${keyIndex} = $${valueIndex}::text`,
          );
        }
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    // Безопасное использование limit через параметр
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;

    const sql = `
      SELECT
        id::text AS id,
        name,
        category,
        brand,
        price,
        main_parameters AS "mainParameters"
      FROM equipment
      ${whereClause}
      ORDER BY ${rankExpression} DESC, name ASC
      LIMIT $${values.length + 1}
    `;

    const result = await pgPool.query(sql, [...values, safeLimit]);
    return result.rows;
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
   * Vector search с генерацией embedding запроса через LLM.
   * Это правильный способ использования векторного поиска.
   */
  async vectorSearchWithEmbedding(
    queryText: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<EquipmentSummary[]> {
    const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

    const sql = `
      SELECT
        id::text AS id,
        name,
        category,
        brand,
        price,
        main_parameters AS "mainParameters",
        1 - (embedding <=> $1::vector) AS similarity
      FROM equipment
      WHERE embedding IS NOT NULL
        AND is_active = true
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;

    try {
      const result = await pgPool.query(sql, [embeddingLiteral, limit]);
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
        id::text AS id,
        trim(
          concat_ws(
            ' ',
            name,
            category,
            subcategory,
            brand,
            region
          )
        ) AS "textToEmbed"
      FROM equipment
      WHERE embedding IS NULL
        AND is_active = true
      ORDER BY id
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

