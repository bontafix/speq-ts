import { EquipmentSummary } from "../catalog";

/**
 * AnswerGenerator — использует LLM для генерации человеко-понятного ответа
 * на основе уже найденных данных (LLM в БД не ходит).
 */
export class AnswerGenerator {
  generatePlainText(items: EquipmentSummary[]): string {
    if (items.length === 0) {
      return "Подходящее оборудование не найдено. Попробуйте переформулировать запрос или ослабить фильтры.";
    }

    const lines: string[] = [];
    lines.push("Найдено оборудование:");

    items.forEach((item, index) => {
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

      lines.push(
        `${index + 1}. ${item.name} (${item.brand}, ${item.category}) — ${price}${
          paramsPreview ? ` | ${paramsPreview}` : ""
        }`,
      );
    });

    return lines.join("\n");
  }
}


