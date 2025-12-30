#!/usr/bin/env ts-node

import "dotenv/config";
import { pgPool } from "../db/pg";
import { ParameterDictionaryService } from "../normalization/parameter-dictionary.service";
import { ParameterNormalizerService } from "../normalization/parameter-normalizer.service";

interface EquipmentRecord {
  id: string;
  main_parameters: Record<string, any>;
  normalized_parameters?: Record<string, any>;
}

/**
 * Находит записи без normalized_parameters или с устаревшими
 */
async function findRecordsToNormalize(limit?: number): Promise<EquipmentRecord[]> {
  const limitClause = limit ? `LIMIT ${limit}` : "";

  const sql = `
    SELECT 
      id::text AS id,
      main_parameters
    FROM equipment
    WHERE is_active = true
      AND main_parameters IS NOT NULL
      AND main_parameters != '{}'::jsonb
      AND (
        normalized_parameters IS NULL
        OR normalized_parameters = '{}'::jsonb
      )
    ORDER BY id
    ${limitClause}
  `;

  const result = await pgPool.query(sql);
  return result.rows;
}

/**
 * Сохраняет нормализованные параметры в БД
 */
async function saveNormalizedParameters(
  id: string,
  normalized: Record<string, any>
): Promise<void> {
  await pgPool.query(
    `
    UPDATE equipment
    SET 
      normalized_parameters = $2::jsonb,
      normalized_at = NOW()
    WHERE id = $1
  `,
    [id, JSON.stringify(normalized)]
  );
}

/**
 * Главная функция
 */
async function main() {
  const limit = process.env.NORMALIZE_BATCH_SIZE
    ? parseInt(process.env.NORMALIZE_BATCH_SIZE, 10)
    : undefined;

  console.log("Нормализация параметров оборудования...\n");

  // Загружаем справочник
  console.log("Загрузка справочника параметров...");
  const dictionaryService = new ParameterDictionaryService();
  await dictionaryService.loadDictionary();
  const dictionary = dictionaryService.getDictionary();
  console.log(`Загружено ${dictionary.length} параметров из справочника\n`);

  if (dictionary.length === 0) {
    console.error("Справочник пуст! Сначала запустите: npm run generate:dictionary");
    process.exit(1);
  }

  // Создаём сервис нормализации
  const normalizer = new ParameterNormalizerService(dictionaryService);

  // Находим записи для нормализации
  console.log("Поиск записей для нормализации...");
  const records = await findRecordsToNormalize(limit);
  console.log(`Найдено ${records.length} записей для нормализации\n`);

  if (records.length === 0) {
    console.log("Нет записей для нормализации. Все записи уже нормализованы.");
    await pgPool.end();
    return;
  }

  let success = 0;
  let failed = 0;
  let totalNormalized = 0;
  let totalUnresolved = 0;

  console.log("Начало нормализации...\n");

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) {
      console.log(`[${i + 1}/${records.length}] Пропущена пустая запись`);
      continue;
    }

    console.log(`[${i + 1}/${records.length}] Обработка: ${record.id}...`);

    try {
      // Нормализуем параметры
      const result = normalizer.normalize(record.main_parameters || {});

      // Сохраняем результат
      await saveNormalizedParameters(record.id, result.normalized);

      const normalizedCount = Object.keys(result.normalized).length;
      const unresolvedCount = Object.keys(result.unresolved).length;

      totalNormalized += normalizedCount;
      totalUnresolved += unresolvedCount;

      console.log(
        `  ✓ Нормализовано: ${normalizedCount}, неразрешённых: ${unresolvedCount}, confidence: ${(result.confidence * 100).toFixed(1)}%`
      );

      success++;
    } catch (error) {
      console.error(`  ✗ Ошибка:`, error);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("РЕЗУЛЬТАТЫ");
  console.log("=".repeat(80));
  console.log(`Обработано записей: ${records.length}`);
  console.log(`Успешно: ${success}`);
  console.log(`Ошибок: ${failed}`);
  console.log(`Всего нормализовано параметров: ${totalNormalized}`);
  console.log(`Всего неразрешённых параметров: ${totalUnresolved}`);

  if (success > 0) {
    const avgConfidence = totalNormalized / (totalNormalized + totalUnresolved) || 0;
    console.log(`Средний confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  }

  // Статистика по оставшимся записям
  const remaining = await findRecordsToNormalize(1);
  if (remaining.length > 0) {
    console.log(`\nОсталось записей для нормализации: ${remaining.length > 0 ? "много" : "0"}`);
    if (!limit) {
      console.log("Запустите скрипт снова для обработки оставшихся записей.");
    }
  } else {
    console.log("\n✓ Все записи нормализованы!");
  }

  await pgPool.end();
}

void main();

