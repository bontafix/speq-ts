import { Pool } from "pg";

// Простой клиент PostgreSQL без ORM.
// Параметры подключения берём из переменных окружения.

export const pgPool = new Pool({
  host: process.env.PGHOST ?? "localhost",
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD ?? "",
  database: process.env.PGDATABASE ?? "equipment_catalog",
});

export type DbIssueLevel = "error" | "warn";

export interface DbIssue {
  level: DbIssueLevel;
  message: string;
}

export interface DbHealth {
  ok: boolean;
  issues: DbIssue[];
}

/**
 * Проверка, что PostgreSQL доступен и есть основные объекты схемы.
 * Выполняется на старте CLI / HTTP API.
 */
export async function checkDatabaseHealth(): Promise<DbHealth> {
  const issues: DbIssue[] = [];

  // 1) Доступность подключения
  try {
    await pgPool.query("SELECT 1");
  } catch (err) {
    issues.push({
      level: "error",
      message: `Не удалось подключиться к PostgreSQL: ${String(err)}`,
    });
    return { ok: false, issues };
  }

  // 2) Наличие таблицы equipment
  try {
    const res = await pgPool.query<{
      exists: boolean;
    }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'equipment'
        ) AS exists
      `,
    );
    if (!res.rows[0]?.exists) {
      issues.push({
        level: "error",
        message: "Таблица public.equipment не найдена.",
      });
    }
  } catch (err) {
    issues.push({
      level: "warn",
      message: `Не удалось проверить наличие таблицы equipment: ${String(err)}`,
    });
  }

  // 3) Базовые колонки, которые использует код
  try {
    const res = await pgPool.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'equipment'
      `,
    );
    const cols = new Set(res.rows.map((r) => r.column_name));
    const required = ["id", "name", "category", "brand", "region", "search_vector", "embedding", "is_active", "main_parameters"];
    for (const col of required) {
      if (!cols.has(col)) {
        issues.push({
          level: col === "search_vector" || col === "embedding" ? "warn" : "error",
          message: `В таблице equipment отсутствует колонка "${col}".`,
        });
      }
    }
  } catch (err) {
    issues.push({
      level: "warn",
      message: `Не удалось проверить колонки таблицы equipment: ${String(err)}`,
    });
  }

  // 4) Наличие функции equipment_vector_search(text, int)
  try {
    const res = await pgPool.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'equipment_vector_search'
            AND n.nspname = 'public'
        ) AS exists
      `,
    );
    if (!res.rows[0]?.exists) {
      issues.push({
        level: "error",
        message:
          "Функция public.equipment_vector_search(text, int) не найдена. Создайте её или временно отключите vector search в коде.",
      });
    }
  } catch (err) {
    issues.push({
      level: "warn",
      message: `Не удалось проверить наличие функции equipment_vector_search: ${String(err)}`,
    });
  }

  const hasError = issues.some((i) => i.level === "error");
  return {
    ok: !hasError,
    issues,
  };
}

