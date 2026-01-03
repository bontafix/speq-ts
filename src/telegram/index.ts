#!/usr/bin/env node

import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { AppContainer } from "../app/container";
import { InteractiveQueryBuilder } from "../llm/interactive-query.builder";
import { AnswerGenerator } from "../llm/answer.generator";
import { CatalogIndexService } from "../catalog/catalog-index.service";
import { createSessionStore } from "./session.store";
import type { WizardSession } from "./types";
import { logIncoming, logOutgoing } from "./telegram.logger";
import { CALLBACK, buildMainMenuKeyboard, buildCategoriesKeyboard, buildCategoryParamsKeyboard } from "./keyboards";

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
    lastResults: null,
    chatHistory: [],
    updatedAtMs: Date.now(),
  };
}

async function main() {
  const apiRoot = process.env.TELEGRAM_API_ROOT?.trim();
  console.log("[Telegram] Запуск процесса бота...");
  
  // 1. Инициализация AppContainer (как в CLI)
  const app = new AppContainer();
  console.log("[Telegram] Инициализация AppContainer...");
  await app.init();
  console.log("[Telegram] AppContainer готов.");

  // 2. Инициализация CatalogIndexService для категорий
  const catalogIndex = new CatalogIndexService();
  await catalogIndex.ensureIndex();
  console.log("[Telegram] CatalogIndex готов.");

  const answerGenerator = new AnswerGenerator();

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
    return await ctx.reply(text, extra);
  }

  async function resetToChat(ctx: any, telegramId: number) {
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
        // LLM хочет уточнить
        await reply(ctx, `❓ ${step.question}`);
      } else if (step.action === "final") {
        // LLM сформировал запрос
        console.log(`[Telegram] SearchQuery: ${JSON.stringify(step.query, null, 2)}`);
        
        // 3. Ищем
        const result = await app.catalogService.searchEquipment(step.query);

        // 4. Формируем ответ
        if (result.total === 0) {
          let msg = `❌ Ничего не найдено.`;
          if (result.message) msg += `\n💡 ${result.message}`;
          
          await reply(ctx, msg);
          
          // Можно добавить подсказки категорий, если есть в result.suggestions
          if (result.suggestions?.popularCategories?.length) {
              const cats = result.suggestions.popularCategories.map(c => `- ${c.name}`).join("\n");
              await reply(ctx, `Популярные категории:\n${cats}`);
          }

        } else {
          // Нашли
          let header = `✅ Найдено: ${result.total}`;
          if (result.message) header += `\n💡 ${result.message}`;
          await reply(ctx, header);

          const answerText = answerGenerator.generatePlainText(result.items);
          await reply(ctx, answerText);

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
      await ctx.answerCbQuery().catch(() => undefined);
      return;
    }

    try {
      // Показать категории
      if (data === CALLBACK.showCategories) {
        const index = catalogIndex.getIndex();
        if (!index) {
          await ctx.answerCbQuery("Каталог загружается...");
          return;
        }

        const categories = index.categories.map(c => ({ name: c.name, count: c.count }));
        
        // Сохраняем страницу в сессии
        let session = (await sessions.get(telegramId)) ?? newSession(telegramId);
        session.page = 0;
        session.categoryOptions = categories;
        await sessions.set(session);

        await ctx.editMessageText(
          `📋 **Категории оборудования** (${index.totalItems} единиц)\n\nВыберите категорию:`,
          { parse_mode: "Markdown", ...buildCategoriesKeyboard({ categories, page: 0 }) }
        );
        await ctx.answerCbQuery();
        return;
      }

      // Пагинация категорий
      if (data === CALLBACK.catPagePrev || data === CALLBACK.catPageNext) {
        let session = (await sessions.get(telegramId)) ?? newSession(telegramId);
        const categories = session.categoryOptions ?? [];
        
        if (data === CALLBACK.catPagePrev) {
          session.page = Math.max(0, session.page - 1);
        } else {
          session.page = session.page + 1;
        }
        await sessions.set(session);

        await ctx.editMessageReplyMarkup(
          buildCategoriesKeyboard({ categories, page: session.page }).reply_markup
        );
        await ctx.answerCbQuery();
        return;
      }

      // Просмотр параметров категории
      if (data.startsWith(CALLBACK.catParamsPrefix)) {
        const catIndex = parseInt(data.slice(CALLBACK.catParamsPrefix.length), 10);
        let session = (await sessions.get(telegramId)) ?? newSession(telegramId);
        
        const categoryOption = session.categoryOptions?.[catIndex];
        if (!categoryOption) {
           await ctx.answerCbQuery("Ошибка: категория не найдена (устаревшее меню?)");
           return;
        }

        const categoryName = categoryOption.name;
        await ctx.answerCbQuery(`Загружаю параметры...`);
        
        // Получаем параметры с количеством оборудования
        const paramsWithCount = await catalogIndex.getCategoryParametersWithCount(categoryName);
        
        let msg = `⚙️ **Параметры для категории «${categoryName}»**:\n\n`;
        if (paramsWithCount.length === 0) {
            msg += "_Параметры не найдены._";
        } else {
            msg += paramsWithCount.map(p => `• ${p.name} (${p.count} шт.)`).join("\n");
        }
        
        msg += "\n\n_Эти параметры можно использовать при текстовом поиске._";

        await ctx.editMessageText(
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
           await ctx.answerCbQuery("Ошибка: категория не найдена (устаревшее меню?)");
           return;
        }

        const categoryName = categoryOption.name;
        
        await ctx.answerCbQuery(`Ищу: ${categoryName}...`);
        await ctx.sendChatAction("typing");

        // Поиск по категории
        const result = await app.catalogService.searchEquipment({ 
          category: categoryName, 
          limit: 10 
        });

        if (result.total === 0) {
          await reply(ctx, `❌ В категории «${categoryName}» ничего не найдено.`);
        } else {
          await reply(ctx, `✅ **${categoryName}** — найдено: ${result.total}`, { parse_mode: "Markdown" });
          const answerText = answerGenerator.generatePlainText(result.items);
          await reply(ctx, answerText);
        }

        await reply(
          ctx, 
          "Напишите уточнение или выберите действие:",
          buildMainMenuKeyboard()
        );
        return;
      }

      // Вернуться в главное меню
      if (data === CALLBACK.backToMenu) {
        await ctx.editMessageText(
          "🔍 Напишите, что ищете, или выберите категорию:",
          buildMainMenuKeyboard()
        );
        await ctx.answerCbQuery();
        return;
      }

      // Сброс
      if (data === CALLBACK.reset) {
        await resetToChat(ctx, telegramId);
        await ctx.answerCbQuery("Контекст сброшен");
        return;
      }

      await ctx.answerCbQuery();
    } catch (error: any) {
      console.error("[Telegram] Callback error:", error);
      await ctx.answerCbQuery("Ошибка").catch(() => undefined);
    }
  });

  // 1. Установка команд меню
  console.log("[Telegram] Настройка команд меню...");
  await bot.telegram.setMyCommands([
    { command: "start", description: "Начать диалог / Сброс" },
    { command: "reset", description: "Сбросить контекст поиска" },
    { command: "search", description: "Новый поиск" },
    { command: "help", description: "Справка" },
  ]);

  // Проверка и запуск
  console.log("[Telegram] Проверка Telegram API (getMe)...");
  try {
    const me = await withTimeout(bot.telegram.getMe(), 10000, "telegram.getMe");
    console.log(`✅ [Telegram] Bot: @${me.username || "unknown"} (id=${me.id})`);
  } catch (e: any) {
    console.error("[Telegram] Не удалось проверить getMe:", e?.message);
    process.exit(1);
  }

  console.log("[Telegram] Запускаю polling...");
  bot.launch().then(() => {
    console.log("✅ [Telegram] Polling запущен — бот работает");
  }).catch((e: any) => {
    console.error("[Telegram] Ошибка bot.launch():", e?.message);
    process.exit(1);
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

void main();
