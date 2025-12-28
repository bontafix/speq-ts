#!/usr/bin/env node

import "dotenv/config";
import readline from "readline";
import { CatalogService } from "../catalog";
import { SearchEngine } from "../search";
import { EquipmentRepository } from "../repository/equipment.repository";
import { LLMProviderFactory } from "../llm";
import { QuestionParser } from "../llm/question.parser";
import { AnswerGenerator } from "../llm/answer.generator";
import { checkDatabaseHealth } from "../db/pg";
import { InteractiveQueryBuilder } from "../llm/interactive-query.builder";

async function main() {
  const llmFactory = new LLMProviderFactory();
  const questionParser = new QuestionParser(llmFactory);
  const repository = new EquipmentRepository();
  const searchEngine = new SearchEngine(repository);
  const catalogService = new CatalogService(searchEngine);
  const answerGenerator = new AnswerGenerator();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (q: string) =>
    new Promise<string>((resolve) => rl.question(q, (answer: string) => resolve(answer)));

  try {
    console.log("[0/4] Проверка состояния систем...");

    // Проверка БД
    const dbHealth = await checkDatabaseHealth();
    if (!dbHealth.ok) {
      console.error("Обнаружены критические проблемы с PostgreSQL:");
      for (const issue of dbHealth.issues) {
        if (issue.level === "error") {
          console.error(` - [ERROR] ${issue.message}`);
        }
      }
      process.exit(1);
    }
    const warnIssues = dbHealth.issues.filter((i) => i.level === "warn");
    if (warnIssues.length > 0) {
      console.warn("Предупреждения по схеме БД (поиск будет работать, но не полностью):");
      for (const issue of warnIssues) {
        console.warn(` - [WARN] ${issue.message}`);
      }
    }

    // Проверка LLM провайдеров
    const llmHealth = await llmFactory.checkHealth();
    const availableProviders = Object.entries(llmHealth)
      .filter(([, available]) => available)
      .map(([name]) => name);

    if (availableProviders.length === 0) {
      console.error("Ни один LLM провайдер не доступен. Проверьте:");
      console.error(" - Запущен ли Ollama (http://127.0.0.1:11434)");
      console.error(" - Указаны ли API ключи для Groq/OpenAI");
      process.exit(1);
    }

    console.log(`Доступные LLM провайдеры: ${availableProviders.join(", ")}`);
    console.log(`Используется: chat=${process.env.LLM_CHAT_PROVIDER ?? "ollama"}, embeddings=${process.env.LLM_EMBEDDINGS_PROVIDER ?? "ollama"}\n`);

    console.log("Режим: диалог уточнений. Команды: /done — закончить и построить JSON, /exit — выход.\n");

    let userText = await ask(
      "Введите запрос (RU), например: Нужен гусеничный экскаватор для карьера до 25 тонн\n> ",
    );

    if (!userText.trim()) {
      rl.close();
      console.error("Пустой запрос, завершение.");
      process.exit(1);
    }

    console.log("\n[1/4] Парсинг запроса через LLM...");
    let searchQuery;

    // Диалоговый режим: LLM может задать уточняющие вопросы.
    // Если пользователь не отвечает или хочет выйти — завершаем.
    const model = process.env.LLM_MODEL ?? "qwen2.5:7b-instruct-q4_K_M";
    const maxTurns = process.env.LLM_DIALOG_MAX_TURNS ? Number(process.env.LLM_DIALOG_MAX_TURNS) : 6;
    const builder = new InteractiveQueryBuilder(llmFactory, { model, maxTurns });

    try {
      // Первый шаг — с исходного запроса.
      // Если LLM сразу вернёт final — отлично.
      // Если ask — продолжаем спрашивать пользователя.
      // /done: просим best-effort финал.
      // /exit: выходим.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const trimmed = userText.trim();
        if (trimmed === "/exit") {
          rl.close();
          console.log("Выход по команде /exit.");
          process.exit(0);
        }
        if (trimmed === "/done") {
          const step = await builder.next("Пользователь хочет завершить (/done). Построй best-effort final SearchQuery.");
          if (step.action !== "final") {
            // Подстраховка: если модель всё равно спрашивает — принудительно финализируем через старый парсер.
            searchQuery = await questionParser.parse("Построй best-effort SearchQuery по текущему диалогу.");
          } else {
            searchQuery = step.query;
          }
          break;
        }

        const step = await builder.next(userText);
        if (step.action === "final") {
          searchQuery = step.query;
          break;
        }

        console.log(`\nУточнение: ${step.question}`);
        userText = await ask("> ");
        if (!userText.trim()) {
          rl.close();
          console.error("Пустой ответ. Для выхода используйте /exit, для завершения — /done.");
          process.exit(1);
        }
      }
    } catch (err) {
      // Фоллбек на старый одношаговый парсер (без уточнений)
      try {
        searchQuery = await questionParser.parse(userText);
      } catch {
        rl.close();
        console.error("Ошибка парсинга запроса LLM. Убедитесь, что хотя бы один провайдер доступен.");
        console.error(String(err));
        process.exit(1);
      }
    } finally {
      rl.close();
    }

    console.log("Структурированный запрос (SearchQuery):");
    console.log(JSON.stringify(searchQuery, null, 2));

    console.log("\n[2/4] Поиск оборудования в каталоге (PostgreSQL)...");
    let result;
    try {
      result = await catalogService.searchEquipment(searchQuery);
    } catch (err) {
      console.error("Ошибка при выполнении поиска в БД. Проверьте подключение PostgreSQL.");
      console.error(String(err));
      process.exit(1);
    }

    console.log(`\n[3/4] Результаты поиска`);
    console.log(`Стратегия: ${result.usedStrategy}, найдено позиций: ${result.total}\n`);

    const answerText = answerGenerator.generatePlainText(result.items);
    console.log(answerText);
  } catch (err) {
    console.error("Необработанная ошибка при обработке запроса.");
    console.error(String(err));
    process.exit(1);
  }
}

void main();


