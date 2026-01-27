import { SessionStore } from '../session.store';
import { WizardSession } from '../types';
import { getOrCreateSession } from '../utils/message.utils';

export class SessionService {
  constructor(private sessions: SessionStore) {}
  
  async get(userId: number): Promise<WizardSession | null> {
    return this.sessions.get(userId);
  }
  
  async getOrCreate(userId: number): Promise<WizardSession> {
    return getOrCreateSession(userId, this.sessions);
  }
  
  async reset(userId: number): Promise<WizardSession> {
    const session = await getOrCreateSession(userId, this.sessions);
    
    // Сбрасываем поля, сохраняя telegramId и updatedAtMs
    const newSession: WizardSession = {
      telegramId: userId,
      step: "S_CHAT",
      seedText: null,
      categoryName: null,
      typeText: null,
      paramText: null,
      page: 0,
      categoryOptions: null,
      categoryResultsPage: 0,
      lastResults: null,
      chatHistory: [],
      messageIds: [], // Очищаем messageIds
      updatedAtMs: Date.now(),
    };
    
    await this.sessions.set(newSession);
    return newSession;
  }
  
  async update(session: WizardSession): Promise<void> {
    session.updatedAtMs = Date.now();
    await this.sessions.set(session);
  }
  
  async clearMessageIds(userId: number): Promise<void> {
    const session = await this.getOrCreate(userId);
    session.messageIds = [];
    await this.update(session);
  }
}
