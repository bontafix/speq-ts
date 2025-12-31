import type { ChatMessage, LLMProvider, ChatOptions } from "./providers";
import type { SearchQuery } from "../catalog";
import { SearchQueryValidator } from "./search-query.validator";

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

  // Если LLM пытается ответить простым текстом без action (иногда бывает при сбоях)
  // или если это явно просто ответ на вопрос "что ты умеешь"
  if (!action && typeof parsed === 'string') {
     return { action: "ask", question: parsed };
  }

  if (action === "ask") {
    const question = String(parsed?.question ?? "").trim();
    if (!question) throw new Error("LLM вернул action=ask, но без question");
    return { action: "ask", question };
  }
  if (action === "final") {
    const query = parsed?.query;
    if (!query || typeof query !== "object") {
       // Если LLM ошибся и вернул final без query, считаем это "ask" с просьбой уточнить
       if (parsed.message || parsed.text) {
           return { action: "ask", question: parsed.message || parsed.text };
       }
       throw new Error("LLM вернул action=final, но query отсутствует или не объект");
    }
    
    // Валидируем и нормализуем SearchQuery от LLM
    try {
      const validatedQuery = SearchQueryValidator.validate(query);
      return { action: "final", query: validatedQuery };
    } catch (error: any) {
      // Если валидация не прошла (например, пустой запрос), превращаем это в вопрос пользователю
      console.warn(`[LLM] Query validation failed, fallback to ask. Error: ${error.message}`);
      return { 
          action: "ask", 
          question: "Я не совсем понял, что именно искать. Уточните категорию или параметры." 
      };
    }
  }

  throw new Error(`Неизвестный action от LLM: ${String(action)}`);
}

export interface InteractiveQueryBuilderOptions {
  model: string;
  maxTurns?: number;
  history?: ChatMessage[] | undefined;
}

export class InteractiveQueryBuilder {
  private readonly messages: ChatMessage[];
  private turns = 0;
  private readonly MAX_CONTEXT_MESSAGES = 20; // Макс. сообщений в истории (кроме system)

