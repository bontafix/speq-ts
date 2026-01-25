import { Pool } from "pg";

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
 * Проверка здоровья базы данных
 */
export async function checkDatabaseHealth(pool: Pool): Promise<DbHealth> {
  const issues: DbIssue[] = [];

  // 1) Проверка подключения
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    issues.push({
      level: "error",
      message: `Не удалось подключиться к PostgreSQL: ${String(err)}`,
    });
    return { ok: false, issues };
  }

  // 2) Проверка наличия таблицы equipment
  try {
    const res = await pool.query<{ exists: boolean }>(
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

  // 3) Проверка основных колонок
  try {
    const res = await pool.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'equipment'
      `,
    );
    const cols = new Set(res.rows.map((r) => r.column_name));
    const required = ["id", "name", "category", "brand", "region", "is_active", "main_parameters"];
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

  const hasError = issues.some((i) => i.level === "error");
  return {
    ok: !hasError,
    issues,
  };
}
