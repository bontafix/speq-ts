/**
 * PM2 конфигурация для запуска Fastify API в продакшен режиме
 * 
 * Порт: 7506 (продакшен)
 * Dev режим: npm run dev (порт 7507)
 * 
 * Перед запуском необходимо собрать проект:
 *   npm run build
 * 
 * Использование:
 *   pm2 start ecosystem.config.js                    - запустить сервис на порту 7506
 *   pm2 stop speq-fapi                                - остановить сервис
 *   pm2 restart speq-fapi                            - перезапустить сервис
 *   pm2 logs speq-fapi                                - просмотр логов
 *   pm2 monit                                         - мониторинг в реальном времени
 *   pm2 delete speq-fapi                              - удалить из PM2
 * 
 * Переменные окружения загружаются из .env файла в корне проекта
 */
module.exports = {
  apps: [
    {
      name: "speq-fapi",
      script: "dist/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        FAPI_PORT: "7507",
      },
      error_file: "./logs/fapi-error.log",
      out_file: "./logs/fapi-out.log",
      log_file: "./logs/fapi-combined.log",
      time: true,
      merge_logs: true,
      // Автоматически перезапускать при сбоях
      min_uptime: "10s",
      max_restarts: 10,
      // Задержка перед перезапуском
      restart_delay: 4000,
    },
  ],
};