  constructor(
    private readonly provider: Pick<LLMProvider, "chat">,
    private readonly options: InteractiveQueryBuilderOptions,
  ) {
    if (this.options.history && this.options.history.length > 0) {
      this.messages = [...this.options.history];
    } else {
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
   ВАЖНО: Если пользователь назвал только категорию (например, "кран"), ОБЯЗАТЕЛЬНО спроси про параметры (грузоподъемность, бренд, регион).
   Не делай поиск по слишком широкому запросу, если это не явная просьба "показать всё".
   
   ЕСЛИ ПОЛЬЗОВАТЕЛЬ СПРАШИВАЕТ "ЧТО ТЫ УМЕЕШЬ?" ИЛИ "ЧТО ЕСТЬ В КАТАЛОГЕ?":
   Отвечай через action="ask" с перечислением основных категорий.
   Пример: {"action":"ask","question":"В нашем каталоге более 1000 единиц техники: автокраны, экскаваторы, бульдозеры, погрузчики и другое. Что именно вас интересует?"}

2) {"action":"final","query":{...}}
   Используй, когда достаточно данных (есть категория И хотя бы один параметр/бренд/регион) или пользователь просит искать "как есть".
   {
     "text"?: string;           // Текстовый запрос для семантического поиска
     "category"?: string;        // Категория техники (точное значение)
     "brand"?: string;           // Бренд/производитель (точное значение)
     "region"?: string;          // Регион (точное значение)
     "parameters"?: Record<string, string | number>;  // Технические характеристики
     "limit"?: number;           // Количество результатов (по умолчанию 10)
   }

ВАЖНО! Разница между полями:
- "text" — используется для ВЕКТОРНОГО (семантического) поиска. Сюда помещай общее описание запроса.
  Пример: "экскаватор для земляных работ", "гусеничный кран", "погрузчик фронтальный"
  
- "category", "brand", "region" — используются для ТОЧНОЙ фильтрации в БД.
  Помещай сюда ТОЛЬКО если пользователь явно указал категорию/бренд.
  Примеры категорий: "Экскаватор", "Кран", "Погрузчик", "Бульдозер", "Спецтехника"
  Примеры брендов: "Caterpillar", "Komatsu", "Hitachi", "JCB", "Volvo"
  
- Поле "subcategory" НЕ используй — оно исключено из поиска.
  Если пользователь говорит "колесный/гусеничный/мини" и т.п., включай это в "text"
  и/или в "parameters" (если это числовой фильтр).
  
- "parameters" — технические характеристики для фильтрации (JSONB поле в БД).
  Используй РУССКИЕ названия параметров: "грузоподъемность", "мощность", "вес", "объем_ковша" и т.д.

Правила формирования parameters:
- Для диапазонов "более/больше/от X" используй суффикс "_min": {"грузоподъемность_min": 80}
- Для диапазонов "менее/меньше/до X" используй суффикс "_max": {"тоннаж_max": 25}
- Для точного значения: {"мощность": 150}
- Извлекай только те параметры, которые ЯВНО указал пользователь

СБРОС КОНТЕКСТА:
- Если пользователь резко меняет тему (например, искали краны, а теперь просит "покажи бульдозеры"),
  НЕ тяни старые фильтры (category, parameters) в новый запрос. Начни с чистого листа для новой темы.
- Если пользователь уточняет текущий запрос (например, "а есть подешевле?"),
  СОХРАНЯЙ предыдущие фильтры и добавляй новые условия.

Примеры хороших SearchQuery:

Запрос: "Нужен экскаватор Caterpillar с ковшом от 1 кубометра"
Ответ: {"action":"final","query":{"text":"экскаватор","category":"Экскаватор","brand":"Caterpillar","parameters":{"объем_ковша_min":1}}}

Запрос: "Покажи краны грузоподъемностью более 80 тонн в Москве"
Ответ: {"action":"final","query":{"text":"кран","category":"Кран","region":"Москва","parameters":{"грузоподъемность_min":80}}}

Запрос: "Мне нужен кран"
Ответ: {"action":"ask","question":"Какой тип крана вас интересует? Какая нужна грузоподъемность и в каком регионе?"}

Запрос: "Ищу технику для стройки"
Ответ: {"action":"ask","question":"Какой именно тип техники вас интересует? Например: экскаватор, кран, бульдозер, погрузчик?"}

Запрос: "Гусеничный бульдозер весом до 20 тонн"
Ответ: {"action":"final","query":{"text":"гусеничный бульдозер","category":"Бульдозер","parameters":{"вес_max":20}}}

ВАЖНО:
- Не придумывай значения категорий/брендов — используй ТОЛЬКО если пользователь явно указал
- Если пользователь указал "/done" или "хватит" — верни best-effort final
- Задавай уточняющие вопросы только если информации явно недостаточно
        `.trim(),
        },
      ];
    }
  }

  public getHistory(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Обрезает историю сообщений, чтобы не превысить лимит контекста LLM.
   * Сохраняет system промпты и последние N сообщений пользователь-ассистент.
   */
  private ensureContextLimit(): void {
    // Разделяем system промпты и остальные сообщения
    const systemMessages = this.messages.filter(m => m.role === 'system');
    const userAssistantMessages = this.messages.filter(m => m.role !== 'system');
    
    // Если превышен лимит, оставляем только последние сообщения
    if (userAssistantMessages.length > this.MAX_CONTEXT_MESSAGES) {
      const recentMessages = userAssistantMessages.slice(-this.MAX_CONTEXT_MESSAGES);
      
      // Пересобираем массив: system промпты + недавние сообщения
      this.messages.length = 0;
      this.messages.push(...systemMessages, ...recentMessages);
      
      if (process.env.DEBUG) {
        console.log(`[LLM] Context trimmed: kept last ${this.MAX_CONTEXT_MESSAGES} messages`);
      }
    }
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

    if (process.env.DEBUG_SEARCH) {
      console.log('\n--- LLM Interaction Log ---');
      console.log('User Input:', text);
      console.log('LLM Raw Response:', raw);
      console.log('---------------------------\n');
    }

    const step = parseStepJson(raw);

    // Чтобы следующий ход учитывал вопрос ассистента, добавим его в историю.
    if (step.action === "ask") {
      this.messages.push({ role: "assistant", content: step.question });
    } else {
      this.messages.push({ role: "assistant", content: JSON.stringify({ action: "final" }) });
    }
    
    // Обрезаем историю после добавления ответа ассистента
    this.ensureContextLimit();

    return step;
  }

  /**
   * Добавить информацию о найденных результатах в контекст диалога.
   * Это позволяет LLM понимать контекст для следующих уточнений (например, "найди дешевле").
   */
  addSearchResults(count: number, summary: string): void {
    // Ограничиваем длину summary, чтобы не раздувать контекст
    const truncatedSummary = summary.length > 1000 
      ? summary.substring(0, 1000) + "..." 
      : summary;
    
    this.messages.push({
      role: "system",
      content: `
Система поиска выполнила запрос.
Найдено результатов: ${count}.
Краткое описание топа выдачи (для контекста, не выдумывай их):
${truncatedSummary}

Если пользователь попросит изменить параметры (дешевле, мощнее, другой бренд),
используй эти данные как отправную точку для нового SearchQuery.
`.trim()
    });
    
    // Обрезаем историю после добавления результатов
    this.ensureContextLimit();
  }
}


