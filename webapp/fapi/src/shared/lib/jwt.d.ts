/**
 * Интерфейс payload JWT токена
 */
export interface JwtPayload {
    userId: number;
    username: string;
    email: string;
}
/**
 * Создание JWT токена
 */
export declare function createToken(payload: JwtPayload): string;
/**
 * Верификация JWT токена
 */
export declare function verifyToken(token: string): JwtPayload;
//# sourceMappingURL=jwt.d.ts.map