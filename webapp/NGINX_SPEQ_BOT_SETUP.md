# Настройка nginx для веб-приложения (путь /speq-bot/webapp)

## Конфигурация для пути /speq-bot/webapp/api

Используйте файл `nginx.location.webapp.speq-bot.conf` или добавьте в ваш `server` блок:

```nginx
# Location для Swagger документации (ВАЖНО: должен быть ПЕРЕД общим location)
location ~ ^/speq-bot/webapp/api/api-docs(/.*)?$ {
    rewrite ^/speq-bot/webapp/api/api-docs(.*)$ /api-docs$1 break;
    proxy_pass http://127.0.0.1:7505;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Location для API веб-приложения
location /speq-bot/webapp/api {
    rewrite ^/speq-bot/webapp/api(.*)$ /api$1 break;
    proxy_pass http://127.0.0.1:7505;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Location для Frontend веб-приложения
location /speq-bot/webapp {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
}
```

## Настройка портов

Убедитесь, что порты соответствуют настройкам:

- API сервер: порт `7505` (можно изменить через `WEBAPP_API_PORT` в `.env`)
- Frontend dev сервер: порт `5173` (настраивается в `vite.config.ts`)

## Доступные URL

После настройки приложение будет доступно по адресам:

- **API Equipment**: `https://domain.com/speq-bot/webapp/api/equipment/{id}`
- **Swagger документация**: `https://domain.com/speq-bot/webapp/api/api-docs`
- **Health check**: `https://domain.com/speq-bot/webapp/api/health` (но после rewrite станет `/api/health`, нужно добавить endpoint)
- **Frontend**: `https://domain.com/speq-bot/webapp/equipment/{id}`

## Важные замечания

1. **Порядок location блоков важен**: location для `/api-docs` должен быть ПЕРЕД общим location `/api`, так как nginx выбирает наиболее специфичное совпадение.

2. **Rewrite правила**:
   - `/speq-bot/webapp/api/equipment/123` → `/api/equipment/123`
   - `/speq-bot/webapp/api/api-docs` → `/api-docs`
   - `/speq-bot/webapp/api/health` → `/api/health` (но сервер слушает на `/health`, нужно исправить)

3. **Health check**: Текущий rewrite для `/health` неправильный. Нужно либо:
   - Добавить отдельный location для `/speq-bot/webapp/api/health` → `/health`
   - Или изменить endpoint в API на `/api/health`

## Проверка

```bash
# Проверьте конфигурацию nginx
sudo nginx -t

# Перезагрузите nginx
sudo systemctl reload nginx
```
