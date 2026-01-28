import { Telegraf } from 'telegraf';
import { SessionService } from '../services/session.service';
import { LLMProviderFactory } from '../../llm';
import { CatalogService } from '../../catalog';
import { InteractiveQueryBuilder } from '../../llm/interactive-query.builder';
import { deletePreviousMessages, sendAndTrack, sendSearchResults } from '../utils/message.utils';
import { buildMainMenuKeyboard } from '../keyboards';
import { AnswerGenerator } from '../../llm/answer.generator';
import { ConfigService } from '../../config/config';

export function setupTextHandler(
  bot: Telegraf,
  deps: {
    sessionService: SessionService;
    llmFactory: LLMProviderFactory;
    catalogService: CatalogService;
    answerGenerator: AnswerGenerator;
    config: ConfigService;
  }
) {
  const { sessionService, llmFactory, catalogService, answerGenerator, config } = deps;

  bot.on("text", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const text: string = ctx.message.text.trim();
    if (!text) return;

    if (text === "/exit") {
       await sendAndTrack(ctx, sessionService['sessions'], "До свидания!");
       return;
    }

    // Получаем или создаем сессию
    let session = await sessionService.getOrCreate(telegramId);
    
    // Если сессия была в старом формате или шаг не S_CHAT, сбрасываем в S_CHAT (миграция)
    if (session.step !== "S_CHAT") {
        session = await sessionService.reset(telegramId);
    }

    try {
      await ctx.sendChatAction("typing");

      // 1. Готовим дополнительные system-подсказки для LLM
      // Если в сессии уже известна категория, подмешиваем подсказку
      // с перечнем ключевых параметров для этой категории.
      let extraSystemMessages: string[] | undefined;
      if (session.categoryName) {
        const hint = catalogService.getCategoryParametersHint(session.categoryName, 10);
        if (hint) {
          extraSystemMessages = [hint];
        }
      }

      // 2. Создаем билдер с восстановленной историей и доп. подсказками
      const builder = new InteractiveQueryBuilder(llmFactory, {
        model: config.llm.model,
        maxTurns: config.llm.dialogMaxTurns,
        history: session.chatHistory ?? [],
        extraSystemMessages,
      });

      // 3. Получаем следующий шаг
      const step = await builder.next(text);

      // Сохраняем обновленную историю
      session.chatHistory = builder.getHistory();
      await sessionService.update(session);

      if (step.action === "ask") {
        // LLM хочет уточнить - не удаляем предыдущие сообщения, продолжаем диалог
        await sendAndTrack(ctx, sessionService['sessions'], `❓ ${step.question}`);
      } else if (step.action === "final") {
        // LLM сформировал запрос - удаляем предыдущие сообщения перед показом результатов
        await deletePreviousMessages(ctx, sessionService['sessions']);
        
        console.log(`[Telegram] SearchQuery: ${JSON.stringify(step.query, null, 2)}`);

        // Обновляем категорию в сессии для будущих подсказок по параметрам
        if (step.query.category && typeof step.query.category === "string") {
          session.categoryName = step.query.category;
          await sessionService.update(session);
        }
        
        // 3. Ищем
        const result = await catalogService.searchEquipment(step.query);

        // 4. Формируем ответ
        if (result.total === 0) {
          let msg = `❌ Ничего не найдено.`;
          if (result.message) msg += `\n💡 ${result.message}`;
          
          await sendAndTrack(ctx, sessionService['sessions'], msg, buildMainMenuKeyboard());
          
          // Можно добавить подсказки категорий, если есть в result.suggestions
          if (result.suggestions?.popularCategories?.length) {
              const cats = result.suggestions.popularCategories.map((c: any) => `- ${c.name}`).join("\n");
              await sendAndTrack(ctx, sessionService['sessions'], `Популярные категории:\n${cats}`);
          }

        } else {
          // Нашли
          let header = `✅ Найдено: ${result.total}`;
          if (result.message) header += `\n💡 ${result.message}`;
          await sendAndTrack(ctx, sessionService['sessions'], header, buildMainMenuKeyboard());

          // Отправляем результаты
          await sendSearchResults(ctx, sessionService['sessions'], result.items, answerGenerator);

          // 5. Обогащаем контекст результатами
          const summary = result.items.slice(0, 5)
            .map(i => `- ${i.name} (Price: ${i.price}, Brand: ${i.brand}, Params: ${JSON.stringify(i.mainParameters)})`)
            .join("\n");
          
          builder.addSearchResults(result.total, summary);
          session.chatHistory = builder.getHistory();
          await sessionService.update(session);
        }
      }

    } catch (error: any) {
      console.error("Error in chat handler:", error);
      await sendAndTrack(ctx, sessionService['sessions'], "❌ Произошла ошибка при обработке запроса. Попробуйте еще раз или напишите /reset.");
    }
  });
}
