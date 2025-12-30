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

  /**
   * Отображение подсказок пользователю
   */
  private displaySuggestions(suggestions: import('../catalog').CatalogSuggestions) {
    console.log('\n📋 Что есть в каталоге:');
    
    // Похожие категории (если искали что-то конкретное)
    if (suggestions.similarCategories && suggestions.similarCategories.length > 0) {
      console.log('\n   Похожие категории:');
      suggestions.similarCategories.forEach((cat, i) => {
        console.log(`   ${i + 1}. ${cat}`);
      });
    }
    
    // Популярные категории (топ-10)
    if (suggestions.popularCategories && suggestions.popularCategories.length > 0) {
      console.log('\n   Популярные категории:');
      suggestions.popularCategories.slice(0, 10).forEach((cat, i) => {
        console.log(`   ${i + 1}. ${cat.name} (${cat.count} шт.)`);
      });
    }
    
    // Примеры запросов
    if (suggestions.exampleQueries && suggestions.exampleQueries.length > 0) {
      console.log('\n   Примеры запросов:');
      suggestions.exampleQueries.forEach(example => {
        console.log(`   • ${example}`);
      });
    }
    
    console.log();
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
            if (result.total === 0) {
              // Ничего не найдено - показываем подсказки
              console.log(`\n❌ Ничего не найдено`);
              
              if (result.message) {
                console.log(`\n💡 ${result.message}`);
              }
              
              // Показываем доступные категории
              if (result.suggestions) {
                this.displaySuggestions(result.suggestions);
              }
            } else {
              // Нашли результаты
              console.log(`\n✅ Найдено: ${result.total} (Стратегия: ${result.usedStrategy})`);
              
              if (result.message) {
                console.log(`💡 ${result.message}`);
              }
              
              const answerText = this.answerGenerator.generatePlainText(result.items);
              console.log(answerText);

              // 4. Обогащаем контекст LLM результатами для продолжения диалога
              const summary = result.items.slice(0, 5)
                .map(i => `- ${i.name} (Price: ${i.price}, Brand: ${i.brand}, Params: ${JSON.stringify(i.mainParameters)})`)
                .join("\n");
              
              this.builder.addSearchResults(result.total, summary);
            }
            
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

