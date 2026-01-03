/**
 * PM2 конфигурация для запуска сервисов проекта speq-ts
 * 
 * Перед запуском необходимо собрать проект:
 *   npm run build
 * 
 * Использование:
 *   pm2 start ecosystem.config.js          - запустить все сервисы
 *   pm2 start ecosystem.config.js --only speq-telegram-bot  - запустить только бота
 *   pm2 start ecosystem.config.js --only speq-http-server   - запустить только HTTP сервер
 *   pm2 stop all                            - остановить все
 *   pm2 restart all                         - перезапустить все
 *   pm2 logs                                - просмотр логов всех сервисов
 *   pm2 logs speq-telegram-bot              - логи только бота
 *   pm2 monit                               - мониторинг в реальном времени
 */
module.exports = {
  apps: [
    {
      name: "speq-telegram-bot",
      script: "dist/telegram/index.js",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/telegram-error.log",
      out_file: "./logs/telegram-out.log",
      log_file: "./logs/telegram-combined.log",
      time: true,
      merge_logs: true,
    },
    {
      name: "speq-http-server",
      script: "dist/http/server.js",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/http-error.log",
      out_file: "./logs/http-out.log",
      log_file: "./logs/http-combined.log",
      time: true,
      merge_logs: true,
    },
  ],
};

