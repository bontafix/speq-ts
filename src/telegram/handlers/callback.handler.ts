import { Telegraf } from 'telegraf';
import { SessionService } from '../services/session.service';
import { CatalogIndexService } from '../../catalog/catalog-index.service';
import { CatalogService } from '../../catalog';
import { AnswerGenerator } from '../../llm/answer.generator';
import { 
  CALLBACK, 
  buildMainMenuKeyboard, 
  buildCategoriesKeyboard, 
  buildCategoryResultsKeyboard,
  buildCategoryParamsKeyboard 
} from '../keyboards';
import { 
  deletePreviousMessages, 
  sendAndTrack, 
  sendSearchResults, 
  safeAnswerCbQuery 
} from '../utils/message.utils';

export function setupCallbackHandlers(
  bot: Telegraf,
  deps: {
    sessionService: SessionService;
    catalogIndex: CatalogIndexService;
    catalogService: CatalogService;
    answerGenerator: AnswerGenerator;
  }
) {
  const { sessionService, catalogIndex, catalogService, answerGenerator } = deps;

  bot.on("callback_query", async (ctx) => {
    const data = (ctx.callbackQuery as any)?.data;
    const telegramId = ctx.from?.id;
    if (!telegramId || !data) {
      await safeAnswerCbQuery(ctx);
      return;
    }

    try {
      // Показать категории
      if (data === CALLBACK.showCategories) {
        await safeAnswerCbQuery(ctx, "Загружаю категории...");
        
        // Обновляем индекс категорий при каждом запросе
        const index = await catalogIndex.buildIndex();
        if (!index) {
          await sendAndTrack(ctx, sessionService['sessions'], "❌ Каталог загружается. Попробуйте позже.");
          return;
        }

        // Удаляем все предыдущие сообщения перед показом категорий
        await deletePreviousMessages(ctx, sessionService['sessions']);

        const categories = index.categories.map(c => ({ name: c.name, count: c.count }));
        
        // Получаем или создаем сессию и используем сохраненную страницу (или 0 если нет)
        let session = await sessionService.getOrCreate(telegramId);
        const savedPage = session.page ?? 0;
        session.categoryOptions = categories;
        await sessionService.update(session);

        await sendAndTrack(
          ctx,
          sessionService['sessions'],
          `📋 **Категории оборудования** (${index.totalItems} единиц, ${index.categories.length} категорий)\n\nВыберите категорию:`,
          { parse_mode: "Markdown", ...buildCategoriesKeyboard({ categories, page: savedPage }) }
        );
        return;
      }

      // Пагинация категорий
      if (data === CALLBACK.catPagePrev || data === CALLBACK.catPageNext) {
        await safeAnswerCbQuery(ctx);
        
        const index = await catalogIndex.buildIndex();
        let session = await sessionService.getOrCreate(telegramId);
        
        const categories = index.categories.map(c => ({ name: c.name, count: c.count }));
        session.categoryOptions = categories;
        
        if (data === CALLBACK.catPagePrev) {
          session.page = Math.max(0, session.page - 1);
        } else {
          session.page = session.page + 1;
        }
        await sessionService.update(session);

        await deletePreviousMessages(ctx, sessionService['sessions']);
        
        await sendAndTrack(
          ctx,
          sessionService['sessions'],
          `📋 **Категории оборудования** (${index.totalItems} единиц, ${index.categories.length} категорий)\n\nВыберите категорию:`,
          { parse_mode: "Markdown", ...buildCategoriesKeyboard({ categories, page: session.page }) }
        );
        return;
      }

      // Пагинация результатов категории
      if (data === CALLBACK.catResPagePrev || data === CALLBACK.catResPageNext) {
        let session = await sessionService.getOrCreate(telegramId);
        
        if (!session.categoryName) {
          await safeAnswerCbQuery(ctx, "Ошибка: категория не выбрана");
          return;
        }

        const categoryName = session.categoryName;
        const pageSize = parseInt(process.env.CATEGORY_RESULTS_PAGE_SIZE || "5", 10);
        const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 5;
        
        const totalResult = await catalogService.searchEquipment({ 
          category: categoryName, 
          limit: 1,
          offset: 0
        });

        if (totalResult.total === 0) {
          await safeAnswerCbQuery(ctx, "В категории ничего не найдено");
          return;
        }

        const totalPages = Math.ceil(totalResult.total / safePageSize);
        const currentPage = session.categoryResultsPage;
        
        let newPage: number;
        if (data === CALLBACK.catResPagePrev) {
          newPage = Math.max(0, currentPage - 1);
        } else {
          newPage = Math.min(totalPages - 1, currentPage + 1);
        }

        if (newPage === currentPage) {
          await safeAnswerCbQuery(ctx, `Вы уже на ${data === CALLBACK.catResPagePrev ? 'первой' : 'последней'} странице`);
          return;
        }

        session.categoryResultsPage = newPage;
        await sessionService.update(session);

        await safeAnswerCbQuery(ctx, `Загружаю страницу ${newPage + 1}...`);
        await ctx.sendChatAction("typing");

        await deletePreviousMessages(ctx, sessionService['sessions']);

        const offset = newPage * safePageSize;
        const result = await catalogService.searchEquipment({ 
          category: categoryName, 
          limit: safePageSize,
          offset: offset
        });

        if (result.total === 0 || result.items.length === 0) {
          await sendAndTrack(ctx, sessionService['sessions'], `❌ В категории «${categoryName}» ничего не найдено.`);
          return;
        }
        
        const actualTotalPages = Math.ceil(result.total / safePageSize);
        
        await sendSearchResults(ctx, sessionService['sessions'], result.items, answerGenerator);

        await sendAndTrack(
          ctx,
          sessionService['sessions'],
          `✅ **${categoryName}** — найдено: ${result.total} (стр. ${newPage + 1}/${actualTotalPages})`,
          {
            parse_mode: "Markdown",
            ...buildCategoryResultsKeyboard({
              page: newPage,
              totalPages: actualTotalPages,
              canPrev: newPage > 0,
              canNext: newPage < actualTotalPages - 1
            })
          }
        );
        return;
      }

      // Просмотр параметров категории
      if (data.startsWith(CALLBACK.catParamsPrefix)) {
        const catIndex = parseInt(data.slice(CALLBACK.catParamsPrefix.length), 10);
        let session = await sessionService.getOrCreate(telegramId);
        
        const categoryOption = session.categoryOptions?.[catIndex];
        if (!categoryOption) {
           await safeAnswerCbQuery(ctx, "Ошибка: категория не найдена (устаревшее меню?)");
           return;
        }

        const categoryName = categoryOption.name;
        await safeAnswerCbQuery(ctx, `Загружаю параметры...`);
        
        const pageSize = 8;
        const categoryPage = Math.floor(catIndex / pageSize);
        session.page = categoryPage;
        await sessionService.update(session);
        
        await deletePreviousMessages(ctx, sessionService['sessions']);
        
        const paramsWithCount = await catalogIndex.getCategoryParametersWithCount(categoryName);
        
        let msg = `⚙️ **Параметры для категории «${categoryName}»**:\n\n`;
        if (paramsWithCount.length === 0) {
            msg += "_Параметры не найдены._";
        } else {
            msg += paramsWithCount.map(p => `• ${p.name} (${p.count} шт.)`).join("\n");
        }
        
        msg += "\n\n_Эти параметры можно использовать при текстовом поиске._";

        await sendAndTrack(
            ctx,
            sessionService['sessions'],
            msg, 
            { 
                parse_mode: "Markdown", 
                ...buildCategoryParamsKeyboard({ categoryIndex: catIndex }) 
            }
        );
        return;
      }

      // Выбор категории — запуск поиска
      if (data.startsWith(CALLBACK.catPickPrefix)) {
        const catIndex = parseInt(data.slice(CALLBACK.catPickPrefix.length), 10);
        let session = await sessionService.getOrCreate(telegramId);
        
        const categoryOption = session.categoryOptions?.[catIndex];
        if (!categoryOption) {
           await safeAnswerCbQuery(ctx, "Ошибка: категория не найдена (устаревшее меню?)");
           return;
        }

        const categoryName = categoryOption.name;
        
        const categoriesPageSize = 8;
        const categoryPage = Math.floor(catIndex / categoriesPageSize);
        session.page = categoryPage;
        
        session.categoryName = categoryName;
        session.categoryResultsPage = 0;
        await sessionService.update(session);
        
        await safeAnswerCbQuery(ctx, `Ищу: ${categoryName}...`);
        await ctx.sendChatAction("typing");

        await deletePreviousMessages(ctx, sessionService['sessions']);

        const resultsPageSize = parseInt(process.env.CATEGORY_RESULTS_PAGE_SIZE || "5", 10);
        const safePageSize = Number.isInteger(resultsPageSize) && resultsPageSize > 0 ? resultsPageSize : 5;
        const offset = session.categoryResultsPage * safePageSize;

        const result = await catalogService.searchEquipment({ 
          category: categoryName, 
          limit: safePageSize,
          offset: offset
        });

        if (result.total === 0) {
          await sendAndTrack(
            ctx, 
            sessionService['sessions'],
            `❌ В категории «${categoryName}» ничего не найдено.\n\nВыберите действие:`,
            buildMainMenuKeyboard()
          );
        } else {
          const totalPages = Math.ceil(result.total / safePageSize);
          const currentPage = session.categoryResultsPage;
          
          await sendSearchResults(ctx, sessionService['sessions'], result.items, answerGenerator);

          await sendAndTrack(
            ctx, 
            sessionService['sessions'],
            `✅ **${categoryName}** — найдено: ${result.total} (стр. ${currentPage + 1}/${totalPages})`,
            { 
              parse_mode: "Markdown",
              ...buildCategoryResultsKeyboard({
                page: currentPage,
                totalPages: totalPages,
                canPrev: currentPage > 0,
                canNext: currentPage < totalPages - 1
              })
            }
          );
        }
        return;
      }

      // Вернуться в главное меню
      if (data === CALLBACK.backToMenu) {
        await safeAnswerCbQuery(ctx, "Возвращаюсь в главное меню...");
        
        await deletePreviousMessages(ctx, sessionService['sessions']);
        
        await sessionService.reset(telegramId);
        
        await sendAndTrack(
          ctx,
          sessionService['sessions'],
          "🔍 Напишите, что ищете, или выберите категорию:",
          buildMainMenuKeyboard()
        );
        return;
      }

      // Сброс
      if (data === CALLBACK.reset) {
        await deletePreviousMessages(ctx, sessionService['sessions']);
        await sessionService.reset(telegramId);
        await sendAndTrack(ctx, sessionService['sessions'], "🔄 Контекст сброшен. Что ищем?", buildMainMenuKeyboard());
        await safeAnswerCbQuery(ctx, "Контекст сброшен");
        return;
      }

      await safeAnswerCbQuery(ctx);
    } catch (error: any) {
      console.error("[Telegram] Callback error:", error);
      await safeAnswerCbQuery(ctx, "Ошибка");
    }
  });
}
