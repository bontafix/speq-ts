
import "dotenv/config";
import { pgPool } from "../db/pg";
import { ParameterDictionaryService } from "../normalization/parameter-dictionary.service";
import { QueryParameterNormalizer } from "../normalization/query-parameter-normalizer";

async function main() {
  console.log("=== Debugging Bucket Volume Filter ===\n");

  // 1. Check Dictionary
  const dictionaryService = new ParameterDictionaryService();
  await dictionaryService.loadDictionary();
  
  const bucketParams = dictionaryService.getDictionary().filter(p => 
    p.label_ru.toLowerCase().includes("объем ковша") || 
    p.key.includes("bucket") ||
    p.aliases.some(a => a.toLowerCase().includes("объем ковша"))
  );

  console.log("Dictionary entries for Bucket Volume:");
  bucketParams.forEach(p => {
    console.log(`- Key: ${p.key}`);
    console.log(`  Label: ${p.label_ru}`);
    console.log(`  Aliases: ${JSON.stringify(p.aliases)}`);
    console.log(`  Type: ${p.param_type}, Unit: ${p.unit}`);
    console.log("---");
  });

  // 2. Test Normalization
  const normalizer = new QueryParameterNormalizer(dictionaryService);
  const inputQuery = {
    text: "колесный экскаватор",
    category: "Экскаватор",
    subcategory: "Колесный",
    parameters: {
      "объем_ковша_min": 1
    }
  };

  console.log("\nInput Query Parameters:", JSON.stringify(inputQuery.parameters, null, 2));

  const result = normalizer.normalizeQuery(inputQuery);
  
  console.log("\nNormalized Parameters:", JSON.stringify(result.normalizedQuery.parameters, null, 2));
  console.log("Stats:", JSON.stringify(result.stats, null, 2));

  // 3. Test SQL Generation
  const values: any[] = [];
  const conditions = normalizer.buildSQLConditions(
    result.normalizedQuery.parameters || {},
    values
  );

  console.log("\nGenerated SQL Conditions:");
  conditions.forEach(c => console.log(`- ${c}`));
  console.log("Values:", values);

  await pgPool.end();
}

main().catch(console.error);

