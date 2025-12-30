import * as readline from "readline";
import { AppContainer } from "../app/container";
import { InteractiveQueryBuilder } from "../llm/interactive-query.builder";
import { AnswerGenerator } from "../llm/answer.generator";

export class ChatController {
  private rl: readline.Interface;
  private builder!: InteractiveQueryBuilder;
  private answerGenerator: AnswerGenerator;

  constructor(private app: AppContainer) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.answerGenerator = new AnswerGenerator();
    this.resetSession();
  }

  private resetSession() {
    this.builder = new InteractiveQueryBuilder(this.app.llmFactory, {
      model: this.app.config.llm.model,
      maxTurns: this.app.config.llm.dialogMaxTurns,
    });
  }

  private ask(q: string): Promise<string> {
    return new Promise((resolve) => this.rl.question(q, resolve));
  }

  async start() {
    console.log("🤖 Ассистент по подбору оборудования (Speq v2.0)");
    console.log("------------------------------------------------");
    console.log("Команды:");
    console.log("  /reset - сброс контекста диалога");
    console.log("  /exit  - выход");
    console.log("------------------------------------------------\n");

    let prompt = "Введите запрос: ";

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const input = await this.ask(prompt);
        const text = input.trim();

        if (!text) continue;
        
        if (text === "/exit") {
          console.log("До свидания!");
          break;
        }
        
        if (text === "/reset") {
          console.log("🔄 Контекст сброшен.");
          this.resetSession();
          prompt = "Введите запрос: ";
          continue;
        }

        // 1. Получаем шаг от LLM (уточнение или поиск)
        // Показываем простой спиннер или сообщение
        process.stdout.write("⏳ Думаю... ");
        
        try {
          const step = await this.builder.next(text);
          process.stdout.write("\r"); // Clear line

          if (step.action === "ask") {
            // LLM хочет уточнить
            console.log(`\n❓ ${step.question}`);
            prompt = "> "; // меняем промпт на вложенный
          
          } else if (step.action === "final") {
            // LLM сформировал запрос к БД
            console.log(`\n🔍 Ищу в базе данных...`);
            console.log("\n📋 Сформированный запрос SearchQuery:");
            console.log(JSON.stringify(step.query, null, 2));
            console.log("");

            // 2. Ищем
            const result = await this.app.catalogService.searchEquipment(step.query);
            
            // 3. Выводим пользователю
            console.log(`\n✅ Найдено: ${result.total} (Стратегия: ${result.usedStrategy})`);
            const answerText = this.answerGenerator.generatePlainText(result.items);
            console.log(answerText);

            // 4. Обогащаем контекст LLM результатами для продолжения диалога
            const summary = result.items.slice(0, 5)
              .map(i => `- ${i.name} (Price: ${i.price}, Brand: ${i.brand}, Params: ${JSON.stringify(i.mainParameters)})`)
              .join("\n");
            
            this.builder.addSearchResults(result.total, summary);
            
            prompt = "\nЧто-то еще? (или уточните критерии): ";
          }
        } catch (error) {
           console.log("\n❌ Ошибка при обработке запроса:");
           console.error(error);
           prompt = "\nПопробуйте переформулировать: ";
        }
      }
    } finally {
      this.rl.close();
    }
  }
}

