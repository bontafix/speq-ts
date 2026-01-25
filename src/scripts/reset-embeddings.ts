import "../config/env-loader";
import { pgPool } from "../db/pg";

/**
 * Сбрасывает embeddings для переиндексации (worker заполнит заново).
 *
 * Использование:
 *   ts-node src/scripts/reset-embeddings.ts
 *
 * ВНИМАНИЕ: это обнуляет embedding для всех активных записей (и для неактивных тоже, если убрать WHERE).
 */
async function main() {
  const res = await pgPool.query(`
    UPDATE equipment
    SET embedding = NULL
  `);

  // eslint-disable-next-line no-console
  console.log(`OK: embeddings сброшены. Затронуто строк: ${res.rowCount ?? 0}`);

  await pgPool.end();
}

main().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  try {
    await pgPool.end();
  } catch {}
  process.exitCode = 1;
});


