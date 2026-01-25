
import "../config/env-loader";
import { pgPool } from "../db/pg";

async function showNormalizedData() {
  console.log("=== SAMPLE NORMALIZED DATA ===\n");

  // Получим список категорий, чтобы взять разнообразные примеры
  const categoriesRes = await pgPool.query(`
    SELECT category, count(*) 
    FROM equipment 
    WHERE normalized_parameters IS NOT NULL AND normalized_parameters != '{}'::jsonb
    GROUP BY category 
    ORDER BY count(*) DESC 
    LIMIT 5
  `);

  const categories = categoriesRes.rows.map(r => r.category);

  for (const category of categories) {
    console.log(`\n--- Category: ${category} ---\n`);
    const sql = `
      SELECT 
        id, 
        name,
        main_parameters,
        normalized_parameters
      FROM equipment
      WHERE category = $1 
        AND normalized_parameters IS NOT NULL 
        AND normalized_parameters != '{}'::jsonb
      LIMIT 2;
    `;

    const result = await pgPool.query(sql, [category]);

    result.rows.forEach(row => {
      console.log(`ID: ${row.id} | Name: ${row.name}`);
      console.log("Raw (main_parameters):");
      console.log(JSON.stringify(row.main_parameters, null, 2));
      console.log("Normalized (normalized_parameters):");
      console.log(JSON.stringify(row.normalized_parameters, null, 2));
      console.log("-".repeat(40));
    });
  }

  // Также покажем статистику
  console.log("\n=== STATISTICS ===");
  const stats = await pgPool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN normalized_parameters IS NOT NULL AND normalized_parameters != '{}'::jsonb THEN 1 END) as with_normalized
    FROM equipment
  `);
  console.log(`Total items: ${stats.rows[0].total}`);
  console.log(`Items with normalized parameters: ${stats.rows[0].with_normalized}`);

  await pgPool.end();
}

showNormalizedData().catch(console.error);

