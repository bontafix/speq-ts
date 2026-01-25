
import "../config/env-loader";
import { pgPool } from "../db/pg";

async function main() {
  console.log("=== Checking Equipment Parameters ===\n");

  const sql = `
    SELECT 
      id, 
      name,
      category,
      subcategory,
      main_parameters,
      normalized_parameters
    FROM equipment
    WHERE name ILIKE '%SY65W%' 
       OR name ILIKE '%SY215W%'
       OR name ILIKE '%SY135C%'
    LIMIT 5;
  `;

  const result = await pgPool.query(sql);

  result.rows.forEach(row => {
    console.log(`ID: ${row.id}, Name: ${row.name}`);
    console.log(`Category: ${row.category}, Subcategory: ${row.subcategory || "N/A"}`);
    console.log("Raw Params:", JSON.stringify(row.main_parameters, null, 2));
    console.log("Normalized Params:", JSON.stringify(row.normalized_parameters, null, 2));
    console.log("---");
  });

  await pgPool.end();
}

main().catch(console.error);
