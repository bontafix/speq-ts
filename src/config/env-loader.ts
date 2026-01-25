import dotenv from "dotenv";
import path from "path";
import fs from "fs";

/**
 * Унифицированная загрузка .env файлов для всего проекта.
 * Ищет .env.[NODE_ENV].local, .env.[NODE_ENV], .env.local, .env
 * Начинает поиск от текущей директории и идет вверх до корня проекта.
 */
export function loadEnv(): void {
  const nodeEnv = process.env.NODE_ENV || "development";
  
  // Определяем корень проекта
  function findProjectRoot(): string {
    let currentDir = process.cwd();
    const maxDepth = 10;
    let depth = 0;
    
    while (depth < maxDepth) {
      if (fs.existsSync(path.join(currentDir, "package.json"))) {
        return currentDir;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
      depth++;
    }
    return process.cwd();
  }

  const rootDir = findProjectRoot();
  
  const envFiles = [
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
    ".env.local",
    ".env"
  ];

  let loaded = false;
  for (const file of envFiles) {
    const envPath = path.join(rootDir, file);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`✅ [Env] Loaded from ${file}`);
      loaded = true;
      break; 
    }
  }

  if (!loaded && !process.env.IGNORE_ENV_MISSING) {
    console.warn(`⚠️  [Env] No .env file found in ${rootDir}. Using system environment variables.`);
  }
}

// Выполняем загрузку при импорте модуля
loadEnv();
