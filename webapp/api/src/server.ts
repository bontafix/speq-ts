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

// Swagger configuration
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
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
