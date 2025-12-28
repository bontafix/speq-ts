import type { LLMProvider, ChatOptions, ChatResponse } from "./providers";
import { SearchQuery } from "../catalog";

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
  "text"?: string;
  "category"?: string;
  "subcategory"?: string;
  "brand"?: string;
  "region"?: string;
  "parameters"?: Record<string, string | number>;
  "limit"?: number;
}

Требования:
- Отвечай ТОЛЬКО валидным JSON без комментариев и пояснений.
- Не придумывай параметры, которые явно не следуют из запроса.
- "text" — краткая суть запроса (2-10 слов).
- "parameters" используй для технических характеристик (масса, тоннаж, объём ковша, мощность и т.п.).
- Если в запросе есть условия "более", "больше", "от" — используй суффикс "_min" (например, "грузоподъемность_min": 80).
- Если в запросе есть условия "менее", "меньше", "до" — используй суффикс "_max" (например, "тоннаж_max": 25).
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

    try {
      const parsed = JSON.parse(raw);
      return parsed as SearchQuery;
    } catch {
      // На случай, если модель вернула текст с префиксом/суффиксом.
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Не удалось распарсить ответ LLM как JSON SearchQuery");
      }
      return JSON.parse(jsonMatch[0]) as SearchQuery;
    }
  }
}


