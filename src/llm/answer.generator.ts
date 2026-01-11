import { EquipmentSummary } from "../catalog";
import { existsSync } from "fs";
import { join } from "path";
import { cwd } from "process";

/**
 * AnswerGenerator — использует LLM для генерации человеко-понятного ответа
 * на основе уже найденных данных (LLM в БД не ходит).
 */
export class AnswerGenerator {
  private readonly imagesDir: string;
  private readonly imageBaseUrl: string;

  constructor(imagesDir?: string, imageBaseUrl?: string) {
    this.imagesDir = imagesDir || join(cwd(), "images");
    // Формат URL: https://domain.com/speq-images/{id}/200
    this.imageBaseUrl = imageBaseUrl || process.env.IMAGE_BASE_URL || "";
  }

  /**
   * Проверяет существование локального файла изображения.
   * Ищет файл с именем "0" и расширением png или jpg в подпапке images/{id}/
   * 
   * Путь поиска: {imagesDir}/{equipmentId}/0.png или {imagesDir}/{equipmentId}/0.jpg
   * Пример: /home/boris/dev/speq-ts/images/1455/0.jpg
   * 
   * @param equipmentId - id оборудования
   * @returns true, если файл существует
   */
  hasLocalImage(equipmentId: string): boolean {
    const dirPath = join(this.imagesDir, equipmentId);
    
    // Проверяем сначала png, потом jpg
    const extensions = [".png", ".jpg"];
    for (const ext of extensions) {
      const imagePath = join(dirPath, `0${ext}`);
      if (existsSync(imagePath)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Возвращает URL изображения для оборудования.
   * Формат: https://domain.com/speq-images/{equipmentId}/200
   * 
   * @param equipmentId - id оборудования
   * @returns URL изображения или null, если baseUrl не задан
   */
  getImageUrl(equipmentId: string): string | null {
    if (!this.imageBaseUrl) {
      return null;
    }
    
    // Проверяем, что локальный файл существует (опционально)
    // Можно убрать эту проверку, если всегда предполагается наличие файла на сервере
    if (!this.hasLocalImage(equipmentId)) {
      return null;
    }
    
    // Формируем URL: https://domain.com/speq-images/{id}/200
    const base = this.imageBaseUrl.endsWith("/") 
      ? this.imageBaseUrl.slice(0, -1) 
      : this.imageBaseUrl;
    
    return `${base}/speq-images/${equipmentId}/200`;
  }

  /**
   * Форматирует подпись к фото оборудования для Telegram.
   * Включает полную информацию: название, бренд, категорию, цену и параметры.
   * 
   * @param item - элемент оборудования
   * @param index - индекс элемента (начиная с 0)
   * @returns отформатированная подпись для фото
   */
  formatPhotoCaption(item: EquipmentSummary, index: number): string {
    const paramsPreview = Object.entries(item.mainParameters || {})
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");

    let price: string;
    if (item.price == null) {
      price = "цена по запросу";
    } else if (typeof item.price === "number") {
      price = `${item.price.toLocaleString("ru-RU")} ₽`;
    } else {
      price = item.price;
    }

    let caption = `${index + 1}. ${item.name}\n`;
    caption += `Бренд: ${item.brand}\n`;
    caption += `Категория: ${item.category}\n`;
    caption += `Цена: ${price}`;
    
    if (paramsPreview) {
      caption += `\n\nПараметры: ${paramsPreview}`;
    }

    return caption;
  }

  /**
   * Форматирует один элемент оборудования в текстовую строку.
   * Используется для генерации списка и может быть переиспользован в других местах.
   * 
   * @param item - элемент оборудования
   * @param index - индекс элемента (начиная с 0)
   * @param includeImage - включать ли информацию об изображении
   * @returns отформатированная строка
   */
  formatItem(item: EquipmentSummary, index: number, includeImage: boolean = false): string {
    const paramsPreview = Object.entries(item.mainParameters || {})
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");

    let price: string;
    if (item.price == null) {
      price = "цена по запросу";
    } else if (typeof item.price === "number") {
      price = `${item.price.toLocaleString("ru-RU")} ₽`;
    } else {
      price = item.price;
    }

    let imageInfo = "";
    if (includeImage) {
      const imageUrl = this.getImageUrl(item.id);
      if (imageUrl) {
        imageInfo = ` 📷 ${imageUrl}`;
      }
    }

    return `${index + 1}. ${item.name} (${item.brand}, ${item.category}) — ${price}${
      paramsPreview ? ` | ${paramsPreview}` : ""
    }${imageInfo}`;
  }

  /**
   * Генерирует текстовое представление списка оборудования.
   * Включает информацию об изображениях, если они доступны.
   * 
   * @param items - список оборудования
   * @param includeImages - включать ли URL изображений в текст (по умолчанию true)
   *                       Установите false, если изображения отправляются отдельно (например, в Telegram)
   * @returns отформатированный текст списка
   */
  generatePlainText(items: EquipmentSummary[], includeImages: boolean = true): string {
    if (items.length === 0) {
      return "Подходящее оборудование не найдено. Попробуйте переформулировать запрос или ослабить фильтры.";
    }

    const lines: string[] = [];
    lines.push("Найдено оборудование:");

    items.forEach((item, index) => {
      lines.push(this.formatItem(item, index, includeImages));
    });

    return lines.join("\n");
  }
}


