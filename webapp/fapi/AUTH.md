# Авторизация и управление пользователями

## Настройка

1. Установите переменные окружения:
```bash
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d  # опционально, по умолчанию 7d
```

2. Установите зависимости:
```bash
npm install
```

## Использование

### Регистрация пользователя
```bash
POST /auth/register
{
  "username": "user1",
  "email": "user1@example.com",
  "password": "password123",
  "name": "User Name"  # опционально
}
```

### Авторизация
```bash
POST /auth/login
{
  "username": "user1",  # или email
  "password": "password123"
}
```

Ответ содержит JWT токен:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "user1",
      "email": "user1@example.com",
      "name": "User Name",
      "roles": []
    }
  }
}
```

### Использование токена

Добавьте заголовок в запросы:
```
Authorization: Bearer <token>
```

### Получить текущего пользователя
```bash
GET /auth/me
Authorization: Bearer <token>
```

## Защита эндпоинтов

### Требовать авторизацию
```typescript
import { authenticate } from "../../core/decorators/auth.decorator";

fastify.get("/protected", {
  preHandler: [authenticate],
  // ...
});
```

### Требовать конкретную роль
```typescript
import { requireRole } from "../../core/decorators/auth.decorator";

fastify.get("/admin-only", {
  preHandler: [requireRole("admin")],
  // ...
});
```

### Требовать одну из ролей
```typescript
import { requireAnyRole } from "../../core/decorators/auth.decorator";

fastify.get("/moderator-or-admin", {
  preHandler: [requireAnyRole(["moderator", "admin"])],
  // ...
});
```

## Управление пользователями (требует роль admin)

Все эндпоинты `/users/*` требуют роль `admin`.

### Получить всех пользователей
```bash
GET /users
Authorization: Bearer <admin-token>
```

### Получить пользователя по ID
```bash
GET /users/:id
Authorization: Bearer <admin-token>
```

### Создать пользователя
```bash
POST /users
Authorization: Bearer <admin-token>
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User",
  "status": true,
  "limit_document": 100,
  "limit_size_pdf": 50
}
```

### Обновить пользователя
```bash
PUT /users/:id
Authorization: Bearer <admin-token>
{
  "name": "Updated Name",
  "status": false
}
```

### Удалить пользователя
```bash
DELETE /users/:id
Authorization: Bearer <admin-token>
```

### Назначить роль пользователю
```bash
POST /users/:id/roles
Authorization: Bearer <admin-token>
{
  "roleId": 1
}
```

### Удалить роль у пользователя
```bash
DELETE /users/:id/roles/:roleId
Authorization: Bearer <admin-token>
```

## Структура ролей

Роли хранятся в таблице `roles`:
- `id` - идентификатор роли
- `name` - имя роли (используется для проверки)
- `title` - отображаемое название
- `status` - активна ли роль

Связь пользователей и ролей в таблице `user_roles`.
