#!/usr/bin/env node

import "../config/env-loader";
import { EquipmentRepository } from "../repository/equipment.repository";
import { LLMProviderFactory } from "../llm";
import { ConfigService } from "../config/config";

/**
 * Worker для offline-заполнения эмбеддингов по каталогу оборудования.
 *
 * Схема работы:
 * 1) выбираем из БД объекты, у которых embedding IS NULL;
 * 2) считаем эмбеддинги через выбранный LLM провайдер (по умолчанию Ollama с nomic-embed-text);
 * 3) сохраняем в колонку embedding (pgvector).
 *
 * Важно: LLM/эмбеддинги НЕ имеют прямого доступа к БД —
 * worker выступает прослойкой и сам управляет чтением/записью в PostgreSQL.
 */

const configService = new ConfigService();
const EMBED_MODEL = configService.llm.embeddingModel;
// Уменьшаем размер батча до 10 для стабильности на локальных машинах,
// если не задано иное через ENV.
const BATCH_SIZE = process.env.EMBED_BATCH_SIZE ? Number(process.env.EMBED_BATCH_SIZE) : 10;

async function main() {
  const repo = new EquipmentRepository();
  const llmFactory = new LLMProviderFactory();

  console.log(
    `Запуск worker эмбеддингов: модель=${EMBED_MODEL}, batchSize=${BATCH_SIZE}. Для остановки — Ctrl+C.`,
  );

  let totalProcessed = 0;

  // Простой цикл "до исчерпания" запис без эмбеддингов.
  // В реальном проде это может быть job-менеджер/очередь.
  // Здесь — максимально прямолинейный вариант для MVP.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const items = await repo.findWithoutEmbedding(BATCH_SIZE);
    if (items.length === 0) {
      console.log(`Готово. Всего обработано записей: ${totalProcessed}.`);
      break;
    }

    const texts = items.map((item) => item.textToEmbed || "");
    console.log(`Обработка batch: ${items.length} записей...`);

    try {
      const { embeddings } = await llmFactory.embeddings({
        model: EMBED_MODEL,
        input: texts,
      });

      if (embeddings.length !== items.length) {
        throw new Error(
          `Несовпадение размеров: embeddings=${embeddings.length}, items=${items.length}`,
        );
      }

      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const embedding = embeddings[i];
        if (!item || !embedding) {
          console.error(`Пропущена запись ${i}: отсутствует item или embedding`);
          continue;
        }
        await repo.updateEmbedding(item.id, embedding);
        totalProcessed += 1;
      }
    } catch (err) {
      console.error("Ошибка при получении/сохранении эмбеддингов:", err);
      process.exit(1);
    }
  }
}

void main();


