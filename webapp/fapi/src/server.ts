import { createApp } from "./app";
import { config } from "./core/config";

/**
 * Запуск сервера
 */
async function start() {
  try {
    // --- ВСТАВКА: Хак для режима разработки на порту 7507 ---
    // Поскольку мы не хотим трогать app.ts, модифицируем конфиг здесь.
    // Если порт 7507, принудительно ставим 0.0.0.0 и HTTP ссылку для Swagger.
    
    // Проверяем порт из конфига или из env (на случай, если конфиг уже загрузился)
    const isDevPort = config.port === 7507 || process.env.PORT === '7507';

    if (isDevPort) {
      console.log('🔧 Detected DEV port 7507. Applying dev overrides...');
      
      // 1. Слушаем на всех интерфейсах, чтобы сервер был доступен по IP 85.209.90.173
      // (Можно менять напрямую, так как объекты в JS передаются по ссылке)
      (config as any).host = '0.0.0.0'; 
      (config as any).port = 7507;

      // 2. ВАЖНО: Подменяем домен для Swagger.
      // Вместо https://botfix.ru (или что там в проде) ставим http://IP:7507
      // Это уберет ошибку ERR_SSL_PROTOCOL_ERROR
      (config as any).domain = `http://85.209.90.173:7507`;
      
      // 3. Убеждаемся, что env стоит development (для логгера)
      (config as any).env = 'development';
    }
    // --- КОНЕЦ ВСТАВКИ ---

    const app = await createApp();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`🚀 Fastify API server running on http://${config.host}:${config.port}`);
    // Здесь выводим актуальный IP для удобства клика в консоли
    console.log(`📚 Swagger docs available at ${config.domain}/api-docs`);
    
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
}

start();