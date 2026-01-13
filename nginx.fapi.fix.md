# Исправление ошибки: connect() failed (111) для Fastify API

## Проблема

Ошибка `connect() failed (111: Unknown error)` означает, что nginx не может подключиться к Fastify серверу. Это происходит потому что:

1. ❌ Fastify сервер не запущен
2. ❌ В `.env` файле не указан `FAPI_PORT=7506`
3. ❌ Fastify слушает на другом порту или хосте

## Решение

### Шаг 1: Добавить настройки в `.env` файл

Откройте файл `.env` в корне проекта и добавьте:

```bash
# Fastify API настройки
FAPI_PORT=7506
FAPI_HOST=127.0.0.1
JWT_SECRET=your_jwt_secret_here

# База данных для Fastify API
FAPI_PGHOST=localhost
FAPI_PGPORT=5432
FAPI_PGUSER=postgres
FAPI_PGPASSWORD=your_password
FAPI_PGDATABASE=equipment_catalog
```

**Важно:**
- `FAPI_HOST=127.0.0.1` - сервер должен слушать только на localhost для безопасности
- `JWT_SECRET` - обязателен, используйте случайную строку (например, `openssl rand -hex 32`)

### Шаг 2: Установить зависимости (если еще не установлены)

```bash
cd webapp/fapi
npm install
```

### Шаг 3: Запустить Fastify сервер

**Вариант A: Режим разработки (с автоперезагрузкой)**
```bash
cd webapp/fapi
npm run dev
```

**Вариант B: Продакшен режим**
```bash
cd webapp/fapi
npm run build
npm start
```

**Вариант C: Через PM2 (рекомендуется для продакшена)**
```bash
# Добавьте в ecosystem.config.js или создайте отдельный конфиг
pm2 start webapp/fapi/dist/server.js --name speq-fapi
```

### Шаг 4: Проверить, что сервер запущен

```bash
# Проверка health endpoint
curl http://127.0.0.1:7506/health

# Должен вернуть JSON с статусом
```

### Шаг 5: Проверить nginx конфигурацию

Убедитесь, что в nginx конфиге указан правильный порт:

```nginx
proxy_pass http://127.0.0.1:7506;  # Должен совпадать с FAPI_PORT
```

### Шаг 6: Перезагрузить nginx

```bash
sudo nginx -t  # Проверка конфигурации
sudo systemctl reload nginx  # Перезагрузка
```

## Альтернатива: Использовать порт по умолчанию (3002)

Если не хотите менять порт, можно обновить nginx конфиг:

1. В `.env` не указывайте `FAPI_PORT` (будет использован 3002 по умолчанию)
2. В nginx конфиге измените порт:

```nginx
proxy_pass http://127.0.0.1:3002;  # Вместо 7506
```

И обновите все location блоки в `nginx.location.fapi.corrected.conf`.

## Проверка работы

После запуска сервера:

```bash
# Health check
curl https://botfix.ru/speq-bot/fapi/health

# Swagger документация
curl https://botfix.ru/speq-bot/fapi/api-docs

# API endpoint (требует авторизацию)
curl -H "Authorization: Bearer TOKEN" https://botfix.ru/speq-bot/fapi/users
```

## Автозапуск при перезагрузке сервера

Если используете PM2:

```bash
pm2 save  # Сохранить текущие процессы
pm2 startup  # Настроить автозапуск при загрузке системы
```

Или создайте systemd service:

```ini
# /etc/systemd/system/speq-fapi.service
[Unit]
Description=Speq Fastify API
After=network.target

[Service]
Type=simple
User=boris
WorkingDirectory=/home/boris/dev/speq-ts/webapp/fapi
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl enable speq-fapi
sudo systemctl start speq-fapi
```
