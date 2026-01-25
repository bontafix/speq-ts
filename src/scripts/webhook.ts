#!/usr/bin/env node

import "../config/env-loader";
import { setWebhook, deleteWebhook, getWebhookInfo } from "../telegram";

const command = process.argv[2];
const webhookUrlArg = process.argv[3];

async function main() {
  try {
    if (command === "set") {
      // Сначала проверяем аргумент командной строки, затем переменную окружения
      const webhookUrl = webhookUrlArg || process.env.TELEGRAM_WEBHOOK_URL;
      
      if (!webhookUrl) {
        console.error("Ошибка: укажите URL webhook");
        console.log("Использование:");
        console.log("  1. Через переменную окружения: установите TELEGRAM_WEBHOOK_URL в .env");
        console.log("  2. Через аргумент: ts-node src/scripts/webhook.ts set <webhook_url>");
        process.exit(1);
      }
      
      await setWebhook(webhookUrl);
      console.log(`✅ Webhook установлен: ${webhookUrl}`);
    } else if (command === "delete") {
      await deleteWebhook();
      console.log("✅ Webhook удален");
    } else if (command === "info") {
      const info = await getWebhookInfo();
      console.log("Информация о webhook:");
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.error("Ошибка: неизвестная команда");
      console.log("Использование:");
      console.log("  ts-node src/scripts/webhook.ts set [webhook_url]  - установить webhook");
      console.log("                                                      (URL можно указать в .env как TELEGRAM_WEBHOOK_URL)");
      console.log("  ts-node src/scripts/webhook.ts delete            - удалить webhook");
      console.log("  ts-node src/scripts/webhook.ts info              - информация о webhook");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("Ошибка:", error?.message);
    process.exit(1);
  }
}

void main();
