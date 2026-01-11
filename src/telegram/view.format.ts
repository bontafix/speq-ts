import type { EquipmentSummary } from "../catalog/catalog.types";

export interface EquipmentListItem {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  description: string | null;
  mainParameters: Record<string, string | number> | null;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Кэш для значений количества параметров
let cachedParamsPreviewCount: number | null = null;
let cachedParamsFullCount: number | null = null;

/**
 * Обновляет кэш значений количества параметров из переменных окружения.
 * Вызывается при команде /start для перечитывания конфигурации.
 */
export function refreshParamsConfig(): void {
  const previewCount = parseInt(process.env.EQUIPMENT_PARAMS_PREVIEW_COUNT || "3", 10);
  cachedParamsPreviewCount = Number.isInteger(previewCount) && previewCount > 0 ? previewCount : 3;
  
  const fullCount = parseInt(process.env.EQUIPMENT_PARAMS_FULL_COUNT || "5", 10);
  cachedParamsFullCount = Number.isInteger(fullCount) && fullCount > 0 ? fullCount : 5;
  
  console.log(`[Config] Обновлены настройки параметров: preview=${cachedParamsPreviewCount}, full=${cachedParamsFullCount}`);
}

/**
 * Получает количество параметров для превью из кэша или конфигурации.
 * Используется для краткого отображения параметров в одну строку.
 */
function getParamsPreviewCount(): number {
  if (cachedParamsPreviewCount === null) {
    refreshParamsConfig();
  }
  return cachedParamsPreviewCount!;
}

/**
 * Получает количество параметров для полного вывода из кэша или конфигурации.
 * Используется для детального отображения параметров (каждый с новой строки).
 */
function getParamsFullCount(): number {
  if (cachedParamsFullCount === null) {
    refreshParamsConfig();
  }
  return cachedParamsFullCount!;
}

// Инициализируем значения при загрузке модуля
refreshParamsConfig();

export function formatMainParamsPreview(mainParameters: Record<string, string | number> | null | undefined): string {
  const entries = Object.entries(mainParameters ?? {});
  const maxCount = getParamsPreviewCount();
  const parts = entries.slice(0, maxCount).map(([k, v]) => `${k}: ${String(v)}`);
  return parts.join("; ");
}

export function formatDescriptionPreview(description: string | null | undefined, maxLen = 140): string {
  const d = oneLine(description ?? "");
  if (!d) return "";
  if (d.length <= maxLen) return d;
  return `${d.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function formatResultsMessage(args: {
  total: number;
  categoryName: string;
  pageItems: EquipmentListItem[];
}): string {
  const header = `Найдено: ${args.total}. Категория: ${args.categoryName}.`;
  if (args.total === 0) return `${header}\n\nНичего не найдено.`;

  const lines: string[] = [header, ""];
  args.pageItems.forEach((it, i) => {
    const mp = formatMainParamsPreview(it.mainParameters);
    const brand = it.brand ? it.brand : "—";
    const title = `${i + 1}) ${it.name} — ${brand}${mp ? ` — ${mp}` : ""}`;
    const desc = formatDescriptionPreview(it.description, 160);
    lines.push(title);
    if (desc) lines.push(desc);
    lines.push("");
  });

  return lines.join("\n").trim();
}

export function formatCardMessage(it: EquipmentListItem): string {
  const brand = it.brand ? it.brand : "—";
  const mp = formatMainParamsPreview(it.mainParameters);

  const parts: string[] = [];
  parts.push(it.name);
  parts.push(`Категория: ${it.category}`);
  parts.push(`Бренд: ${brand}`);
  if (it.description) {
    parts.push("");
    parts.push(oneLine(it.description));
  }
  if (mp) {
    parts.push("");
    parts.push(`Параметры: ${mp}`);
  }
  return parts.join("\n");
}

/**
 * Форматирует цену оборудования для отображения.
 * 
 * @param price - цена (может быть числом, строкой или null)
 * @returns отформатированная строка с ценой
 */
export function formatPrice(price: string | number | null): string {
  if (price == null) {
    return "цена по запросу";
  } else if (typeof price === "number") {
    return `${price.toLocaleString("ru-RU")} ₽`;
  } else {
    return price;
  }
}

/**
 * Форматирует подпись к фото оборудования в категории для Telegram.
 * Включает полную информацию: название, бренд, категорию, цену и параметры.
 * 
 * @param item - элемент оборудования (EquipmentSummary)
 * @param index - индекс элемента (начиная с 0)
 * @returns отформатированная подпись для фото
 */
export function formatCategoryEquipmentPhotoCaption(item: EquipmentSummary, index: number): string {
  const price = formatPrice(item.price);

  // let caption = `${index + 1}. ${item.name}\n`;
  let caption = `[${item.id}] . ${item.name}\n`;
  caption += `Бренд: ${item.brand}\n`;
  // caption += `Категория: ${item.category}\n`;
  // caption += `Цена: ${price}`;
  
  // Добавляем параметры, каждый с новой строки
  console.log("formatCategoryEquipmentPhotoCaption", { 
    id: item.id, 
    mainParameters: item.mainParameters, 
    mainParametersType: typeof item.mainParameters,
    mainParametersKeys: item.mainParameters ? Object.keys(item.mainParameters) : null,
    mainParametersLength: item.mainParameters ? Object.keys(item.mainParameters).length : 0
  });
  
  if (item.mainParameters && typeof item.mainParameters === 'object' && Object.keys(item.mainParameters).length > 0) {
    const maxCount = getParamsFullCount();
    const paramsLines = Object.entries(item.mainParameters)
      .slice(0, maxCount)
      .map(([key, value]) => `  ${key}: ${value}`);
    caption += `\n\nПараметры:\n${paramsLines.join("\n")}`;
  } else {
    console.log("formatCategoryEquipmentPhotoCaption: параметры не добавлены", { 
      hasMainParameters: !!item.mainParameters,
      isObject: typeof item.mainParameters === 'object',
      keysLength: item.mainParameters ? Object.keys(item.mainParameters).length : 0
    });
  }

  return caption;
}

/**
 * Форматирует один элемент оборудования в категории в текстовую строку.
 * Используется для отправки текстовых сообщений для оборудования без изображений.
 * 
 * @param item - элемент оборудования (EquipmentSummary)
 * @param index - индекс элемента (начиная с 0)
 * @returns отформатированная строка
 */
export function formatCategoryEquipmentText(item: EquipmentSummary, index: number): string {
  const price = formatPrice(item.price);
  
  let text = `${index + 1}. ${item.name} (${item.brand}, ${item.category}) — ${price}`;
  
  // Добавляем параметры, каждый с новой строки
  console.log("formatCategoryEquipmentText", { 
    id: item.id, 
    mainParameters: item.mainParameters, 
    mainParametersType: typeof item.mainParameters,
    mainParametersKeys: item.mainParameters ? Object.keys(item.mainParameters) : null,
    mainParametersLength: item.mainParameters ? Object.keys(item.mainParameters).length : 0
  });
  
  if (item.mainParameters && typeof item.mainParameters === 'object' && Object.keys(item.mainParameters).length > 0) {
    const maxCount = getParamsFullCount();
    const paramsLines = Object.entries(item.mainParameters)
      .slice(0, maxCount)
      .map(([key, value]) => `  ${key}: ${value}`);
    text += `\n${paramsLines.join("\n")}`;
  } else {
    console.log("formatCategoryEquipmentText: параметры не добавлены", { 
      hasMainParameters: !!item.mainParameters,
      isObject: typeof item.mainParameters === 'object',
      keysLength: item.mainParameters ? Object.keys(item.mainParameters).length : 0
    });
  }
  
  // console.log("formatCategoryEquipmentText result", text);
  return text;
}


