#!/usr/bin/env node

import "dotenv/config";
import { setWebhook, deleteWebhook, getWebhookInfo } from "../telegram";

const command = process.argv[2];
const webhookUrl = process.argv[3];

async function main() {
  try {
    if (command === "set") {
      if (!webhookUrl) {
        console.error("Ошибка: укажите URL webhook");
        console.log("Использование: ts-node src/scripts/webhook.ts set <webhook_url>");
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
      console.log("  ts-node src/scripts/webhook.ts set <webhook_url>  - установить webhook");
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
