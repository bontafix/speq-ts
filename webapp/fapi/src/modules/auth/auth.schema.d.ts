/**
 * JSON Schema для валидации запросов и ответов модуля Auth
 */
/**
 * Схема регистрации
 */
export declare const registerSchema: {
    readonly type: "object";
    readonly properties: {
        readonly email: {
            readonly type: "string";
            readonly format: "email";
            readonly description: "Email";
        };
        readonly password: {
            readonly type: "string";
            readonly minLength: 6;
            readonly description: "Пароль (минимум 6 символов)";
        };
        readonly name: {
            readonly type: "string";
            readonly description: "Полное имя";
        };
    };
    readonly required: readonly ["email", "password"];
};
/**
 * Схема входа
 */
export declare const loginSchema: {
    readonly type: "object";
    readonly properties: {
        readonly email: {
            readonly type: "string";
            readonly format: "email";
            readonly description: "Email";
        };
        readonly password: {
            readonly type: "string";
            readonly description: "Пароль";
        };
    };
    readonly required: readonly ["email", "password"];
};
/**
 * Схема ответа авторизации
 */
export declare const authResponseSchema: {
    readonly type: "object";
    readonly properties: {
        readonly token: {
            readonly type: "string";
            readonly description: "JWT токен";
        };
        readonly user: {
            readonly type: "object";
            readonly properties: {
                readonly id: {
                    readonly type: "integer";
                };
                readonly username: {
                    readonly type: readonly ["string", "null"];
                };
                readonly email: {
                    readonly type: readonly ["string", "null"];
                };
                readonly name: {
                    readonly type: readonly ["string", "null"];
                };
                readonly status: {
                    readonly type: readonly ["boolean", "null"];
                };
                readonly roles: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                };
                readonly createdAt: {
                    readonly type: "string";
                    readonly format: "date-time";
                };
                readonly updatedAt: {
                    readonly type: "string";
                    readonly format: "date-time";
                };
            };
        };
    };
};
//# sourceMappingURL=auth.schema.d.ts.map