#!/usr/bin/env node

import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { AppContainer } from "../app/container";
import { InteractiveQueryBuilder } from "../llm/interactive-query.builder";
import { AnswerGenerator } from "../llm/answer.generator";
import { CatalogIndexService } from "../catalog/catalog-index.service";
import type { EquipmentSummary } from "../catalog/catalog.types";
import { createSessionStore } from "./session.store";
import type { WizardSession } from "./types";
import { logIncoming, logOutgoing } from "./telegram.logger";
import { CALLBACK, buildMainMenuKeyboard, buildCategoriesKeyboard, buildCategoryParamsKeyboard, buildCategoryResultsKeyboard } from "./keyboards";

function requireBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN не задан. Добавьте токен в env и перезапустите.");
  }
  const looksValid = /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token);
  if (!looksValid) {
    const masked = token.length <= 12 ? "***" : `${token.slice(0, 6)}…${token.slice(-4)}`;
    throw new Error(
      `TELEGRAM_BOT_TOKEN выглядит некорректно (${masked}). ` +
        `Ожидается формат вида "123456789:AA...". Проверь токен от @BotFather.`,
    );
  }
  return token;
}

function newSession(telegramId: number): WizardSession {
  return {
    telegramId,
    step: "S_CHAT",
    seedText: null,
    categoryName: null,
    typeText: null,
    paramText: null,
    page: 0,
    categoryOptions: null,
    categoryResultsPage: 0,
    lastResults: null,
    chatHistory: [],
    messageIds: [],
    updatedAtMs: Date.now(),
  };
}

/**
 * Инициализирует и настраивает бота со всеми обработчиками
 * Возвращает экземпляр бота для использования в webhook или polling
 */
