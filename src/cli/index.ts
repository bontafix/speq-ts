#!/usr/bin/env node

import "dotenv/config";
import { AppContainer } from "../app/container";
import { ChatController } from "./chat.controller";

async function main() {
  // 1. Инициализация зависимостей
  const app = new AppContainer();
  
  try {
    console.log("[Init] Запуск контейнера приложения...");
    await app.init();
    
    // 2. Запуск контроллера чата
    const chat = new ChatController(app);
    await chat.start();
    
  } catch (error) {
    console.error("❌ Критическая ошибка при запуске:");
    console.error(error);
    process.exit(1);
  }
}

void main();
