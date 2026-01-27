import { Telegraf } from 'telegraf';
import { SessionService } from '../services/session.service';
import { buildMainMenuKeyboard } from '../keyboards';
import { deletePreviousMessages, sendAndTrack } from '../utils/message.utils';
import { refreshParamsConfig } from '../view.format';

export function setupCommandHandlers(
  bot: Telegraf,
  sessionService: SessionService
) {
  // /start
  bot.start(async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Перечитываем конфигурацию параметров при перезапуске бота
    refreshParamsConfig();

    // Удаляем все предыдущие сообщения перед показом главного меню
    await deletePreviousMessages(ctx, sessionService['sessions']);

    // Создаем новую сессию
    await sessionService.reset(telegramId);

    await sendAndTrack(
      ctx, 
      sessionService['sessions'],
      "👋 Привет! Я умный ассистент по подбору оборудования (Speq v2.0).\n\n" +
      "🔍 **Напишите, что ищете**, например:\n" +
      "• «Мне нужен кран грузоподъемностью 50 тонн»\n" +
      "• «Экскаватор Caterpillar»\n\n" +
      "Или нажмите кнопку ниже, чтобы посмотреть категории.",
      { parse_mode: "Markdown", ...buildMainMenuKeyboard() }
    );
  });

  // /reset
  bot.command("reset", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    // Перечитываем конфигурацию параметров при сбросе
    refreshParamsConfig();
    
    await deletePreviousMessages(ctx, sessionService['sessions']);
    await sessionService.reset(telegramId);
    
    await sendAndTrack(
      ctx,
      sessionService['sessions'],
      "🔄 Контекст сброшен. Что ищем?", 
      buildMainMenuKeyboard()
    );
  });

  // /search
  bot.command("search", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    // Перечитываем конфигурацию параметров при сбросе
    refreshParamsConfig();
    
    await deletePreviousMessages(ctx, sessionService['sessions']);
    await sessionService.reset(telegramId);
    
    await sendAndTrack(
      ctx,
      sessionService['sessions'],
      "🔄 Новый поиск. Что ищем?", 
      buildMainMenuKeyboard()
    );
  });

  // /help
  bot.command("help", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    
    await sendAndTrack(
      ctx,
      sessionService['sessions'],
      "Команды:\n/start — Начать заново\n/reset — Сброс контекста\n/search — Новый поиск"
    );
  });
}
