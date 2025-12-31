import { normalizeText } from "./text.utils";
import type { CategoryOption } from "./types";

export interface CategoryPick {
  name: string;
  score: number; // 0..1
}

function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean);
}

const STOP_WORDS = new Set([
  "мне",
  "меня",
  "нужен",
  "нужна",
  "нужно",
  "нужны",
  "ищу",
  "хочу",
  "надо",
  "пожалуйста",
  "плиз",
  "есть",
  "по",
  "для",
  "и",
  "а",
  "ну",
  "да",
  "нет",
  "не",
]);

function roughStemRu(w: string): string {
  // Очень грубый стеммер для MVP: снимаем частые окончания мн.ч. и падежей.
  // Это нужно, чтобы "кран" матчился с "краны", "экскаватор" с "экскаваторы".
  let x = w;
  if (x.length <= 4) return x;
  const endings = [
    "ами",
    "ями",
    "ов",
    "ев",
    "ых",
    "их",
    "ой",
    "ей",
    "ам",
    "ям",
    "ах",
    "ях",
    "ы",
    "и",
    "а",
    "я",
    "е",
    "у",
    "ю",
  ];
  for (const e of endings) {
    if (x.endsWith(e) && x.length - e.length >= 3) {
      x = x.slice(0, -e.length);
      break;
    }
  }
  return x;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  if (union === 0) return 0;
  return inter / union;
}

export function pickCategoryFromSeed(seedText: string, categories: CategoryOption[]): CategoryPick | null {
  const seed = normalizeText(seedText);
  if (!seed) return null;

  const seedTokens = tokenize(seed)
    .filter((t) => !STOP_WORDS.has(t))
    .map(roughStemRu)
    .filter(Boolean);
  const seedSet = new Set(seedTokens);

  let best: CategoryPick | null = null;
  for (const c of categories) {
    const cat = normalizeText(c.name);
    if (!cat) continue;

    let score = 0;
    if (seed === cat) score = 1.0;
    else if (seed.includes(cat) || cat.includes(seed)) score = 0.92;
    else {
      const catTokens = tokenize(cat).map(roughStemRu).filter(Boolean);
      const catSet = new Set(catTokens);
      // Если все токены категории встречаются в seed — это сильный сигнал.
      // Пример: seed="мне нужен кран" → токен "кран" ⊆ {"кран"}.
      if (catSet.size > 0 && catSet.size <= 2) {
        let allPresent = true;
        for (const t of catSet) {
          if (!seedSet.has(t)) {
            allPresent = false;
            break;
          }
        }
        if (allPresent) score = 0.92;
      }

      const jac = jaccard(seedSet, catSet);
      if (score < 0.92) {
        if (jac >= 0.6) score = 0.85;
        else if (jac >= 0.34) score = 0.75;
      }
    }

    if (!best || score > best.score) best = { name: c.name, score };
  }

  return best && best.score > 0 ? best : null;
}


