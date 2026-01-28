#!/usr/bin/env ts-node

import "../config/env-loader";
import { ParameterDictionaryService } from "../normalization/parameter-dictionary.service";

async function main() {
  const categoryArg = process.argv[2];
  const limitArg = process.argv[3];
  const category = categoryArg ? categoryArg.trim() : "";
  const limit = limitArg ? Number.parseInt(limitArg, 10) || 20 : 20;

  if (!category) {
    console.error(
      "Укажите категорию как первый аргумент. Пример:\n" +
      "  npm run print:category-params -- \"Кран\" 15",
    );
    process.exit(1);
  }

  const service = new ParameterDictionaryService();
  await service.loadDictionary();

  const items = service.getSearchableParametersByCategory(category, limit);

  console.log(`Категория: "${category}"`);
  console.log(`Найдено параметров: ${items.length} (limit=${limit})`);
  console.log("-----");

  for (const p of items) {
    const unit = p.unit ? ` (${p.unit})` : "";
    console.log(`- ${p.labelRu}${unit} [key=${p.key}, priority=${p.priority ?? "-"}]`);
    if (p.descriptionRu) {
      console.log(`  описание: ${p.descriptionRu}`);
    }
  }
}

main().catch((err) => {
  console.error("Ошибка при печати параметров категории:", err);
  process.exit(1);
});

