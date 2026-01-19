import { Pool } from "pg";
export type DbIssueLevel = "error" | "warn";
export interface DbIssue {
    level: DbIssueLevel;
    message: string;
}
export interface DbHealth {
    ok: boolean;
    issues: DbIssue[];
}
/**
 * Проверка здоровья базы данных
 */
export declare function checkDatabaseHealth(pool: Pool): Promise<DbHealth>;
//# sourceMappingURL=health.d.ts.map