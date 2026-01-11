import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import path from "path";
import { equipmentRouter } from "./routes/equipment.routes";
// Используем абсолютный путь от корня проекта
import { checkDatabaseHealth } from "../../../src/db/pg";

const app = express();
const PORT = process.env.WEBAPP_API_PORT ? parseInt(process.env.WEBAPP_API_PORT, 10) : 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Логирование всех запросов и ответов
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const query = Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '';
  const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  
  // Логируем входящий запрос
  console.log(`[${timestamp}] → ${method} ${url}${query ? ' ?' + query : ''} | IP: ${ip}`);
  // Дополнительное логирование для отладки путей
  if (url.includes('/api/')) {
    console.log(`[${timestamp}]   Path details: originalUrl=${req.originalUrl}, url=${req.url}, baseUrl=${req.baseUrl}`);
  }
  
  // Логируем тело запроса для POST/PUT/PATCH (только первые 200 символов)
  if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
    const bodyStr = JSON.stringify(req.body).substring(0, 200);
    if (bodyStr.length > 0) {
      console.log(`[${timestamp}]   Body: ${bodyStr}${JSON.stringify(req.body).length > 200 ? '...' : ''}`);
    }
  }
  
  // Перехватываем ответ для логирования
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : statusCode >= 300 ? '↪️' : '✅';
    
    console.log(`[${new Date().toISOString()}] ${statusEmoji} ${method} ${url} → ${statusCode} (${duration}ms)`);
    
    return originalSend.call(this, body);
  };
  
  next();
});

// Swagger configuration
// Функция для определения правильного URL сервера из запроса
const getServerUrl = (req: express.Request): string => {
  // Проверяем заголовки от nginx прокси
  const forwardedHost = req.headers['x-forwarded-host'];
  const forwardedProto = req.headers['x-forwarded-proto'];
  const host = req.headers.host;
  
  // Если есть заголовки от прокси, значит запрос идет через nginx
  if (forwardedHost || (host && host !== `localhost:${PORT}`)) {
    const protocol = forwardedProto || (req.secure ? 'https' : 'http');
    const serverHost = forwardedHost || host || `localhost:${PORT}`;
    // ВАЖНО: базовый URL включает /api, пути в спецификации БЕЗ /api/
    // Например: базовый URL /speq-bot/webapp/api, путь /equipment/:id
    // Swagger UI формирует: /speq-bot/webapp/api/equipment/1000
    // Nginx rewrite заменяет /speq-bot/webapp/api на /api, получается /api/equipment/1000 - правильно!
    return `${protocol}://${serverHost}/speq-bot/webapp/api`;
  }
  
  // Для локальной разработки
  return `http://localhost:${PORT}`;
};

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Equipment Catalog API",
      version: "1.0.0",
      description: "REST API для каталога оборудования",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
    ],
  },
  apis: [
    path.join(__dirname, "./routes/*.ts"),
    path.join(__dirname, "./controllers/*.ts"),
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Настройка Swagger UI
// Определяем base path из заголовков (если работаем через прокси)
const getSwaggerBasePath = (req: express.Request): string => {
  // Если запрос идет через прокси с префиксом /speq-bot/webapp/api
  const originalUrl = req.originalUrl || req.url;
  if (originalUrl.includes('/speq-bot/webapp/api/api-docs')) {
    return '/speq-bot/webapp/api';
  }
  return '';
};

const swaggerUiOptions = {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "Equipment Catalog API",
  swaggerOptions: {
    persistAuthorization: true,
  },
};

// Сначала обслуживаем статические файлы через swaggerUi.serve
// swaggerUi.serve должен быть ПЕРЕД swaggerUi.setup
app.use("/api-docs", ...swaggerUi.serve);

// Затем настраиваем Swagger UI через swaggerUi.setup
app.use("/api-docs", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const basePath = getSwaggerBasePath(req);
  const serverUrl = getServerUrl(req);
  
  // Логируем для отладки
  console.log(`[Swagger] basePath: ${basePath}, serverUrl: ${serverUrl}, originalUrl: ${req.originalUrl || req.url}`);
  
  // Обновляем спецификацию Swagger с правильным URL сервера
  const specWithServer = {
    ...swaggerSpec,
    servers: [
      {
        url: serverUrl,
        description: basePath ? "Production server" : "Development server",
      },
    ],
  };
  
  // Если есть base path, добавляем его в опции Swagger
  const options = basePath 
    ? {
        ...swaggerUiOptions,
        swaggerOptions: {
          ...swaggerUiOptions.swaggerOptions,
          // Указываем правильный URL для swagger.json
          url: `${basePath}/api-docs/swagger.json`,
        },
        customJs: [
          `<script>
            // Переопределяем base path для Swagger UI и статических файлов
            (function() {
              var basePath = '${basePath}';
              
              // Переопределяем функцию для загрузки статических файлов
              var originalFetch = window.fetch;
              window.fetch = function(url, options) {
                if (typeof url === 'string' && url.startsWith('/api-docs/') && !url.startsWith(basePath)) {
                  url = basePath + url;
                }
                return originalFetch.call(this, url, options);
              };
              
              // Переопределяем пути к статическим файлам после загрузки
              window.addEventListener('load', function() {
                // Заменяем все относительные пути к статическим файлам
                var scripts = document.querySelectorAll('script[src^="/api-docs/"]');
                scripts.forEach(function(script) {
                  var src = script.getAttribute('src');
                  if (src && !src.startsWith(basePath)) {
                    script.setAttribute('src', basePath + src);
                  }
                });
                
                var links = document.querySelectorAll('link[href^="/api-docs/"]');
                links.forEach(function(link) {
                  var href = link.getAttribute('href');
                  if (href && !href.startsWith(basePath)) {
                    link.setAttribute('href', basePath + href);
                  }
                });
              });
            })();
          </script>`,
        ],
      }
    : swaggerUiOptions;
  
  swaggerUi.setup(specWithServer, options)(req, res, next);
});

// Health check
app.get("/health", async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  res.json({
    status: "ok",
    database: dbHealth,
    timestamp: new Date().toISOString(),
  });
});

// Health check также доступен через /api/health
app.get("/api/health", async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  res.json({
    status: "ok",
    database: dbHealth,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/equipment", equipmentRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 WebApp API server running on http://localhost:${PORT}`);
  console.log(`📚 Swagger docs available at http://localhost:${PORT}/api-docs`);
});
