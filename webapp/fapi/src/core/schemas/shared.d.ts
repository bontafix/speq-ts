/**
 * Общие JSON Schema определения для валидации
 */
/**
 * Схема для пагинации
 */
export declare const paginationSchema: {
    readonly type: "object";
    readonly properties: {
        readonly page: {
            readonly type: "integer";
            readonly minimum: 1;
            readonly default: 1;
            readonly description: "Номер страницы";
        };
        readonly limit: {
            readonly type: "integer";
            readonly minimum: 1;
            readonly maximum: 100;
            readonly default: 20;
            readonly description: "Количество элементов на странице";
        };
    };
};
/**
 * Схема стандартного ответа с ошибкой
 */
export declare const errorResponseSchema: {
    readonly type: "object";
    readonly properties: {
        readonly error: {
            readonly type: "object";
            readonly properties: {
                readonly code: {
                    readonly type: "string";
                };
                readonly message: {
                    readonly type: "string";
                };
                readonly details: {
                    readonly type: "object";
                };
            };
            readonly required: readonly ["code", "message"];
        };
    };
    readonly required: readonly ["error"];
};
//# sourceMappingURL=shared.d.ts.map