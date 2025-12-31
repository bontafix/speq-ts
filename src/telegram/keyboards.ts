import { Markup } from "telegraf";
import type { CategoryOption } from "./types";

export const CALLBACK = {
  reset: "cmd:reset",
  back: "cmd:back",
  help: "cmd:help",
  catPagePrev: "cat_page:prev",
  catPageNext: "cat_page:next",
  catPickPrefix: "cat:", // cat:<index>

  resPagePrev: "res_page:prev",
  resPageNext: "res_page:next",
  resDetailPrefix: "res_detail:", // res_detail:<index>
  resRefine: "act:refine",
  resChangeCategory: "act:change_category",
  resBackToResults: "act:back_results",
  showAllCategories: "act:show_all_categories",
} as const;

export function buildCategoriesKeyboard(opts: {
  categories: CategoryOption[];
  page: number;
  pageSize?: number;
}) {
  const pageSize = opts.pageSize ?? 10;
  const total = opts.categories.length;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const page = Math.min(Math.max(opts.page, 0), maxPage);

  const start = page * pageSize;
  const slice = opts.categories.slice(start, start + pageSize);

  const rows = slice.map((c, i) => [
    Markup.button.callback(`${c.name} (${c.count})`, `${CALLBACK.catPickPrefix}${start + i}`),
  ]);

  const navRow = [];
  if (page > 0) navRow.push(Markup.button.callback("◀︎", CALLBACK.catPagePrev));
  navRow.push(Markup.button.callback(`Стр. ${page + 1}/${maxPage + 1}`, CALLBACK.help));
  if (page < maxPage) navRow.push(Markup.button.callback("▶︎", CALLBACK.catPageNext));
  if (navRow.length > 0) rows.push(navRow);

  rows.push([Markup.button.callback("Сброс", CALLBACK.reset)]);

  return Markup.inlineKeyboard(rows);
}

export function buildResultsKeyboard(opts: {
  pageCount: number;
  page: number;
  canPrev: boolean;
  canNext: boolean;
}) {
  const rows: any[] = [];

  // "Подробнее 1..k" - делаем по 2 в ряд
  const detailBtns = Array.from({ length: opts.pageCount }, (_, i) =>
    Markup.button.callback(`Подробнее ${i + 1}`, `${CALLBACK.resDetailPrefix}${i}`),
  );
  for (let i = 0; i < detailBtns.length; i += 2) {
    rows.push(detailBtns.slice(i, i + 2));
  }

  const navRow = [];
  if (opts.canPrev) navRow.push(Markup.button.callback("◀︎ Пред", CALLBACK.resPagePrev));
  navRow.push(Markup.button.callback(`Стр. ${opts.page + 1}`, CALLBACK.help));
  if (opts.canNext) navRow.push(Markup.button.callback("След ▶︎", CALLBACK.resPageNext));
  rows.push(navRow);

  rows.push([
    Markup.button.callback("Уточнить", CALLBACK.resRefine),
    Markup.button.callback("Сменить категорию", CALLBACK.resChangeCategory),
  ]);
  rows.push([Markup.button.callback("Сброс", CALLBACK.reset)]);

  return Markup.inlineKeyboard(rows);
}

export function buildCardKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Назад к результатам", CALLBACK.resBackToResults)],
    [
      Markup.button.callback("Уточнить", CALLBACK.resRefine),
      Markup.button.callback("Сменить категорию", CALLBACK.resChangeCategory),
    ],
    [Markup.button.callback("Сброс", CALLBACK.reset)],
  ]);
}

export function buildCategoryChosenKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Сменить категорию", CALLBACK.resChangeCategory)],
    [Markup.button.callback("Сброс", CALLBACK.reset)],
  ]);
}

export function buildCategorySuggestionKeyboard(opts: { categoryName: string; categoryIndex: number }) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`✅ Выбрать: ${opts.categoryName}`, `${CALLBACK.catPickPrefix}${opts.categoryIndex}`)],
    [Markup.button.callback("📋 Показать все категории", CALLBACK.showAllCategories)],
    [Markup.button.callback("Сброс", CALLBACK.reset)],
  ]);
}


