export function normalizeText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

export type ServiceCommand = "reset" | "back" | "help" | null;

export function detectServiceCommand(raw: string): ServiceCommand {
  const t = normalizeText(raw);
  if (!t) return null;
  if (t === "сброс" || t === "/reset") return "reset";
  if (t === "назад") return "back";
  if (t === "помощь" || t === "/help") return "help";
  return null;
}

/**
 * Эвристика "пользователь передумал и написал новый seed" на шагах S3/S4.
 * В MVP без LLM: ловим самые частые конструкции.
 */
export function looksLikeNewSeed(raw: string): boolean {
  const t = normalizeText(raw);
  if (!t) return false;

  // "не, ..." / "не ..." / "нет, ..."
  if (t.startsWith("не,") || t.startsWith("не ") || t.startsWith("нет,") || t.startsWith("нет ")) {
    return t.length >= 6;
  }

  // Явные запросы
  const markers = ["ищу ", "нужен ", "нужна ", "нужно ", "мне нужен", "мне нужна", "хочу ", "надо "];
  if (markers.some((m) => t.includes(m))) return true;

  return false;
}


