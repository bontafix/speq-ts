# Веб-приложение для каталога оборудования

Мини веб-приложение для отображения карточек оборудования.

## Структура

- `api/` - Express REST API с Swagger документацией
- `frontend/` - Vue3 приложение

## Установка

### 1. Установить зависимости для API (из корня проекта)

```bash
npm install
```

Это установит все зависимости, включая:
- `cors` - для CORS
- `swagger-jsdoc` и `swagger-ui-express` - для Swagger документации

### 2. Установить зависимости для Frontend

```bash
cd webapp/frontend
npm install
```

## Запуск

### API сервер

```bash
# Разработка (с автоперезагрузкой)
npm run webapp:api:dev

# Продакшн
npm run webapp:api
```

API доступен на `http://localhost:3001`
Swagger документация: `http://localhost:3001/api-docs`

### Frontend

```bash
# Запустить dev сервер (из корня проекта)
npm run webapp:dev

# Или из папки frontend
cd webapp/frontend
npm run dev

# Сборка для продакшна
cd webapp/frontend
npm run build
```

Frontend доступен на `http://localhost:5173`

## Использование

Откройте в браузере: `http://localhost:5173/equipment/{id}`

Например: `http://localhost:5173/equipment/123`

## API Endpoints

- `GET /api/equipment/:id` - Получить карточку оборудования по ID
- `GET /health` - Проверка здоровья сервера и БД
- `GET /api-docs` - Swagger документация

## Настройка nginx

Для работы через nginx (например, на продакшене) используйте конфигурацию из файла `nginx.location.webapp.conf`.

Подробная инструкция: [NGINX_SETUP.md](./NGINX_SETUP.md)

### Быстрая настройка

Добавьте в ваш `server` блок nginx:

```nginx
# API сервер
location /webapp/api {
    rewrite ^/webapp/api(.*)$ /api$1 break;
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Frontend (dev режим)
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

После настройки приложение будет доступно по адресу:
- Frontend: `https://domain.com/webapp/equipment/{id}`
- API: `https://domain.com/webapp/api/equipment/{id}`
