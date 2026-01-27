import { Context, Markup } from 'telegraf';
import { SessionStore } from '../session.store';
import { WizardSession } from '../types';
import { EquipmentSummary } from '../../catalog/catalog.types';
import { formatCategoryEquipmentPhotoCaption, formatCategoryEquipmentText } from '../view.format';
import { AnswerGenerator } from '../../llm/answer.generator';

/**
 * Утилиты для работы с сообщениями
 */

/**
 * Получает или создает сессию
 */
export async function getOrCreateSession(
  userId: number,
  sessions: SessionStore
): Promise<WizardSession> {
  const existing = await sessions.get(userId);
  if (existing) return existing;
  
  return {
    telegramId: userId,
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
 * Отправляет сообщение и сохраняет message_id
 */
export async function sendAndTrack(
  ctx: Context,
  sessions: SessionStore,
  text: string,
  extra?: any
) {
  const message = await ctx.reply(text, extra);
  
  if (message?.message_id && ctx.from?.id) {
    const session = await getOrCreateSession(ctx.from.id, sessions);
    
    if (!session.messageIds) {
      session.messageIds = [];
    }
    
    session.messageIds.push(message.message_id);
    await sessions.set(session);
  }
  
  return message;
}

/**
 * Удаляет предыдущие сообщения бота
 */
export async function deletePreviousMessages(
  ctx: Context,
  sessions: SessionStore
) {
  if (!ctx.from?.id) return;
  
  try {
    const session = await sessions.get(ctx.from.id);
    if (!session?.messageIds || session.messageIds.length === 0) return;

    const chatId = ctx.chat?.id || ctx.from.id;
    if (!chatId) return;

    const deletePromises = session.messageIds.map((messageId) =>
      ctx.telegram.deleteMessage(chatId, messageId).catch((err: any) => {
        // Игнорируем ошибки удаления (сообщение уже удалено или недоступно)
        if (err?.response?.error_code !== 400 && err?.response?.error_code !== 403) {
          console.warn(`[Telegram] Не удалось удалить сообщение ${messageId}:`, err?.message);
        }
      })
    );

    await Promise.all(deletePromises);

    // Очищаем список
    session.messageIds = [];
    await sessions.set(session);
  } catch (error: any) {
    console.error("[Telegram] Ошибка при удалении предыдущих сообщений:", error?.message);
  }
}

/**
 * Безопасный ответ на callback_query
 */
export async function safeAnswerCbQuery(ctx: Context, text?: string): Promise<void> {
  try {
    await ctx.answerCbQuery(text);
  } catch (error: any) {
    // Игнорируем ошибки "query is too old" и подобные
    const errorMessage = error?.response?.description || error?.message || "";
    if (
      errorMessage.includes("query is too old") ||
      errorMessage.includes("response timeout expired") ||
      errorMessage.includes("query ID is invalid")
    ) {
      return;
    }
    console.warn(`[Telegram] Ошибка при answerCbQuery:`, errorMessage);
  }
}

/**
 * Получает URL для mini web app карточки оборудования
 */
export function getWebAppUrl(equipmentId: string): string | null {
  const webappBaseUrl = process.env.WEBAPP_BASE_URL?.trim();
  if (!webappBaseUrl) {
    return null;
  }
  
  if (!/^https:\/\//i.test(webappBaseUrl)) {
    console.warn(`[Telegram] WEBAPP_BASE_URL должен начинаться с https://: ${webappBaseUrl}`);
    return null;
  }

  // Поддержка HashRouter и HistoryRouter
  if (webappBaseUrl.includes("#")) {
    const parts = webappBaseUrl.split("#", 2);
    const beforeHash = parts[0] ?? "";
    const afterHashRaw = parts[1] ?? "";
    const base = beforeHash.replace(/\/$/, "");
    const afterHash = afterHashRaw.replace(/^\/+/, "").replace(/\/+$/, "");
    const route = `equipment/${equipmentId}`;
    const fullHashPath = afterHash ? `${afterHash}/${route}` : route;
    return `${base}#/${fullHashPath}`;
  }

  let base = webappBaseUrl.replace(/\/$/, "");
  if (!base.endsWith("/webapp")) {
    base = `${base}/webapp`;
  }

  return `${base}/equipment/${equipmentId}`;
}

/**
 * Отправляет результаты поиска
 */
export async function sendSearchResults(
  ctx: Context, 
  sessions: SessionStore,
  items: EquipmentSummary[],
  answerGenerator: AnswerGenerator
) {
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!item) continue;
    
    const imageUrl = answerGenerator.getImageUrl(item.id);
    const webAppUrl = getWebAppUrl(item.id);
    
    const keyboard = webAppUrl
      ? Markup.inlineKeyboard([[Markup.button.webApp("📱 Открыть карточку", webAppUrl)]])
      : undefined;
    
    if (imageUrl) {
      try {
        const caption = formatCategoryEquipmentPhotoCaption(item, index);
        const extra: any = keyboard ? { caption, ...keyboard } : { caption };
        const message = await ctx.replyWithPhoto(imageUrl, extra);
        
        if (message?.message_id && ctx.from?.id) {
          const session = await getOrCreateSession(ctx.from.id, sessions);
          if (!session.messageIds) session.messageIds = [];
          session.messageIds.push(message.message_id);
          await sessions.set(session);
        }
      } catch (error: any) {
        const errorMessage = error?.response?.description || error?.message || "";
        if (errorMessage.includes("Too Many Requests") || error?.response?.error_code === 429) {
          const retryAfter = error?.response?.parameters?.retry_after || 10;
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        } else {
          console.warn(`[Telegram] Не удалось отправить изображение для ${item.id}:`, errorMessage);
        }
      }
    } else {
      const text = formatCategoryEquipmentText(item, index);
      try {
        await sendAndTrack(ctx, sessions, text, keyboard);
      } catch (error: any) {
        console.warn(`[Telegram] Не удалось отправить текстовое сообщение для ${item.id}:`, error?.message);
      }
    }
  }
}
