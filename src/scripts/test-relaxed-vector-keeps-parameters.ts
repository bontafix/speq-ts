import { SearchEngine } from "../search/search.engine";
import type { EquipmentSummary, SearchQuery } from "../catalog";

/**
 * Мини-проверка на регресс:
 * relaxed vector search НЕ должен игнорировать query.parameters,
 * иначе в выдачу попадают позиции, не соответствующие фильтрам (например, объем ковша).
 *
 * Запуск:
 *   ts-node src/scripts/test-relaxed-vector-keeps-parameters.ts
 */
async function main() {
  // Фейковый репозиторий: нам важно только то, с какими filters вызывается vectorSearchWithEmbedding.
  const calls: Array<{ text: string; limit: number; filters?: any }> = [];

  const fakeRepo: any = {
    fullTextSearch: async (_query: SearchQuery, _limit: number): Promise<EquipmentSummary[]> => {
      // Делает ситуацию "мало результатов", чтобы сработал relaxed fallback.
      return [];
    },
    vectorSearchWithEmbedding: async (
      text: string,
      _embedding: number[],
      limit: number,
      filters?: any,
    ): Promise<EquipmentSummary[]> => {
      calls.push({ text, limit, filters });
      return [];
    },
  };

  // Фейковая фабрика LLM, чтобы SearchEngine получил queryEmbedding и дошёл до relaxed ветки.
  const fakeLlmFactory: any = {
    embeddings: async (_args: any) => ({ embeddings: [[0, 0, 0]] }),
  };

  const engine = new SearchEngine(fakeRepo, undefined, fakeLlmFactory);

  await engine.search({
    text: "колесный экскаватор",
    category: "Экскаватор",
    parameters: {
      объем_ковша_min: 1,
    },
    limit: 10,
  });

  if (calls.length < 2) {
    throw new Error(
      `Ожидалось минимум 2 вызова vectorSearchWithEmbedding (strict + relaxed), получили: ${calls.length}`,
    );
  }

  const relaxedCall = calls[calls.length - 1]!;
  const relaxedParams = relaxedCall.filters?.parameters;

  if (!relaxedParams || relaxedParams.объем_ковша_min !== 1) {
    throw new Error(
      `REGRESSION: relaxed vector search потерял параметры. filters=${JSON.stringify(relaxedCall.filters)}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log("OK: relaxed vector search сохраняет query.parameters");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});


