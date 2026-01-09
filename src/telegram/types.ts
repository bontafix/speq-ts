import type { ChatMessage } from "../llm/providers";

export type WizardStep =
  | "S1_SEED"
  | "S2_CATEGORY"
  | "S3_TYPE"
  | "S4_PARAMS"
  | "S5_RESULTS"
  | "S6_CARD"
  | "S_CHAT";

export interface CategoryOption {
  name: string;
  count: number;
}

export interface WizardSession {
  telegramId: number;
  step: WizardStep;

  seedText: string | null;
  categoryName: string | null;
  typeText: string | null;
  paramText: string | null;

  page: number;

  // Снапшот категорий, чтобы callback_data мог ссылаться на индекс.
  categoryOptions: CategoryOption[] | null;

  // В следующих итерациях сюда положим lastResults[] для кнопок "Подробнее"
  lastResults: Array<{ id: string }> | null;
  
  // История чата для LLM
  chatHistory?: ChatMessage[];

  // ID сообщений бота для возможности их удаления
  messageIds?: number[];

  updatedAtMs: number;
}


