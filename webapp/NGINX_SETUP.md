# Настройка nginx для веб-приложения

## Добавление в существующую конфигурацию

Если у вас уже есть nginx с ботами на `/bot1`, `/bot2` и т.д., добавьте эти блоки в ваш `server` блок:

```nginx
# Добавьте в существующий server блок для domain.com

# API сервер веб-приложения
location /webapp/api {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
}

# Frontend веб-приложения (dev режим)
location /webapp {
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

Или скопируйте содержимое файла `nginx.location.webapp.conf`.

## Настройка портов

Убедитесь, что порты соответствуют настройкам:

- API сервер: порт `3001` (можно изменить через `WEBAPP_API_PORT` в `.env`)
- Frontend dev сервер: порт `5173` (настраивается в `vite.config.ts`)

## Проверка

```bash
# Проверьте конфигурацию nginx
sudo nginx -t

# Перезагрузите nginx
sudo systemctl reload nginx
```

## Продакшен

Для продакшена:

1. Соберите frontend:
   ```bash
   cd webapp/frontend
   npm run build
   ```

2. Обновите конфигурацию nginx:
   - Закомментируйте блок `location /webapp` с `proxy_pass`
   - Раскомментируйте альтернативный блок с `alias` и `try_files`
   - Укажите правильный путь к `dist` папке

3. Перезагрузите nginx:
   ```bash
   sudo systemctl reload nginx
   ```

## Доступ

После настройки веб-приложение будет доступно по адресу:
- Frontend: `https://domain.com/webapp/equipment/{id}`
- API: `https://domain.com/webapp/api/equipment/{id}`
- Swagger: `https://domain.com/webapp/api/api-docs` (только если API запущен)
