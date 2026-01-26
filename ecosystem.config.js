/**
 * PM2 конфигурация для запуска приложения
 * 
 * Production: только API (бот работает через webhook) - запускается из dist/
 * Staging: только API (бот работает через webhook) - запускается из dist/
 * Development: API + бот (polling режим) - запускается через ts-node
 * 
 * Использование:
 * - npm run build && npm run pm2:prod - сборка и запуск production
 * - npm run build && npm run pm2:staging - сборка и запуск staging
 * - npm run pm2:dev - запуск development (ts-node)
 * - npm run pm2:stop - остановка всех процессов
 * - npm run pm2:logs - просмотр логов
 * 
 * ВАЖНО: Для production и staging необходимо сначала выполнить npm run build
 */

const path = require('path');

module.exports = {
  apps: [
    // ============================================
    // PRODUCTION
    // ============================================
    {
      name: 'speq-api-prod',
      script: 'dist/api/server.js',
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
      // .env.production загружается автоматически через src/config/env-loader.ts
      // ВАЖНО: Перед запуском выполните npm run build
      error_file: './logs/pm2/api-prod-error.log',
      out_file: './logs/pm2/api-prod-out.log',
      log_file: './logs/pm2/api-prod-combined.log',
      time: true,
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git', 'dist', 'src'],
    },

    // ============================================
    // STAGING
    // ============================================
    {
      name: 'speq-api-staging',
      script: 'dist/api/server.js',
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'node',
      env: {
        NODE_ENV: 'staging',
      },
      // .env.staging или .env.production загружается автоматически через src/config/env-loader.ts
      // ВАЖНО: Перед запуском выполните npm run build
      error_file: './logs/pm2/api-staging-error.log',
      out_file: './logs/pm2/api-staging-out.log',
      log_file: './logs/pm2/api-staging-combined.log',
      time: true,
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git', 'dist', 'src'],
    },

    // ============================================
    // DEVELOPMENT
    // ============================================
    {
      name: 'speq-api-dev',
      script: 'ts-node',
      args: 'src/api/server.ts',
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
      },
      // .env.development загружается автоматически через src/config/env-loader.ts
      error_file: './logs/pm2/api-dev-error.log',
      out_file: './logs/pm2/api-dev-out.log',
      log_file: './logs/pm2/api-dev-combined.log',
      time: true,
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      watch: false, // Для автоперезагрузки используйте nodemon (npm run api:dev)
      ignore_watch: ['node_modules', 'logs', '.git', 'dist'],
    },

    {
      name: 'speq-bot-dev',
      script: 'ts-node',
      args: 'src/telegram/index.ts',
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        TELEGRAM_BOT_MODE: 'polling', // В dev режиме используем polling
      },
      // .env.development загружается автоматически через src/config/env-loader.ts
      error_file: './logs/pm2/bot-dev-error.log',
      out_file: './logs/pm2/bot-dev-out.log',
      log_file: './logs/pm2/bot-dev-combined.log',
      time: true,
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      watch: false, // Для автоперезагрузки используйте nodemon (npm run bot:dev)
      ignore_watch: ['node_modules', 'logs', '.git', 'dist'],
    },
  ],
};
