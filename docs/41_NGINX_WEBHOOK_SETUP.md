# Настройка nginx для Telegram бота через webhook

**Дата:** 2025-01-XX  
**Версия:** 1.0

## Обзор

Telegram требует HTTPS для работы webhook. Nginx используется как reverse proxy для проксирования запросов от Telegram к Node.js серверу, который обрабатывает обновления бота.

**Важно:** Эта конфигурация предназначена для добавления в существующую конфигурацию nginx, где уже работают другие боты на разных маршрутах (например, `/bot1`, `/bot2`).

## Требования

- Установленный nginx с существующей конфигурацией для других ботов
- SSL сертификат (рекомендуется Let's Encrypt)
- Домен с настроенным DNS
- Node.js сервер запущен на порту **7504** (установите `HTTP_PORT=7504` в `.env`)

## Шаг 1: Установка SSL сертификата (Let's Encrypt)

```bash
# Установить certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Получить сертификат (nginx должен быть запущен)
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление сертификата
sudo certbot renew --dry-run
```

## Шаг 2: Настройка nginx

### Вариант A: Добавление к существующей конфигурации (рекомендуется)

Если у вас уже есть конфигурация nginx с другими ботами:

1. Откройте существующую конфигурацию nginx:

```bash
sudo nano /etc/nginx/sites-available/your-existing-config
# или
sudo nano /etc/nginx/nginx.conf
```

2. Найдите блок `server` для вашего домена и добавьте location блок для speq-bot:

```nginx
server {
    listen 443 ssl http2;
    server_name domain.com;
    
    # ... существующие location блоки для /bot1, /bot2 и т.д. ...
    
    # Добавьте этот блок для speq-bot
    # ВАЖНО: завершающий слеш в proxy_pass убирает префикс /speq-bot из пути
    # Запрос /speq-bot/telegram/webhook станет /telegram/webhook на бэкенде
    location /speq-bot {
        proxy_pass http://127.0.0.1:7504/;
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
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Опционально: отдельная настройка для webhook endpoint
    # Примечание: этот блок не обязателен, если основной location /speq-bot настроен правильно
    location /speq-bot/telegram/webhook {
        proxy_pass http://127.0.0.1:7504/telegram/webhook;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_buffering off;
        proxy_request_buffering off;
        
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
    }
}
```

3. Или используйте готовый фрагмент конфигурации:

```bash
# Скопируйте содержимое файла nginx.location.speq-bot.conf
# и вставьте в ваш существующий server блок
cat nginx.location.speq-bot.conf
```

4. Проверьте конфигурацию:

```bash
sudo nginx -t
```

5. Перезагрузите nginx:

```bash
sudo systemctl reload nginx
```

### Вариант B: Отдельная конфигурация (если нужна изоляция)

Если вы хотите создать отдельный файл конфигурации:

1. Используйте файл `nginx.conf.example` как основу и измените:
   - Маршрут на `/speq-bot`
   - Порт на `7504`

## Шаг 3: Настройка брандмауэра

```bash
# Разрешить HTTP и HTTPS
sudo ufw allow 'Nginx Full'
# или
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Шаг 3: Настройка порта сервера

Убедитесь, что Node.js сервер запущен на порту 7504. Установите в `.env`:

```bash
HTTP_PORT=7504
```

Или при запуске:

```bash
HTTP_PORT=7504 npm run serve
```

## Шаг 4: Установка webhook

После настройки nginx и получения SSL сертификата установите webhook:

```bash
# Через скрипт (укажите полный путь с маршрутом /speq-bot)
npm run webhook:set https://domain.com/speq-bot/telegram/webhook

# Или через API (на порту 7504)
curl -X POST http://localhost:7504/telegram/webhook/set \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://domain.com/speq-bot/telegram/webhook"}'
```

**Важно:** URL webhook должен быть `https://domain.com/speq-bot/telegram/webhook`, а не просто `/telegram/webhook`.

## Шаг 5: Проверка работы

1. Проверьте статус webhook:

```bash
npm run webhook:info
```

2. Проверьте логи nginx:

```bash
sudo tail -f /var/log/nginx/speq-bot-access.log
sudo tail -f /var/log/nginx/speq-bot-error.log
```

3. Проверьте логи Node.js сервера

4. Отправьте тестовое сообщение боту в Telegram

## Важные настройки

### Размер тела запроса

Telegram может отправлять большие обновления (например, с фотографиями). Убедитесь, что в конфигурации установлено:

```nginx
client_max_body_size 10M;
```

### Таймауты

Обработка запросов может занять время (особенно при использовании LLM). Увеличьте таймауты:

```nginx
proxy_connect_timeout 90s;
proxy_send_timeout 90s;
proxy_read_timeout 90s;
```

### Отключение буферизации

Для быстрого ответа Telegram отключите буферизацию:

```nginx
proxy_buffering off;
proxy_request_buffering off;
```

## Rate Limiting (опционально)

Для защиты от злоупотреблений можно настроить rate limiting:

```nginx
# В http блоке nginx.conf
limit_req_zone $binary_remote_addr zone=telegram_limit:10m rate=10r/s;

# В server блоке
location /telegram/webhook {
    limit_req zone=telegram_limit burst=20 nodelay;
    # ... остальные настройки
}
```

**Внимание:** Telegram может отправлять запросы с разных IP-адресов, поэтому rate limiting по IP может быть неэффективен. Лучше использовать проверку секретного токена (secret_token) в webhook.

## Проверка секретного токена (рекомендуется)

Telegram поддерживает секретный токен для webhook. Добавьте проверку в nginx:

```nginx
location /telegram/webhook {
    # Проверка секретного токена (если используется)
    if ($http_x_telegram_bot_api_secret_token != "your_secret_token") {
        return 403;
    }
    
    # ... остальные настройки proxy
}
```

И установите webhook с секретным токеном:

```bash
# В коде нужно будет добавить поддержку secret_token
# Пока что используйте базовую настройку
```

## Troubleshooting

### Webhook не работает

1. Проверьте, что сервер доступен:
   ```bash
   curl http://localhost:7504/health
   ```

2. Проверьте логи nginx:
   ```bash
   sudo tail -f /var/log/nginx/speq-bot-error.log
   ```

3. Проверьте, что SSL сертификат действителен:
   ```bash
   sudo certbot certificates
   ```

4. Проверьте статус webhook:
   ```bash
   npm run webhook:info
   ```

### Ошибка 502 Bad Gateway

- Убедитесь, что Node.js сервер запущен на порту **7504**
- Проверьте, что порт доступен: `netstat -tlnp | grep 7504` или `ss -tlnp | grep 7504`
- Проверьте логи nginx и Node.js сервера
- Убедитесь, что в конфигурации nginx указан правильный порт (7504)

### Ошибка 504 Gateway Timeout

- Увеличьте таймауты в конфигурации nginx
- Проверьте производительность Node.js сервера
- Проверьте логи на предмет долгих запросов

## Альтернатива: Использование Cloudflare

Если вы используете Cloudflare, можно настроить SSL через Cloudflare и использовать их прокси. В этом случае:

1. Настройте DNS в Cloudflare
2. Включите "Flexible SSL" или "Full SSL" в настройках Cloudflare
3. Используйте Cloudflare для SSL termination
4. Nginx может работать без SSL сертификата (но рекомендуется использовать "Full SSL")

## Пример полной конфигурации для нескольких ботов

Пример структуры server блока с несколькими ботами:

```nginx
server {
    listen 443 ssl http2;
    server_name domain.com;
    
    # SSL настройки
    ssl_certificate /etc/letsencrypt/live/domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/domain.com/privkey.pem;
    
    # Общие настройки
    client_max_body_size 10M;
    
    # Бот 1
    location /bot1 {
        proxy_pass http://127.0.0.1:PORT1;
        # ... настройки proxy ...
    }
    
    # Бот 2
    location /bot2 {
        proxy_pass http://127.0.0.1:PORT2;
        # ... настройки proxy ...
    }
    
    # Speq Bot
    # ВАЖНО: завершающий слеш в proxy_pass убирает префикс /speq-bot из пути
    location /speq-bot {
        proxy_pass http://127.0.0.1:7504/;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_buffering off;
        proxy_request_buffering off;
        
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
    }
}
```

## Дополнительные ресурсы

- [Документация Telegram Bot API - Webhook](https://core.telegram.org/bots/api#setwebhook)
- [Nginx документация](https://nginx.org/en/docs/)
- [Let's Encrypt документация](https://letsencrypt.org/docs/)
