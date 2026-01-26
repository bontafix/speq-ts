# Архитектура бота и API

## Обзор

Проект состоит из двух основных компонентов:
1. **Telegram бот** (`src/telegram/index.ts`) - обрабатывает сообщения пользователей
2. **Fastify API сервер** (`src/api/server.ts`) - REST API для фронтенда и управления

## Режимы работы

### Development (разработка)

#### Загрузка конфигурации
- Используется файл `.env.development`
- Загрузка через `src/config/env-loader.ts`:
  - Ищет файлы в порядке: `.env.development.local` → `.env.development` → `.env.local` → `.env`
  - Загружает первый найденный файл

#### Запуск бота в dev режиме

**Команда:** `npm run bot:dev`

**Что происходит:**
1. Nodemon следит за изменениями в `src/**/*.ts`
2. Запускается `ts-node src/telegram/index.ts`
3. Загружается `.env.development`
4. Инициализируется `AppContainer` (LLM, каталог, поиск)
5. Создается экземпляр Telegraf бота
6. **Режим: POLLING** (бот сам опрашивает Telegram API)
   - `TELEGRAM_BOT_MODE=polling` (из `.env.development`)
   - Бот запускается через `bot.launch()` в функции `main()`
   - Обрабатывает обновления через long polling

**Особенности dev режима:**
- Автоперезапуск при изменении файлов (nodemon)
- Прямое подключение к Telegram API (polling)
- Логирование в консоль
- Порт API: `7507` (из `FAPI_PORT`)
- CORS разрешен для `localhost:*`

#### Запуск API в dev режиме

**Команда:** `npm run api:dev`

**Что происходит:**
1. Nodemon следит за изменениями в `src/api/**/*.ts` и `src/**/*.ts`
2. Запускается `ts-node src/api/server.ts`
3. Загружается `.env.development`
4. Создается Fastify приложение через `createApp()`
5. Регистрируются плагины:
   - Database (PostgreSQL)
   - JWT авторизация
   - CORS
   - Swagger UI (`/api-docs`)
   - Модули: auth, users, equipment, categories, telegram, search, llm
6. Сервер слушает на `0.0.0.0:7507` (из `FAPI_HOST` и `FAPI_PORT`)

**Особенности dev режима:**
- Pretty логирование (pino-pretty)
- Swagger UI доступен на `http://localhost:7507/api-docs`
- CORS для локальных origins
- Автоперезапуск при изменениях

#### Запуск всего вместе

**Команда:** `npm run dev` или `npm run dev:all`

- `dev`: запускает API + бот
- `dev:all`: запускает API + бот + webapp frontend

Используется `concurrently` для параллельного запуска процессов.

---

### Production (продакшн)

#### Загрузка конфигурации
- Используется файл `.env.production`
- Загрузка через `src/config/env-loader.ts` (аналогично dev)

#### Запуск бота в prod режиме

**Важно:** В продакшн бот НЕ запускается напрямую через `bot.launch()`!

**Режим: WEBHOOK** (Telegram отправляет обновления на сервер)
- `TELEGRAM_BOT_MODE=webhook` (из `.env.production`)
- Webhook URL: `https://botfix.ru/speq-bot/telegram/webhook` (из `TELEGRAM_WEBHOOK_URL`)

**Как это работает:**
1. API сервер запускается и регистрирует endpoint `/telegram/webhook`
2. При запуске API вызывается `setupBot()`, который создает экземпляр бота
3. Бот сохраняется в `botInstance` (singleton)
4. Telegram отправляет обновления на webhook URL
5. Nginx проксирует запросы на API сервер (127.0.0.1:7506)
6. API вызывает `handleUpdate()` из `src/telegram/index.ts`
7. Бот обрабатывает обновление через `bot.handleUpdate(update)`

**Установка webhook:**
```bash
npm run webhook:set
# Или через API: POST /telegram/webhook/set
```

**Проверка webhook:**
```bash
npm run webhook:info
# Или через API: GET /telegram/webhook/info
```

#### Запуск API в prod режиме

**Команда:** `npm run api` (или через PM2)

**Что происходит:**
1. Загружается `.env.production`
2. Создается Fastify приложение
3. Сервер слушает на `127.0.0.1:7506` (только localhost, nginx проксирует)
4. Регистрируется endpoint `/telegram/webhook` для бота
5. Swagger доступен на `https://botfix.ru/speq-bot/webapp/api/api-docs`

**Особенности prod режима:**
- Логирование без pretty (обычный JSON)
- CORS только для `https://botfix.ru`
- Swagger с CSP заголовками
- Домен: `https://botfix.ru/speq-bot/webapp/api` (из `FAPI_DOMAIN`)

#### PM2 для продакшн

**Команды:**
- `npm run pm2:dev` - запуск dev окружения через PM2
- `npm run pm2:staging` - запуск staging
- `npm run pm2:prod` - запуск production
- `npm run pm2:stop` - остановка всех процессов
- `npm run pm2:logs` - просмотр логов

**Примечание:** Файл `bot.config.js` должен быть создан для PM2 (сейчас отсутствует в репозитории).

---

## Архитектура взаимодействия

### Development режим

