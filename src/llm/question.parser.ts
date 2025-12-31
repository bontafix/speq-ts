import type { LLMProvider, ChatOptions, ChatResponse } from "./providers";
import { SearchQuery } from "../catalog";
import { SearchQueryValidator } from "./search-query.validator";

/**
 * Интерфейс для объектов, которые могут выполнять chat completion.
 */
interface ChatProvider {
  chat(options: ChatOptions): Promise<ChatResponse>;
}

/**
 * QuestionParser — использует LLM только для парсинга свободного текста
 * пользователя в структурированный SearchQuery.
 * Поддерживает любой LLM провайдер (Ollama, Groq, OpenAI) или LLMProviderFactory.
 */
export class QuestionParser {
  private readonly model: string;

  constructor(
    private readonly provider: ChatProvider,
    model?: string,
  ) {
    this.model = model ?? (process.env.LLM_MODEL ?? "qwen2.5:7b-instruct-q4_K_M");
  }

  async parse(userText: string): Promise<SearchQuery> {
    const systemPrompt = `
Ты помощник по подбору промышленной техники.
Твоя задача — ПРЕОБРАЗОВАТЬ запрос пользователя на русском языке в JSON-объект SearchQuery.

Формат SearchQuery (TypeScript):
{
  "text"?: string;           // Текстовый запрос для семантического поиска
  "category"?: string;        // Категория техники (точное значение)
  "brand"?: string;           // Бренд/производитель (точное значение)
  "region"?: string;          // Регион (точное значение)
  "parameters"?: Record<string, string | number>;  // Технические характеристики
  "limit"?: number;           // Количество результатов (по умолчанию 10)
}

ВАЖНО! Разница между полями:
- "text" — для ВЕКТОРНОГО (семантического) поиска. Общее описание: "экскаватор для земляных работ"
- "category", "brand", "region" — для ТОЧНОЙ фильтрации. Только если явно указано!
- Поле "subcategory" НЕ используй — оно исключено из поиска. Слова типа "колесный/гусеничный" включай в "text".
- "parameters" — технические характеристики. Используй РУССКИЕ названия.

Правила parameters:
- Для "более/больше/от X" → суффикс "_min": {"грузоподъемность_min": 80}
- Для "менее/меньше/до X" → суффикс "_max": {"тоннаж_max": 25}
- Для точного значения: {"мощность": 150}

Примеры:

Запрос: "Экскаватор Caterpillar с ковшом от 1 куба"
Ответ: {"text":"экскаватор","category":"Экскаватор","brand":"Caterpillar","parameters":{"объем_ковша_min":1}}

Запрос: "Краны более 80 тонн в Москве"
Ответ: {"text":"кран","category":"Кран","region":"Москва","parameters":{"грузоподъемность_min":80}}

Запрос: "Гусеничный бульдозер до 20 тонн"
Ответ: {"text":"гусеничный бульдозер","category":"Бульдозер","parameters":{"вес_max":20}}

Отвечай ТОЛЬКО валидным JSON без комментариев и пояснений.
`.trim();

    const userPrompt = `
Преобразуй следующий запрос пользователя в SearchQuery (JSON):

${userText}
`.trim();

    const response = await this.provider.chat({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    });

    const raw = response.message.content.trim();

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // На случай, если модель вернула текст с префиксом/суффиксом.
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Не удалось распарсить ответ LLM как JSON SearchQuery");
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Валидируем и нормализуем SearchQuery
    try {
      return SearchQueryValidator.validate(parsed);
    } catch (error: any) {
      throw new Error(`Некорректный SearchQuery от LLM: ${error.message}`);
    }
  }
}


