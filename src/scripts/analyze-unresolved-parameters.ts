/**
 * Анализ неразрешённых параметров
 * 
 * Находит параметры из main_parameters, которые не были нормализованы,
 * и показывает их частоту использования.
 * 
 * Помогает понять, какие алиасы или параметры нужно добавить в справочник.
 * 
 * Запуск: npx tsx src/scripts/analyze-unresolved-parameters.ts
 */

import "dotenv/config";
import { pgPool } from "../db/pg";
import { ParameterDictionaryService } from "../normalization";

interface UnresolvedStat {
  paramKey: string;
  count: number;
  examples: string[];
}

async function analyzeUnresolved() {
  console.log("🔍 Анализ неразрешённых параметров\n");
  console.log("=".repeat(80) + "\n");

  try {
    // Загружаем справочник для проверки
    const dictionaryService = new ParameterDictionaryService();
    await dictionaryService.loadDictionary();
    const dictionary = dictionaryService.getDictionary();
    
    console.log(`📚 Загружено параметров в справочнике: ${dictionary.length}\n`);

    // Получаем все параметры из main_parameters
    const sql = `
      SELECT 
        id::text,
        name,
        main_parameters,
        normalized_parameters
      FROM equipment
      WHERE is_active = true
        AND main_parameters IS NOT NULL
        AND main_parameters != '{}'::jsonb
      ORDER BY id
    `;

    const result = await pgPool.query(sql);
    console.log(`📊 Найдено активных записей: ${result.rows.length}\n`);

    if (result.rows.length === 0) {
      console.log("⚠️  Нет данных для анализа");
      await pgPool.end();
      return;
    }

    // Собираем статистику
    const unresolvedStats: Map<string, UnresolvedStat> = new Map();
    let totalRecords = 0;
    let totalMainParams = 0;
    let totalResolvableMainParams = 0;

    for (const row of result.rows) {
      totalRecords++;
      const mainParams = row.main_parameters || {};

      const mainKeys = Object.keys(mainParams);

      totalMainParams += mainKeys.length;

      // Находим неразрешённые параметры
      for (const key of mainKeys) {
        // Проверяем, есть ли этот параметр в справочнике
        const paramDef = dictionaryService.findCanonicalKey(key);
        
        if (paramDef) {
          totalResolvableMainParams++;
          continue;
        } else {
          // Параметр не найден в справочнике
          if (!unresolvedStats.has(key)) {
            unresolvedStats.set(key, {
              paramKey: key,
              count: 0,
              examples: [],
            });
          }

          const stat = unresolvedStats.get(key)!;
          stat.count++;
          
          // Сохраняем примеры значений (до 3-х)
          if (stat.examples.length < 3) {
            const value = mainParams[key];
            const valueStr = typeof value === 'object' 
              ? JSON.stringify(value).substring(0, 50) 
              : String(value).substring(0, 50);
            stat.examples.push(valueStr);
          }
        }
      }
    }

    // Сортируем по частоте
    const sortedUnresolved = Array.from(unresolvedStats.values())
      .sort((a, b) => b.count - a.count);

    console.log("=".repeat(80));
    console.log("📈 ОБЩАЯ СТАТИСТИКА");
    console.log("=".repeat(80));
    console.log(`Всего записей: ${totalRecords}`);
    console.log(`Всего параметров в main_parameters: ${totalMainParams}`);
    console.log(`Параметров, которые покрываются словарём: ${totalResolvableMainParams}`);
    console.log(
      `Средний coverage (по ключам): ${
        totalMainParams > 0 ? Math.round((totalResolvableMainParams / totalMainParams) * 100) : 0
      }%`
    );
    console.log(`\nНеразрешённых уникальных параметров: ${sortedUnresolved.length}`);

    if (sortedUnresolved.length === 0) {
      console.log("\n✅ Все параметры успешно нормализованы!");
      console.log("🎉 Справочник покрывает 100% параметров!");
      await pgPool.end();
      return;
    }

    console.log("\n" + "=".repeat(80));
    console.log("🔝 ТОП-30 НЕРАЗРЕШЁННЫХ ПАРАМЕТРОВ");
    console.log("=".repeat(80) + "\n");

    sortedUnresolved.slice(0, 30).forEach((stat, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. "${stat.paramKey}"`);
      console.log(`    Встречается: ${stat.count} раз`);
      console.log(`    Примеры значений:`);
      stat.examples.forEach(example => {
        console.log(`      - ${example}`);
      });
      console.log();
    });

    // Категоризация
    console.log("=".repeat(80));
    console.log("📂 КАТЕГОРИЗАЦИЯ НЕРАЗРЕШЁННЫХ ПАРАМЕТРОВ");
    console.log("=".repeat(80) + "\n");

    const categories = {
      metadata: [] as string[],
      technical: [] as string[],
      unknown: [] as string[],
    };

    const metadataKeywords = ['производитель', 'модель', 'серийн', 'артикул', 'код', 'url', 'фото', 'картинка', 'изображ', 'дата', 'год', 'цвет', 'гарантия', 'описание'];
    const technicalKeywords = ['мощность', 'вес', 'масса', 'глубина', 'высота', 'длина', 'ширина', 'объем', 'скорость', 'производительность', 'грузо', 'емкость', 'вместимость'];

    for (const stat of sortedUnresolved) {
      const keyLower = stat.paramKey.toLowerCase();
      
      if (metadataKeywords.some(kw => keyLower.includes(kw))) {
        categories.metadata.push(stat.paramKey);
      } else if (technicalKeywords.some(kw => keyLower.includes(kw))) {
        categories.technical.push(stat.paramKey);
      } else {
        categories.unknown.push(stat.paramKey);
      }
    }

    console.log("📋 Метаданные (можно игнорировать):");
    console.log(`   Всего: ${categories.metadata.length}`);
    if (categories.metadata.length > 0) {
      categories.metadata.slice(0, 10).forEach(key => {
        console.log(`   - ${key}`);
      });
      if (categories.metadata.length > 10) {
        console.log(`   ... и ещё ${categories.metadata.length - 10}`);
      }
    }
    console.log();

    console.log("🔧 Технические параметры (НУЖНО добавить в справочник!):");
    console.log(`   Всего: ${categories.technical.length}`);
    if (categories.technical.length > 0) {
      categories.technical.slice(0, 10).forEach(key => {
        const stat = unresolvedStats.get(key);
        console.log(`   - "${key}" (${stat?.count} раз)`);
      });
      if (categories.technical.length > 10) {
        console.log(`   ... и ещё ${categories.technical.length - 10}`);
      }
    }
    console.log();

    console.log("❓ Неизвестные:");
    console.log(`   Всего: ${categories.unknown.length}`);
    if (categories.unknown.length > 0) {
      categories.unknown.slice(0, 10).forEach(key => {
        const stat = unresolvedStats.get(key);
        console.log(`   - "${key}" (${stat?.count} раз)`);
      });
      if (categories.unknown.length > 10) {
        console.log(`   ... и ещё ${categories.unknown.length - 10}`);
      }
    }
    console.log();

    // Рекомендации
    console.log("=".repeat(80));
    console.log("💡 РЕКОМЕНДАЦИИ");
    console.log("=".repeat(80) + "\n");

    if (categories.technical.length > 0) {
      console.log("✅ Действия для улучшения нормализации:\n");
      
      console.log("1. Добавить алиасы для существующих параметров:");
      console.log("   Отредактировать: src/scripts/seed-parameter-dictionary-complete.ts");
      console.log("   Добавить алиасы в массив aliases существующих параметров\n");
      
      console.log("2. Создать новые параметры:");
      console.log("   Отредактировать: src/scripts/seed-parameter-dictionary-complete.ts");
      console.log("   Добавить новые объекты в массив parameters\n");
      
      console.log("3. Перезаполнить справочник:");
      console.log("   npx tsx src/scripts/seed-parameter-dictionary-complete.ts\n");
      
      console.log("4. Пересчитать нормализацию:");
      console.log("   npx tsx src/scripts/normalize-parameters.ts\n");
    } else {
      console.log("✅ Все технические параметры нормализованы!");
      console.log("📋 Неразрешённые параметры - это метаданные, можно игнорировать\n");
    }

    console.log("=".repeat(80));
    console.log("✨ Анализ завершён");
    console.log("=".repeat(80) + "\n");

  } catch (error: any) {
    console.error("❌ Ошибка:", error.message);
    console.error(error.stack);
  } finally {
    await pgPool.end();
  }
}

// Запуск
analyzeUnresolved();

