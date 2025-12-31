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

export function formatMainParamsPreview(mainParameters: Record<string, string | number> | null | undefined): string {
  const entries = Object.entries(mainParameters ?? {});
  const parts = entries.slice(0, 3).map(([k, v]) => `${k}: ${String(v)}`);
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


