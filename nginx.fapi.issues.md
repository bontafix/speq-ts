# Анализ конфигурации nginx для Fastify API

## Критические проблемы (исправлены)

### 1. ❌ **ОСНОВНАЯ ПРОБЛЕМА: Отсутствие rewrite в основном location блоке**

**Проблема:**
```nginx
location /speq-bot/fapi {
    proxy_pass http://127.0.0.1:7506;  # БЕЗ rewrite!
}
```

**Что происходит:**
- Nginx передает полный URI `/speq-bot/fapi/users` на Fastify
- Fastify получает `/speq-bot/fapi/users` вместо `/users`
- Роуты не работают, так как Fastify ожидает `/users`

**Исправление:**
```nginx
location /speq-bot/fapi {
    rewrite ^/speq-bot/fapi(.*)$ $1 break;  # ✅ Убираем префикс
    proxy_pass http://127.0.0.1:7506;
}
```

### 2. ❌ **Неправильный путь для Swagger**

**Проблема:**
- В конфиге указан `/documentation`
- В коде используется `/api-docs` (из `swagger.ts`)

**Исправление:**
```nginx
location ~ ^/speq-bot/fapi/api-docs(/.*)?$ {  # ✅ Правильный путь
    rewrite ^/speq-bot/fapi/api-docs(.*)$ /api-docs$1 break;
    proxy_pass http://127.0.0.1:7506;
}
```

### 3. ❌ **Отсутствие trustProxy в Fastify**

**Проблема:**
- Fastify не доверяет заголовкам `X-Forwarded-*` от nginx
- Неправильные IP адреса в логах
- Проблемы с определением протокола (http/https)

**Исправление:**
```typescript
// src/app.ts
const app = Fastify({
    logger: loggerConfig,
    trustProxy: true,  // ✅ Добавлено
});
```

## Предупреждения

### 4. ⚠️ **Порт не соответствует коду**

- В конфиге указан порт `7506`
- В коде по умолчанию используется `3002` (или `FAPI_PORT` из .env)
- **Решение:** Убедитесь что `FAPI_PORT=7506` в `.env` или измените порт в конфиге

### 5. ⚠️ **Дублирование proxy_read_timeout**

В WebSocket location был указан `proxy_read_timeout` дважды:
```nginx
proxy_read_timeout 3600s;
proxy_read_timeout 86400s;  # Дубликат
```

### 6. ⚠️ **Нестандартный заголовок**

```nginx
proxy_set_header X-Forwarded-Path /speq-bot/fapi;  # Нестандартный
```
Удален, так как не используется Fastify.

## Улучшения

### 7. ✅ **Упрощена конфигурация**

Удалены неиспользуемые location блоки:
- `/status` (нет в коде)
- `/metrics` (нет в коде)
- `/static` (нет в коде)
- `/sse` (нет в коде)

Оставлены только реально используемые:
- `/health` ✅
- `/api-docs` ✅
- `/ws` (если используется) ✅
- Основной API ✅

### 8. ✅ **Улучшена обработка Swagger**

Добавлены `sub_filter` для исправления относительных путей в Swagger UI:
```nginx
sub_filter 'href="/' 'href="/speq-bot/fapi/';
sub_filter 'src="/' 'src="/speq-bot/fapi/';
sub_filter 'url: "/' 'url: "/speq-bot/fapi/';
```

## Итоговые рекомендации

1. ✅ Используйте исправленную конфигурацию из `nginx.location.fapi.corrected.conf`
2. ✅ Обновите `src/app.ts` с `trustProxy: true`
3. ✅ Проверьте порт в `.env` (`FAPI_PORT=7506`)
4. ✅ Убедитесь что Fastify слушает на `127.0.0.1:7506` (не `0.0.0.0`)

## Проверка работы

После применения исправлений:

```bash
# Проверка health
curl https://botfix.ru/speq-bot/fapi/health

# Проверка Swagger
curl https://botfix.ru/speq-bot/fapi/api-docs

# Проверка API
curl -H "Authorization: Bearer TOKEN" https://botfix.ru/speq-bot/fapi/users
```