```
┌─────────────┐
│   User      │
│  (Telegram) │
└──────┬──────┘
       │
       │ Long Polling
       │ (бот опрашивает API)
       ▼
┌─────────────────────┐
│  Telegram Bot       │
│  (polling mode)      │
│  src/telegram/index  │
└──────┬──────────────┘
       │
       │ Использует AppContainer
       ▼
┌─────────────────────┐
│  AppContainer       │
│  - LLM              │
│  - CatalogService   │
│  - SearchEngine     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  PostgreSQL         │
└─────────────────────┘

┌─────────────┐
│   Frontend  │
│  (Vite)     │
└──────┬──────┘
       │
       │ HTTP REST
       ▼
┌─────────────────────┐
│  Fastify API        │
│  (port 7507)        │
│  src/api/server.ts  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  PostgreSQL         │
└─────────────────────┘
```

### Production режим

```
┌─────────────┐
│   User      │
│  (Telegram) │
└──────┬──────┘
       │
       │ Webhook POST
       │ https://botfix.ru/speq-bot/telegram/webhook
       ▼
┌─────────────────────┐
│      Nginx          │
│  (reverse proxy)    │
└──────┬──────────────┘
       │
       │ Proxy to localhost:7506
       ▼
┌─────────────────────┐
│  Fastify API        │
│  (port 7506)        │
│  POST /telegram/webhook │
└──────┬──────────────┘
       │
       │ handleUpdate()
       ▼
┌─────────────────────┐
│  Telegram Bot       │
│  (webhook mode)     │
│  botInstance        │
└──────┬──────────────┘
       │
       │ Использует AppContainer
       ▼
┌─────────────────────┐
│  AppContainer       │
│  - LLM              │
│  - CatalogService   │
│  - SearchEngine     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  PostgreSQL         │
└─────────────────────┘

┌─────────────┐
│   Frontend  │
│  (built)    │
└──────┬──────┘
       │
       │ HTTPS
       │ https://botfix.ru/speq-bot/webapp
       ▼
┌─────────────────────┐
│      Nginx          │
│  (serves static)     │
└──────┬──────────────┘
       │
       │ API calls
       │ /speq-bot/webapp/api/*
       ▼
┌─────────────────────┐
│  Fastify API        │
│  (port 7506)        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  PostgreSQL         │
└─────────────────────┘
```

---

## Ключевые файлы

### Бот
- `src/telegram/index.ts` - главный файл бота
  - `setupBot()` - инициализация бота
  - `main()` - запуск в polling режиме (только если запущен напрямую)
  - `handleUpdate()` - обработка webhook обновлений
  - `getBotInstance()` - singleton для webhook режима

### API
- `src/api/server.ts` - точка входа API сервера
- `src/api/app.ts` - создание Fastify приложения
- `src/api/modules/telegram/index.ts` - webhook endpoint для бота

### Конфигурация
- `src/config/env-loader.ts` - загрузка .env файлов
- `src/api/core/config/index.ts` - конфигурация API
- `.env.development` - настройки для разработки
- `.env.production` - настройки для продакшн

---

## Переменные окружения

### Общие для бота и API
- `NODE_ENV` - окружение (development/production)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - PostgreSQL
- `TELEGRAM_BOT_TOKEN` - токен бота

### Только для бота
- `TELEGRAM_BOT_MODE` - режим работы (polling/webhook)
- `TELEGRAM_WEBHOOK_URL` - URL для webhook (только для prod)
- `TELEGRAM_API_ROOT` - кастомный Telegram API (опционально)

### Только для API
- `FAPI_PORT` - порт API сервера
- `FAPI_HOST` - хост (0.0.0.0 для dev, 127.0.0.1 для prod)
- `FAPI_DOMAIN` - публичный домен для Swagger
- `JWT_SECRET` - секрет для JWT токенов
- `CORS_ORIGINS` - разрешенные origins через запятую

---

## Различия dev vs prod

| Параметр | Development | Production |
|----------|-------------|------------|
| **Бот режим** | Polling | Webhook |
| **API порт** | 7507 | 7506 |
| **API хост** | 0.0.0.0 | 127.0.0.1 |
| **CORS** | localhost:* | https://botfix.ru |
| **Логирование** | Pretty (pino-pretty) | JSON |
| **Swagger CSP** | Отключен | Включен |
| **Домен** | http://localhost:7507 | https://botfix.ru/speq-bot/fapi |
| **Webhook** | Не используется | https://botfix.ru/speq-bot/telegram/webhook |

---

## Запуск и отладка

### Локальная разработка
```bash
# Только бот
npm run bot:dev

# Только API
npm run api:dev

# Вместе
npm run dev

# Все (API + бот + frontend)
npm run dev:all
```

### Проверка webhook (prod)
```bash
# Установить webhook
npm run webhook:set

# Проверить статус
npm run webhook:info

# Удалить webhook (вернуться к polling)
npm run webhook:delete
```

### Продакшн
```bash
# Через PM2 (если настроен)
npm run pm2:prod

# Или напрямую
NODE_ENV=production npm run api
```

---

## Важные замечания

1. **В продакшн бот НЕ запускается отдельно** - он работает через webhook в API сервере
2. **Webhook должен быть установлен** перед запуском в prod режиме
3. **Nginx проксирует** запросы на API сервер в prod
4. **AppContainer** используется и ботом, и API для доступа к каталогу и LLM
5. **База данных** общая для бота и API