export async function setupBot() {
  const apiRoot = process.env.TELEGRAM_API_ROOT?.trim();
  console.log("[Telegram] Инициализация бота...");
  
  // 1. Инициализация AppContainer (как в CLI)
  const app = new AppContainer();
  console.log("[Telegram] Инициализация AppContainer...");
  await app.init();
  console.log("[Telegram] AppContainer готов.");

  // 2. Инициализация CatalogIndexService для категорий
  const catalogIndex = new CatalogIndexService();
  await catalogIndex.ensureIndex();
  console.log("[Telegram] CatalogIndex готов.");

  // Инициализируем AnswerGenerator с базовым URL для изображений
  const imageBaseUrl = process.env.IMAGE_BASE_URL?.trim();
  const answerGenerator = new AnswerGenerator(undefined, imageBaseUrl);

  console.log(`[Telegram] API: ${apiRoot || "https://api.telegram.org"}`);
  const bot = new Telegraf(requireBotToken(), apiRoot ? { telegram: { apiRoot } } : undefined);

  const withTimeout = async <T>(p: Promise<T>, ms: number, label: string): Promise<T> => {
    let t: NodeJS.Timeout | null = null;
    const timeout = new Promise<T>((_, reject) => {
      t = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      if (t) clearTimeout(t);
    }
  };

  console.log("[Telegram] Инициализация session store...");
  const sessions = await withTimeout(createSessionStore(), 8000, "createSessionStore");
  console.log("[Telegram] Session store готов.");

  async function reply(ctx: any, text: string, extra?: any) {
    logOutgoing({
      telegramId: ctx.from?.id,
      username: ctx.from?.username,
      kind: "reply",
      payload: text,
    });
    const message = await ctx.reply(text, extra);
    
    // Сохраняем message_id в сессию для возможности удаления
    if (message?.message_id && ctx.from?.id) {
      const session = (await sessions.get(ctx.from.id)) ?? newSession(ctx.from.id);
      if (!session.messageIds) {
        session.messageIds = [];
      }
      session.messageIds.push(message.message_id);
      await sessions.set(session);
    }
    
    return message;
  }

  /**
   * Отправляет результаты поиска: фото с подписями для оборудования с изображениями,
   * текстовые сообщения для оборудования без изображений.
   * Обрабатывает rate limits и сохраняет message_id в сессию.
   * 
   * @param ctx - контекст Telegram
   * @param items - список оборудования (EquipmentSummary)
   */
  async function sendSearchResults(ctx: any, items: EquipmentSummary[]) {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item) continue;
      
      const imageUrl = answerGenerator.getImageUrl(item.id);
      
      if (imageUrl) {
        // Отправляем фото с полной подписью
        try {
          const caption = answerGenerator.formatPhotoCaption(item, index);
          const message = await ctx.replyWithPhoto(imageUrl, { caption });
          
          // Сохраняем message_id в сессию
          if (message?.message_id && ctx.from?.id) {
            const session = (await sessions.get(ctx.from.id)) ?? newSession(ctx.from.id);
            if (!session.messageIds) {
              session.messageIds = [];
            }
            session.messageIds.push(message.message_id);
            await sessions.set(session);
          }
        } catch (error: any) {
          // Обрабатываем ошибку 429 (Too Many Requests) - добавляем задержку
          const errorMessage = error?.response?.description || error?.message || "";
          if (errorMessage.includes("Too Many Requests") || error?.response?.error_code === 429) {
            const retryAfter = error?.response?.parameters?.retry_after || 10;
            console.warn(`[Telegram] Rate limit (429) для ${item.id}, ждем ${retryAfter} секунд...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            // Не повторяем попытку автоматически, просто пропускаем это изображение
          } else {
            // Для других ошибок просто логируем
            console.warn(`[Telegram] Не удалось отправить изображение для ${item.id} (URL: ${imageUrl}):`, errorMessage);
          }
        }
      } else {
        // Для оборудования без фото отправляем текстовое сообщение
        const text = answerGenerator.formatItem(item, index, false);
        try {
          const message = await reply(ctx, text);
          // message_id уже сохранен в функции reply
        } catch (error: any) {
          console.warn(`[Telegram] Не удалось отправить текстовое сообщение для ${item.id}:`, error?.message);
        }
      }
    }
  }

  /**
   * Безопасный ответ на callback_query
   * Игнорирует ошибки "query is too old" и другие некритичные ошибки
   */
  async function safeAnswerCbQuery(ctx: any, text?: string): Promise<void> {
    try {
      await ctx.answerCbQuery(text);
    } catch (error: any) {
      // Игнорируем ошибки "query is too old" - это нормально для старых запросов
      const errorMessage = error?.response?.description || error?.message || "";
      if (
        errorMessage.includes("query is too old") ||
        errorMessage.includes("response timeout expired") ||
        errorMessage.includes("query ID is invalid")
      ) {
        // Это нормально - запрос устарел, просто игнорируем
        return;
      }
      // Для других ошибок логируем, но не падаем
      console.warn(`[Telegram] Ошибка при answerCbQuery:`, errorMessage);
    }
  }

  /**
   * Удаляет все предыдущие сообщения бота из чата
   */
  async function deletePreviousMessages(ctx: any, telegramId: number) {
    try {
      const session = await sessions.get(telegramId);
      if (!session?.messageIds || session.messageIds.length === 0) {
        return;
      }

      const chatId = ctx.chat?.id || ctx.from?.id;
      if (!chatId) return;

      // Удаляем все сообщения бота
      const deletePromises = session.messageIds.map((messageId) =>
        bot.telegram.deleteMessage(chatId, messageId).catch((err: any) => {
          // Игнорируем ошибки удаления (сообщение уже удалено или недоступно)
          if (err?.response?.error_code !== 400 && err?.response?.error_code !== 403) {
            console.warn(`[Telegram] Не удалось удалить сообщение ${messageId}:`, err?.message);
          }
        })
      );

      await Promise.all(deletePromises);

      // Очищаем список messageIds
      session.messageIds = [];
      await sessions.set(session);
    } catch (error: any) {
      console.error("[Telegram] Ошибка при удалении предыдущих сообщений:", error?.message);
    }
  }

  async function resetToChat(ctx: any, telegramId: number) {
    // Удаляем все предыдущие сообщения перед показом главного меню
    await deletePreviousMessages(ctx, telegramId);
    
    const s = newSession(telegramId);
    await sessions.set(s);
    await reply(ctx, "🔄 Контекст сброшен. Что ищем?", buildMainMenuKeyboard());
  }

  // Лог всех входящих апдейтов (сообщения/кнопки)
  bot.use(async (ctx, next) => {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username;
    const text = (ctx.message as any)?.text;
    const cb = (ctx.callbackQuery as any)?.data;
    if (typeof text === "string") {
      logIncoming({ telegramId, username, kind: "text", payload: text });
    } else if (typeof cb === "string") {
      logIncoming({ telegramId, username, kind: "callback", payload: cb });
    } else {
      logIncoming({ telegramId, username, kind: "other", payload: ctx.updateType || "unknown" });
    }
    return await next();
  });

  bot.start(async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Удаляем все предыдущие сообщения перед показом главного меню
    await deletePreviousMessages(ctx, telegramId);

    const s = newSession(telegramId);
    await sessions.set(s);

    await reply(
      ctx, 
      "👋 Привет! Я умный ассистент по подбору оборудования (Speq v2.0).\n\n" +
      "🔍 **Напишите, что ищете**, например:\n" +
      "• «Мне нужен кран грузоподъемностью 50 тонн»\n" +
      "• «Экскаватор Caterpillar»\n\n" +
      "Или нажмите кнопку ниже, чтобы посмотреть категории.",
      { parse_mode: "Markdown", ...buildMainMenuKeyboard() }
    );
  });

  bot.command("search", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await resetToChat(ctx, telegramId);
  });

  bot.command("reset", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await resetToChat(ctx, telegramId);
  });

  bot.command("help", async (ctx) => {
    await reply(ctx, "Команды:\n/start — Начать заново\n/reset — Сброс контекста\n/search — Новый поиск");
  });

  bot.on("text", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const text: string = ctx.message.text.trim();
    if (!text) return;

    if (text === "/exit") {
       await reply(ctx, "До свидания!");
       return;
    }

    // Получаем или создаем сессию
    let session = (await sessions.get(telegramId)) ?? newSession(telegramId);
    
    // Если сессия была в старом формате или шаг не S_CHAT, сбрасываем в S_CHAT (миграция)
    if (session.step !== "S_CHAT") {
        session = newSession(telegramId);
        // Если текст похож на команду, это обработается ниже, иначе это первый запрос
    }

    try {
      await ctx.sendChatAction("typing");

      // 1. Создаем билдер с восстановленной историей
      const builder = new InteractiveQueryBuilder(app.llmFactory, {
        model: app.config.llm.model,
        maxTurns: app.config.llm.dialogMaxTurns,
        history: session.chatHistory ?? []
      });

      // 2. Получаем следующий шаг
      const step = await builder.next(text);

      // Сохраняем обновленную историю
      session.chatHistory = builder.getHistory();
      session.updatedAtMs = Date.now();
      await sessions.set(session);

      if (step.action === "ask") {
        // LLM хочет уточнить - не удаляем предыдущие сообщения, продолжаем диалог
        await reply(ctx, `❓ ${step.question}`);
      } else if (step.action === "final") {
        // LLM сформировал запрос - удаляем предыдущие сообщения перед показом результатов
        await deletePreviousMessages(ctx, telegramId);
        
        console.log(`[Telegram] SearchQuery: ${JSON.stringify(step.query, null, 2)}`);
        
        // 3. Ищем
        const result = await app.catalogService.searchEquipment(step.query);

        // 4. Формируем ответ
        if (result.total === 0) {
          let msg = `❌ Ничего не найдено.`;
          if (result.message) msg += `\n💡 ${result.message}`;
          
          await reply(ctx, msg, buildMainMenuKeyboard());
          
          // Можно добавить подсказки категорий, если есть в result.suggestions
          if (result.suggestions?.popularCategories?.length) {
              const cats = result.suggestions.popularCategories.map(c => `- ${c.name}`).join("\n");
              await reply(ctx, `Популярные категории:\n${cats}`);
          }

        } else {
          // Нашли
          let header = `✅ Найдено: ${result.total}`;
          if (result.message) header += `\n💡 ${result.message}`;
          await reply(ctx, header, buildMainMenuKeyboard());

          // Отправляем результаты: фото с подписями для оборудования с изображениями,
          // текстовые сообщения для оборудования без изображений
          await sendSearchResults(ctx, result.items);

          // 5. Обогащаем контекст результатами
          const summary = result.items.slice(0, 5)
            .map(i => `- ${i.name} (Price: ${i.price}, Brand: ${i.brand}, Params: ${JSON.stringify(i.mainParameters)})`)
            .join("\n");
          
          builder.addSearchResults(result.total, summary);
          session.chatHistory = builder.getHistory();
          await sessions.set(session);
        }
      }

    } catch (error: any) {
      console.error("Error in chat handler:", error);
      await reply(ctx, "❌ Произошла ошибка при обработке запроса. Попробуйте еще раз или напишите /reset.");
    }
  });

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
          await reply(ctx, "❌ Каталог загружается. Попробуйте позже.");
          return;
        }

        // Удаляем все предыдущие сообщения перед показом категорий
        await deletePreviousMessages(ctx, telegramId);

        const categories = index.categories.map(c => ({ name: c.name, count: c.count }));
        
        // Получаем или создаем сессию и используем сохраненную страницу (или 0 если нет)
        let session = (await sessions.get(telegramId)) ?? newSession(telegramId);
        const savedPage = session.page ?? 0;
        session.categoryOptions = categories;
        // Не сбрасываем session.page, чтобы сохранить текущую страницу
        await sessions.set(session);

        await reply(
          ctx,
          `📋 **Категории оборудования** (${index.totalItems} единиц, ${index.categories.length} категорий)\n\nВыберите категорию:`,
          { parse_mode: "Markdown", ...buildCategoriesKeyboard({ categories, page: savedPage }) }
        );
        return;
      }

      // Пагинация категорий
      if (data === CALLBACK.catPagePrev || data === CALLBACK.catPageNext) {
        await safeAnswerCbQuery(ctx);
        
        // Обновляем индекс категорий при пагинации для актуальных данных
        const index = await catalogIndex.buildIndex();
        
        let session = (await sessions.get(telegramId)) ?? newSession(telegramId);
        
        // Обновляем список категорий из свежего индекса
        const categories = index.categories.map(c => ({ name: c.name, count: c.count }));
        session.categoryOptions = categories;
        
        if (data === CALLBACK.catPagePrev) {
          session.page = Math.max(0, session.page - 1);
        } else {
          session.page = session.page + 1;
        }
        await sessions.set(session);

        // Удаляем предыдущие сообщения и показываем новую страницу
        await deletePreviousMessages(ctx, telegramId);
        
        const totalItems = index.totalItems;
        const categoriesCount = index.categories.length;
        
        await reply(
          ctx,
          `📋 **Категории оборудования** (${totalItems} единиц, ${categoriesCount} категорий)\n\nВыберите категорию:`,
          { parse_mode: "Markdown", ...buildCategoriesKeyboard({ categories, page: session.page }) }
        );
        return;
      }

      // Пагинация результатов категории
      if (data === CALLBACK.catResPagePrev || data === CALLBACK.catResPageNext) {
        let session = (await sessions.get(telegramId)) ?? newSession(telegramId);
        
        if (!session.categoryName) {
          await safeAnswerCbQuery(ctx, "Ошибка: категория не выбрана");
          return;
        }

        const categoryName = session.categoryName;
        const pageSize = parseInt(process.env.CATEGORY_RESULTS_PAGE_SIZE || "5", 10);
        const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 5;
        
        // Обновляем страницу
        if (data === CALLBACK.catResPagePrev) {
          session.categoryResultsPage = Math.max(0, session.categoryResultsPage - 1);
        } else {
          session.categoryResultsPage = session.categoryResultsPage + 1;
        }
        await sessions.set(session);

        await safeAnswerCbQuery(ctx, `Загружаю страницу ${session.categoryResultsPage + 1}...`);
        await ctx.sendChatAction("typing");

        // Удаляем предыдущие сообщения перед показом новой страницы
        await deletePreviousMessages(ctx, telegramId);

        const offset = session.categoryResultsPage * safePageSize;
        const result = await app.catalogService.searchEquipment({ 
          category: categoryName, 
          limit: safePageSize,
          offset: offset
        });

        if (result.total === 0) {
          await reply(ctx, `❌ В категории «${categoryName}» ничего не найдено.`);
          return;
        }

        const totalPages = Math.ceil(result.total / safePageSize);
        const currentPage = session.categoryResultsPage;
        
        // Сначала отправляем результаты: фото с подписями для оборудования с изображениями,
        // текстовые сообщения для оборудования без изображений
        await sendSearchResults(ctx, result.items);

        // Затем отправляем заголовок с клавиатурой пагинации
        await reply(
          ctx,
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
        return;
      }

      // Просмотр параметров категории
      if (data.startsWith(CALLBACK.catParamsPrefix)) {
        const catIndex = parseInt(data.slice(CALLBACK.catParamsPrefix.length), 10);
        let session = (await sessions.get(telegramId)) ?? newSession(telegramId);
        
        const categoryOption = session.categoryOptions?.[catIndex];
        if (!categoryOption) {
           await safeAnswerCbQuery(ctx, "Ошибка: категория не найдена (устаревшее меню?)");
           return;
        }

        const categoryName = categoryOption.name;
        await safeAnswerCbQuery(ctx, `Загружаю параметры...`);
        
        // Вычисляем страницу категории по индексу и сохраняем её
        const pageSize = 8; // Размер страницы по умолчанию (как в buildCategoriesKeyboard)
        const categoryPage = Math.floor(catIndex / pageSize);
        session.page = categoryPage;
        await sessions.set(session);
        
        // Удаляем предыдущие сообщения перед показом параметров
        await deletePreviousMessages(ctx, telegramId);
        
        // Получаем параметры с количеством оборудования
        const paramsWithCount = await catalogIndex.getCategoryParametersWithCount(categoryName);
        
        let msg = `⚙️ **Параметры для категории «${categoryName}»**:\n\n`;
        if (paramsWithCount.length === 0) {
            msg += "_Параметры не найдены._";
        } else {
            msg += paramsWithCount.map(p => `• ${p.name} (${p.count} шт.)`).join("\n");
        }
        
        msg += "\n\n_Эти параметры можно использовать при текстовом поиске._";

        await reply(
            ctx,
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
        let session = (await sessions.get(telegramId)) ?? newSession(telegramId);
        
        const categoryOption = session.categoryOptions?.[catIndex];
        if (!categoryOption) {
           await safeAnswerCbQuery(ctx, "Ошибка: категория не найдена (устаревшее меню?)");
           return;
        }

        const categoryName = categoryOption.name;
        
        // Вычисляем страницу категории по индексу и сохраняем её для возврата
        const categoriesPageSize = 8; // Размер страницы категорий по умолчанию (как в buildCategoriesKeyboard)
        const categoryPage = Math.floor(catIndex / categoriesPageSize);
        session.page = categoryPage;
        
        // Сбрасываем страницу результатов при выборе новой категории
        session.categoryName = categoryName;
        session.categoryResultsPage = 0;
        await sessions.set(session);
        
        await safeAnswerCbQuery(ctx, `Ищу: ${categoryName}...`);
        await ctx.sendChatAction("typing");

        // Удаляем предыдущие сообщения перед показом результатов
        await deletePreviousMessages(ctx, telegramId);

        // Получаем размер страницы результатов из env (по умолчанию 5)
        const resultsPageSize = parseInt(process.env.CATEGORY_RESULTS_PAGE_SIZE || "5", 10);
        const safePageSize = Number.isInteger(resultsPageSize) && resultsPageSize > 0 ? resultsPageSize : 5;
        const offset = session.categoryResultsPage * safePageSize;

        // Поиск по категории с пагинацией
        const result = await app.catalogService.searchEquipment({ 
          category: categoryName, 
          limit: safePageSize,
          offset: offset
        });

        if (result.total === 0) {
          await reply(
            ctx, 
            `❌ В категории «${categoryName}» ничего не найдено.\n\nВыберите действие:`,
            buildMainMenuKeyboard()
          );
        } else {
          const totalPages = Math.ceil(result.total / safePageSize);
          const currentPage = session.categoryResultsPage;
          
          // Сначала отправляем результаты: фото с подписями для оборудования с изображениями,
          // текстовые сообщения для оборудования без изображений
          await sendSearchResults(ctx, result.items);

          // Затем отправляем заголовок с клавиатурой пагинации
          await reply(
            ctx, 
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
        
        // Удаляем все предыдущие сообщения перед показом главного меню
        await deletePreviousMessages(ctx, telegramId);
        
        // Сбрасываем сессию
        const s = newSession(telegramId);
        await sessions.set(s);
        
        // Отправляем новое сообщение с главным меню
        await reply(
          ctx,
          "🔍 Напишите, что ищете, или выберите категорию:",
          buildMainMenuKeyboard()
        );
        return;
      }

      // Сброс
      if (data === CALLBACK.reset) {
        await resetToChat(ctx, telegramId);
        await safeAnswerCbQuery(ctx, "Контекст сброшен");
        return;
      }

      await safeAnswerCbQuery(ctx);
    } catch (error: any) {
      console.error("[Telegram] Callback error:", error);
      await safeAnswerCbQuery(ctx, "Ошибка");
    }
  });

  // Установка команд меню
  console.log("[Telegram] Настройка команд меню...");
  await bot.telegram.setMyCommands([
    { command: "start", description: "Начать диалог / Сброс" },
    { command: "reset", description: "Сбросить контекст поиска" },
    { command: "search", description: "Новый поиск" },
    { command: "help", description: "Справка" },
  ]);

  // Проверка Telegram API
  console.log("[Telegram] Проверка Telegram API (getMe)...");
  try {
    const me = await withTimeout(bot.telegram.getMe(), 10000, "telegram.getMe");
    console.log(`✅ [Telegram] Bot: @${me.username || "unknown"} (id=${me.id})`);
  } catch (e: any) {
    console.error("[Telegram] Не удалось проверить getMe:", e?.message);
    throw e; // Пробрасываем ошибку вместо process.exit
  }

  return bot;
}

/**
 * Устанавливает webhook для бота
 * @param webhookUrl - Полный URL для webhook (например, https://example.com/telegram/webhook)
 */
export async function setWebhook(webhookUrl: string): Promise<void> {
  const token = requireBotToken();
  const apiRoot = process.env.TELEGRAM_API_ROOT?.trim();
  const bot = new Telegraf(token, apiRoot ? { telegram: { apiRoot } } : undefined);
  
  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ [Telegram] Webhook установлен: ${webhookUrl}`);
  } catch (error: any) {
    console.error(`[Telegram] Ошибка установки webhook:`, error?.message);
    throw error;
  }
}

/**
 * Удаляет webhook (возвращает бота к polling)
 */
export async function deleteWebhook(): Promise<void> {
  const token = requireBotToken();
  const apiRoot = process.env.TELEGRAM_API_ROOT?.trim();
  const bot = new Telegraf(token, apiRoot ? { telegram: { apiRoot } } : undefined);
  
  try {
    await bot.telegram.deleteWebhook();
    console.log(`✅ [Telegram] Webhook удален`);
  } catch (error: any) {
    console.error(`[Telegram] Ошибка удаления webhook:`, error?.message);
    throw error;
  }
}

/**
 * Получает информацию о текущем webhook
 */
export async function getWebhookInfo(): Promise<any> {
  const token = requireBotToken();
  const apiRoot = process.env.TELEGRAM_API_ROOT?.trim();
  const bot = new Telegraf(token, apiRoot ? { telegram: { apiRoot } } : undefined);
  
  try {
    const info = await bot.telegram.getWebhookInfo();
    return info;
  } catch (error: any) {
    console.error(`[Telegram] Ошибка получения информации о webhook:`, error?.message);
    throw error;
  }
}

/**
 * Обработчик обновлений для webhook
 * Используется в HTTP сервере для обработки POST запросов от Telegram
 */
let botInstance: Telegraf | null = null;

export async function getBotInstance(): Promise<Telegraf> {
  if (!botInstance) {
    botInstance = await setupBot();
  }
  return botInstance;
}

/**
 * Обрабатывает обновление от Telegram (для webhook)
 */
export async function handleUpdate(update: any): Promise<void> {
  const bot = await getBotInstance();
  await bot.handleUpdate(update);
}

/**
 * Запускает бота в режиме polling (для обратной совместимости)
 */
async function main() {
  try {
    const bot = await setupBot();

    console.log("[Telegram] Запускаю polling...");
    bot.launch().then(() => {
      console.log("✅ [Telegram] Polling запущен — бот работает");
    }).catch((e: any) => {
      console.error("[Telegram] Ошибка bot.launch():", e?.message);
      process.exit(1);
    });

    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (e: any) {
    console.error("[Telegram] Ошибка инициализации бота:", e?.message);
    process.exit(1);
  }
}

// Запускаем polling только если файл запущен напрямую
if (require.main === module) {
  void main();
}
