/**
 * JSON Schema для валидации запросов и ответов модуля Categories
 */
/**
 * Схема категории
 */
export declare const categorySchema: {
    readonly type: "object";
    readonly properties: {
        readonly id: {
            readonly type: "integer";
        };
        readonly name: {
            readonly type: "string";
        };
        readonly parentId: {
            readonly type: readonly ["integer", "null"];
        };
        readonly isActive: {
            readonly type: readonly ["boolean", "null"];
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
/**
 * Схема query параметров для получения списка категорий
 */
export declare const getCategoryListQuerySchema: {
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
 * Схема ответа с пагинированным списком категорий
 */
export declare const paginatedCategoryListSchema: {
    readonly type: "object";
    readonly properties: {
        readonly items: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly id: {
                        readonly type: "integer";
                    };
                    readonly name: {
                        readonly type: "string";
                    };
                    readonly parentId: {
                        readonly type: readonly ["integer", "null"];
                    };
                    readonly isActive: {
                        readonly type: readonly ["boolean", "null"];
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
            readonly description: "Список категорий";
        };
        readonly total: {
            readonly type: "integer";
            readonly description: "Общее количество записей";
        };
        readonly page: {
            readonly type: "integer";
            readonly description: "Номер текущей страницы";
        };
        readonly limit: {
            readonly type: "integer";
            readonly description: "Количество элементов на странице";
        };
        readonly totalPages: {
            readonly type: "integer";
            readonly description: "Общее количество страниц";
        };
    };
    readonly required: readonly ["items", "total", "page", "limit", "totalPages"];
};
/**
 * Схема создания категории
 */
export declare const createCategorySchema: {
    readonly type: "object";
    readonly properties: {
        readonly name: {
            readonly type: "string";
        };
        readonly parentId: {
            readonly type: readonly ["integer", "null"];
        };
        readonly isActive: {
            readonly type: "boolean";
        };
    };
    readonly required: readonly ["name"];
};
/**
 * Схема обновления категории
 */
export declare const updateCategorySchema: {
    readonly type: "object";
    readonly properties: {
        readonly name: {
            readonly type: "string";
        };
        readonly parentId: {
            readonly type: readonly ["integer", "null"];
        };
        readonly isActive: {
            readonly type: "boolean";
        };
    };
};
//# sourceMappingURL=category.schema.d.ts.map