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
    WHERE is_active = true
      AND category = $1
      AND (
        coalesce(description, '') ILIKE $2
        OR coalesce(main_parameters::text, '') ILIKE $2
      )
  `;

  const [countRes, itemsRes] = await Promise.all([
    pgPool.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM equipment
        ${where}
      `,
      [categoryName, like],
    ),
    pgPool.query<EquipmentListItem>(
      `
        SELECT
          id::text AS id,
          name,
          category,
          brand,
          description,
          main_parameters AS "mainParameters"
        FROM equipment
        ${where}
        ORDER BY name ASC
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
        id::text AS id,
        name,
        category,
        brand,
        description,
        main_parameters AS "mainParameters"
      FROM equipment
      WHERE is_active = true
        AND id::text = $1
      LIMIT 1
    `,
    [id],
  );
  return res.rows[0] ?? null;
}


