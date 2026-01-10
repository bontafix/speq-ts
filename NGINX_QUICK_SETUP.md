# Быстрая настройка nginx для speq-bot

## Добавление в существующую конфигурацию

Если у вас уже есть nginx с ботами на `/bot1`, `/bot2` и т.д., добавьте этот блок в ваш `server` блок:

```nginx
# Добавьте в существующий server блок для domain.com
location /speq-bot {
    proxy_pass http://127.0.0.1:7504;
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
```

Или скопируйте содержимое файла `nginx.location.speq-bot.conf`.

## Настройка порта

Установите в `.env`:

```bash
HTTP_PORT=7504
```

## Установка webhook

```bash
npm run webhook:set https://domain.com/speq-bot/telegram/webhook
```

## Проверка

```bash
# Проверьте конфигурацию nginx
sudo nginx -t

# Перезагрузите nginx
sudo systemctl reload nginx

# Проверьте статус webhook
npm run webhook:info
```

Подробная документация: [docs/41_NGINX_WEBHOOK_SETUP.md](docs/41_NGINX_WEBHOOK_SETUP.md)
