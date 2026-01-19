/**
 * Конфигурация приложения
 */
export interface AppConfig {
    port: number;
    host: string;
    env: string;
    domain: string;
    jwt: {
        secret: string;
        expiresIn: string;
    };
    db: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        queryTimeout: number;
    };
}
/**
 * Загрузка и валидация конфигурации из .env файла в корне проекта
 */
export declare function loadConfig(): AppConfig;
export declare const config: AppConfig;
//# sourceMappingURL=index.d.ts.map