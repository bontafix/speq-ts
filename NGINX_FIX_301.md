# Исправление ошибки 301 Moved Permanently для webhook

## Проблема
Telegram получает ошибку `301 Moved Permanently` при отправке webhook на `https://botfix.ru/speq-bot/telegram/webhook`

## Причина
1. **Порядок location блоков** - общий `location /speq-bot` перехватывает запрос раньше специфичного
2. **Отсутствие точного совпадения** - нужно использовать `location =` для точного совпадения

## Решение

### 1. Обновите конфигурацию nginx

Добавьте **ПЕРЕД** `location /speq-bot` (важен порядок!):

```nginx
# === SPEQ BOT WEBHOOK (должен быть ПЕРВЫМ) ===
location = /speq-bot/telegram/webhook {
    proxy_pass http://127.0.0.1:7504/telegram/webhook;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;

    proxy_buffering off;
    proxy_request_buffering off;

    proxy_connect_timeout 90s;
    proxy_send_timeout 90s;
    proxy_read_timeout 90s;

    client_max_body_size 10M;
}

# === SPEQ BOT (общий, должен быть ПОСЛЕ специфичного) ===
location /speq-bot {
    proxy_pass http://127.0.0.1:7504/;
    # ... остальные настройки
}
```

### 2. Проверьте конфигурацию

```bash
sudo nginx -t
```

### 3. Перезагрузите nginx

```bash
sudo systemctl reload nginx
```

### 4. Проверьте webhook

```bash
npm run webhook:info
```

Должно показать `pending_update_count: 0` и отсутствие ошибок.

## Важно

- Используйте `location =` для точного совпадения пути
- Специфичные location должны быть **ВЫШЕ** общих
- Полная конфигурация в файле `nginx.speq-full.conf`
