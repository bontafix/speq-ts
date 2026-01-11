import { pgPool } from "../db/pg";
import type { EquipmentListItem } from "./view.format";

export interface TelegramSearchParams {
  categoryName: string;
  queryText: string;
  limit: number;
  offset: number;
}

export interface TelegramSearchResult {
  total: number;
  items: EquipmentListItem[];
}

export async function searchInCategory(params: TelegramSearchParams): Promise<TelegramSearchResult> {
  const categoryName = params.categoryName.trim();
  const queryText = params.queryText.trim();
  const limit = Number.isInteger(params.limit) && params.limit > 0 ? params.limit : 7;
  const offset = Number.isInteger(params.offset) && params.offset >= 0 ? params.offset : 0;

  // MVP: ILIKE по description и main_parameters::text.
  // Важно: seedText тут НЕ используется, как в ТЗ.
  const like = `%${queryText}%`;

  const where = `
    WHERE e.is_active = true
      AND e.category = $1
      AND (
        coalesce(e.description, '') ILIKE $2
        OR coalesce(e.main_parameters::text, '') ILIKE $2
      )
  `;

  const [countRes, itemsRes] = await Promise.all([
    pgPool.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM equipment e
        INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
        ${where}
      `,
      [categoryName, like],
    ),
    pgPool.query<EquipmentListItem>(
      `
        SELECT
          e.id::text AS id,
          e.name,
          e.category,
          e.brand,
          e.description,
          e.main_parameters AS "mainParameters"
        FROM equipment e
        INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
        ${where}
        ORDER BY e.name ASC
        LIMIT $3 OFFSET $4
      `,
      [categoryName, like, limit, offset],
    ),
  ]);

  return {
    total: parseInt(countRes.rows[0]?.total ?? "0", 10) || 0,
    items: itemsRes.rows,
  };
}

export async function getEquipmentCardById(id: string): Promise<EquipmentListItem | null> {
  const res = await pgPool.query<EquipmentListItem>(
    `
      SELECT
        e.id::text AS id,
        e.name,
        e.category,
        e.brand,
        e.description,
        e.main_parameters AS "mainParameters"
      FROM equipment e
      INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
      WHERE e.is_active = true
        AND e.id::text = $1
      LIMIT 1
    `,
    [id],
  );
  return res.rows[0] ?? null;
}


