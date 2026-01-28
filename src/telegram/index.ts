#!/usr/bin/env node

import "../config/env-loader";
import { Telegraf } from "telegraf";
import { AppContainer } from "../app/container";
import { AnswerGenerator } from "../llm/answer.generator";
import { CatalogIndexService } from "../catalog/catalog-index.service";
import { createSessionStore } from "./session.store";
import { logIncoming, logOutgoing } from "./telegram.logger";
import { SessionService } from "./services/session.service";
import { setupCommandHandlers } from "./handlers/command.handler";
import { setupTextHandler } from "./handlers/text.handler";
import { setupCallbackHandlers } from "./handlers/callback.handler";
import { version as appVersion } from "../../package.json";

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

/**
 * Инициализирует и настраивает бота со всеми обработчиками
 * Возвращает экземпляр бота для использования в webhook или polling
 */
export async function setupBot() {
  const apiRoot = process.env.TELEGRAM_API_ROOT?.trim();
  console.log(`[Telegram] Инициализация бота... версия=${appVersion}, NODE_ENV=${process.env.NODE_ENV || "development"}`);
  
  // 1. Инициализация AppContainer
  const app = new AppContainer();
  console.log("[Telegram] Инициализация AppContainer...");
  await app.init();
  console.log("[Telegram] AppContainer готов.");

  // 1.1 Проверяем доступность LLM-провайдера для диалога ещё до запуска бота
  try {
    console.log("[Telegram][LLM] Проверка доступности chat провайдера...");
    await app.llmFactory.ensureChatReady();
    const llmConfig = app.llmFactory.getConfig();
    const health = await app.llmFactory.checkHealth();
    const providersStatus = ["groq", "openai", "ollama"]
      .map((name) => {
        const status = health[name] === undefined ? "-" : health[name] ? "ok" : "fail";
        return `${name}:${status}`;
      })
      .join(", ");

    console.log(
      `[Telegram][LLM] Chat провайдер готов. ` +
        `chat=${llmConfig.chatProvider}, embed=${llmConfig.embeddingsProvider}, ` +
        `fallbacks=${(llmConfig.fallbackProviders ?? []).join(",") || "-"}, ` +
        `providers=[${providersStatus}]`,
    );
  } catch (e: any) {
    console.error("[Telegram][LLM] Ошибка инициализации LLM chat провайдера:", e?.message);
    if (process.env.TELEGRAM_STRICT_LLM_STARTUP === "true") {
      // В строгом режиме падаем сразу, чтобы не получать ошибки уже во время диалога.
      throw e;
    } else {
      console.error(
        "[Telegram][LLM] Продолжаем запуск бота без гарантии работоспособности LLM. " +
          "Рекомендуется запустить `npm run llm:health` и проверить конфигурацию.",
      );
    }
  }

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

  // Инициализация сервисов
  const sessionService = new SessionService(sessions);
  
  // Привязываем store к сервису для доступа извне (для legacy кода, если нужно)
  (sessionService as any).sessions = sessions;

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

  // Регистрация обработчиков
  setupCommandHandlers(bot, sessionService);
  
  setupTextHandler(bot, {
    sessionService,
    llmFactory: app.llmFactory,
    catalogService: app.catalogService,
    answerGenerator,
    config: app.config
  });
  
  setupCallbackHandlers(bot, {
    sessionService,
    catalogIndex,
    catalogService: app.catalogService,
    answerGenerator
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
    throw e;
  }

  return bot;
}

/**
 * Устанавливает webhook для бота
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
 * Удаляет webhook
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
 * Запускает бота в режиме polling
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
