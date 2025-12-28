import type { ChatMessage, LLMProvider, ChatOptions } from "./providers";
import type { SearchQuery } from "../catalog";

/**
 * Диалоговый билдер SearchQuery.
 *
 * Идея:
 * - LLM работает в цикле и отвечает СТРОГО JSON-объектом одного из двух видов:
 *   1) {"action":"ask","question":"..."} — задать уточняющий вопрос пользователю
 *   2) {"action":"final","query":{...}} — финальный SearchQuery
 *
 * CLI управляет циклом: показывает question, читает ответ пользователя,
 * и снова вызывает next().
 */
export type InteractiveQueryStep =
  | { action: "ask"; question: string }
  | { action: "final"; query: SearchQuery };

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function parseStepJson(raw: string): InteractiveQueryStep {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) {
    throw new Error("LLM не вернул JSON (ожидался объект с action=ask|final)");
  }

  const parsed = JSON.parse(jsonStr) as any;
  const action = parsed?.action;
  if (action === "ask") {
    const question = String(parsed?.question ?? "").trim();
    if (!question) throw new Error("LLM вернул action=ask, но без question");
    return { action: "ask", question };
  }
  if (action === "final") {
    const query = parsed?.query;
    if (!query || typeof query !== "object") {
      throw new Error("LLM вернул action=final, но query отсутствует или не объект");
    }
    return { action: "final", query: query as SearchQuery };
  }

  throw new Error(`Неизвестный action от LLM: ${String(action)}`);
}

export interface InteractiveQueryBuilderOptions {
  model: string;
  maxTurns?: number;
}

export class InteractiveQueryBuilder {
  private readonly messages: ChatMessage[];
  private turns = 0;

  constructor(
    private readonly provider: Pick<LLMProvider, "chat">,
    private readonly options: InteractiveQueryBuilderOptions,
  ) {
    this.messages = [
      {
        role: "system",
        content: `
Ты помощник по подбору промышленной техники.
Твоя задача — В ДИАЛОГЕ преобразовать запрос пользователя на русском языке в JSON-объект SearchQuery.

Ты всегда отвечаешь СТРОГО валидным JSON без комментариев и пояснений.
Формат ответа ТОЛЬКО один из:

1) {"action":"ask","question":"..."}
   Используй, если не хватает данных или есть неоднозначность (1 вопрос за шаг).

2) {"action":"final","query":{...}}
   Используй, когда достаточно данных. query должен соответствовать SearchQuery:
   {
     "text"?: string;
     "category"?: string;
     "subcategory"?: string;
     "brand"?: string;
     "region"?: string;
     "parameters"?: Record<string, string | number>;
     "limit"?: number;
   }

Правила:
- Не придумывай параметры, которые явно не следуют из диалога.
- "text" — краткая суть запроса (2-10 слов).
- "parameters" используй для тех. характеристик (масса, тоннаж, объём ковша, мощность и т.п.).
- Если есть условия "более/больше/от" — суффикс "_min" (например "грузоподъемность_min": 80).
- Если есть условия "менее/меньше/до" — суффикс "_max" (например "тоннаж_max": 25).
- Если пользователь говорит, что хочет завершить (например /done), не задавай вопросы — верни best-effort final.
        `.trim(),
      },
    ];
  }

  /**
   * Отправить очередную реплику пользователя и получить следующий шаг:
   * либо уточняющий вопрос, либо финальный SearchQuery.
   */
  async next(userText: string): Promise<InteractiveQueryStep> {
    const text = userText.trim();
    if (!text) {
      throw new Error("Пустой ввод пользователя");
    }

    this.messages.push({ role: "user", content: text });
    this.turns += 1;

    const maxTurns = this.options.maxTurns ?? 6;
    if (this.turns > maxTurns) {
      // Просим LLM выдать best-effort финал, чтобы не зацикливаться.
      this.messages.push({
        role: "user",
        content: "Лимит уточнений достигнут. Сформируй best-effort final SearchQuery.",
      });
    }

    const chatOptions: ChatOptions = {
      model: this.options.model,
      messages: this.messages,
      temperature: 0.1,
    };

    const response = await this.provider.chat(chatOptions);
    const raw = response.message.content;
    const step = parseStepJson(raw);

    // Чтобы следующий ход учитывал вопрос ассистента, добавим его в историю.
    if (step.action === "ask") {
      this.messages.push({ role: "assistant", content: step.question });
    } else {
      this.messages.push({ role: "assistant", content: JSON.stringify({ action: "final" }) });
    }

    return step;
  }
}


