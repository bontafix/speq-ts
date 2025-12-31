import { pgPool } from "../db/pg";
import type { WizardSession } from "./types";

const DEFAULT_TTL_MS = 45 * 60 * 1000; // 45 минут

export interface SessionStore {
  get(telegramId: number): Promise<WizardSession | null>;
  set(session: WizardSession): Promise<void>;
  clear(telegramId: number): Promise<void>;
}

class MemorySessionStore implements SessionStore {
  private map = new Map<number, WizardSession>();

  constructor(private readonly ttlMs: number) {}

  async get(telegramId: number): Promise<WizardSession | null> {
    const s = this.map.get(telegramId) ?? null;
    if (!s) return null;
    if (Date.now() - s.updatedAtMs > this.ttlMs) {
      this.map.delete(telegramId);
      return null;
    }
    return s;
  }

  async set(session: WizardSession): Promise<void> {
    this.map.set(session.telegramId, { ...session, updatedAtMs: Date.now() });
  }

  async clear(telegramId: number): Promise<void> {
    this.map.delete(telegramId);
  }
}

class PostgresSessionStore implements SessionStore {
  private initialized = false;

  constructor(private readonly ttlMs: number) {}

  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS telegram_wizard_sessions (
        telegram_id BIGINT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS telegram_wizard_sessions_updated_at_idx
      ON telegram_wizard_sessions(updated_at)
    `);
    this.initialized = true;
  }

  async get(telegramId: number): Promise<WizardSession | null> {
    await this.ensureInit();
    const res = await pgPool.query<{ data: WizardSession; updated_at: string }>(
      `SELECT data, updated_at FROM telegram_wizard_sessions WHERE telegram_id = $1`,
      [telegramId],
    );
    const row = res.rows[0];
    if (!row) return null;

    const updatedAtMs = new Date(row.updated_at).getTime();
    if (Date.now() - updatedAtMs > this.ttlMs) {
      await this.clear(telegramId);
      return null;
    }

    // Доверяем типу WizardSession, т.к. это наш же JSON.
    return { ...row.data, telegramId, updatedAtMs };
  }

  async set(session: WizardSession): Promise<void> {
    await this.ensureInit();
    const data: WizardSession = { ...session, updatedAtMs: Date.now() };
    await pgPool.query(
      `
        INSERT INTO telegram_wizard_sessions (telegram_id, data, updated_at)
        VALUES ($1, $2::jsonb, now())
        ON CONFLICT (telegram_id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = now()
      `,
      [data.telegramId, JSON.stringify(data)],
    );
  }

  async clear(telegramId: number): Promise<void> {
    await this.ensureInit();
    await pgPool.query(`DELETE FROM telegram_wizard_sessions WHERE telegram_id = $1`, [telegramId]);
  }
}

export async function createSessionStore(ttlMs = DEFAULT_TTL_MS): Promise<SessionStore> {
  // Пробуем Postgres; если не получилось — не ломаем бота, работаем в памяти.
  try {
    await pgPool.query("SELECT 1");
    return new PostgresSessionStore(ttlMs);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[Telegram] PostgreSQL недоступен для session store, fallback в память: ${String(e)}`);
    return new MemorySessionStore(ttlMs);
  }
}


