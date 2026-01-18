# 42 — Графическая схема проекта (Mermaid)

Ниже — **единая “схема проекта”** в нескольких разрезах: контейнеры/сервисы и основные потоки данных.

## 1) Контейнерная схема (что есть в системе)

```mermaid
flowchart LR
  %% --- External actors ---
  U[Пользователь] --> TG[Telegram]
  U --> B[Браузер]

  %% --- Edge / proxy ---
  N[Nginx (reverse proxy)] --> HTTP[HTTP API\n`src/http/server.ts`\nпорт: HTTP_PORT (def 3000)]
  N --> FE[Webapp Frontend (Vue/Vite)\n`webapp/frontend`\nbase: /speq-bot/webapp/]
  N --> WAPI[Webapp API (Fastify)\n`webapp/fapi`\nSwagger: /api-docs]
  N --> EAPI[Webapp API (Express, legacy)\n`webapp/api`]

  %% --- Telegram bot runtime ---
  TG -->|polling или webhook| BOT[Telegram Bot\n`src/telegram/index.ts`]
  BOT -->|формирует запрос| LLM[LLM Provider(s)\nGroq/OpenAI/Ollama]
  BOT --> SEARCH[Поиск/Каталог\nCatalogService + SearchEngine]
  BOT -->|кнопка WebApp| FE

  %% --- Core data layer ---
  SEARCH --> REPO[EquipmentRepository]
  REPO --> DB[(PostgreSQL + pgvector)]

  %% --- Webapp data access ---
  WAPI --> DB
  EAPI --> DB

  %% --- Offline worker ---
  WORKER[Embeddings Worker\n`src/worker/embed-equipment.ts`] -->|читает/пишет| DB
  WORKER -->|embeddings()| LLM
```

## 2) Поток “поиск в Telegram” (основной сценарий)

```mermaid
sequenceDiagram
  autonumber
  participant U as Пользователь
  participant TG as Telegram
  participant BOT as Telegram Bot (Telegraf)
  participant IQB as InteractiveQueryBuilder
  participant LLM as LLM Provider (chat)
  participant CS as CatalogService/SearchEngine
  participant DB as PostgreSQL

  U->>TG: Сообщение "что ищу"
  TG->>BOT: update (polling/webhook)
  BOT->>IQB: next(text, history)
  IQB->>LLM: уточнение/структурирование запроса
  alt LLM просит уточнить
    LLM-->>IQB: action=ask(question)
    IQB-->>BOT: ask
    BOT-->>TG: "❓ вопрос"
    TG-->>U: вопрос
  else LLM сформировал итоговый запрос
    LLM-->>IQB: action=final(query)
    IQB-->>BOT: final(query)
    BOT->>CS: searchEquipment(query)
    CS->>DB: SQL + pgvector (через repository)
    DB-->>CS: results
    CS-->>BOT: items + total
    BOT-->>TG: результаты (текст/фото) + кнопка WebApp (если задан WEBAPP_BASE_URL)
    TG-->>U: карточки/сообщения
  end
```

## 3) Поток “открыть карточку из WebApp”

```mermaid
sequenceDiagram
  autonumber
  participant U as Пользователь
  participant FE as Vue Webapp (/speq-bot/webapp/)
  participant N as Nginx
  participant API as Webapp API (Fastify или Express)
  participant DB as PostgreSQL

  U->>FE: Открывает /equipment/:id
  FE->>N: GET /speq-bot/webapp/api/... (fetch)
  N->>API: proxy_pass + rewrite (префикс /webapp/api)
  API->>DB: SELECT equipment + параметры
  DB-->>API: данные
  API-->>FE: JSON карточки
  FE-->>U: рендер карточки оборудования
```

