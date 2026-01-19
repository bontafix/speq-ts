/**
 * JSON Schema для валидации запросов и ответов модуля Equipment
 */
/**
 * Схема параметров пути для получения оборудования по ID
 */
export declare const getEquipmentByIdParamsSchema: {
    readonly type: "object";
    readonly properties: {
        readonly id: {
            readonly type: "string";
            readonly description: "ID оборудования";
        };
    };
    readonly required: readonly ["id"];
};
/**
 * Схема query параметров для получения списка оборудования
 */
export declare const getEquipmentListQuerySchema: {
    readonly type: "object";
    readonly properties: {
        readonly category: {
            readonly type: "string";
            readonly description: "Фильтр по названию категории";
        };
        readonly brand: {
            readonly type: "string";
            readonly description: "Фильтр по названию бренда";
        };
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
 * Схема ответа с карточкой оборудования
 */
export declare const equipmentCardSchema: {
    readonly type: "object";
    readonly properties: {
        readonly id: {
            readonly type: "string";
            readonly description: "Уникальный идентификатор оборудования";
        };
        readonly name: {
            readonly type: "string";
            readonly description: "Название оборудования";
        };
        readonly category: {
            readonly type: "string";
            readonly description: "Категория";
        };
        readonly subcategory: {
            readonly type: readonly ["string", "null"];
            readonly description: "Подкатегория";
        };
        readonly brand: {
            readonly type: readonly ["string", "null"];
            readonly description: "Бренд";
        };
        readonly region: {
            readonly type: readonly ["string", "null"];
            readonly description: "Регион";
        };
        readonly description: {
            readonly type: readonly ["string", "null"];
            readonly description: "Описание";
        };
        readonly price: {
            readonly type: readonly ["number", "null"];
            readonly description: "Цена";
        };
        readonly imageUrl: {
            readonly type: "string";
            readonly description: "Ссылка на изображение оборудования";
        };
        readonly mainParameters: {
            readonly type: "object";
            readonly additionalProperties: {
                readonly type: "string";
            };
            readonly description: "Основные параметры (JSONB)";
        };
        readonly normalizedParameters: {
            readonly type: "object";
            readonly additionalProperties: {
                readonly oneOf: readonly [{
                    readonly type: "number";
                }, {
                    readonly type: "string";
                }];
            };
            readonly description: "Нормализованные параметры (JSONB)";
        };
        readonly createdAt: {
            readonly type: "string";
            readonly format: "date-time";
            readonly description: "Дата создания";
        };
        readonly updatedAt: {
            readonly type: "string";
            readonly format: "date-time";
            readonly description: "Дата обновления";
        };
    };
    readonly required: readonly ["id", "name", "category", "imageUrl", "createdAt", "updatedAt"];
};
/**
 * Схема ответа с пагинированным списком оборудования
 */
export declare const paginatedEquipmentListSchema: {
    readonly type: "object";
    readonly properties: {
        readonly items: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly id: {
                        readonly type: "string";
                        readonly description: "Уникальный идентификатор оборудования";
                    };
                    readonly name: {
                        readonly type: "string";
                        readonly description: "Название оборудования";
                    };
                    readonly category: {
                        readonly type: "string";
                        readonly description: "Категория";
                    };
                    readonly subcategory: {
                        readonly type: readonly ["string", "null"];
                        readonly description: "Подкатегория";
                    };
                    readonly brand: {
                        readonly type: readonly ["string", "null"];
                        readonly description: "Бренд";
                    };
                    readonly region: {
                        readonly type: readonly ["string", "null"];
                        readonly description: "Регион";
                    };
                    readonly description: {
                        readonly type: readonly ["string", "null"];
                        readonly description: "Описание";
                    };
                    readonly price: {
                        readonly type: readonly ["number", "null"];
                        readonly description: "Цена";
                    };
                    readonly imageUrl: {
                        readonly type: "string";
                        readonly description: "Ссылка на изображение оборудования";
                    };
                    readonly mainParameters: {
                        readonly type: "object";
                        readonly additionalProperties: {
                            readonly type: "string";
                        };
                        readonly description: "Основные параметры (JSONB)";
                    };
                    readonly normalizedParameters: {
                        readonly type: "object";
                        readonly additionalProperties: {
                            readonly oneOf: readonly [{
                                readonly type: "number";
                            }, {
                                readonly type: "string";
                            }];
                        };
                        readonly description: "Нормализованные параметры (JSONB)";
                    };
                    readonly createdAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                        readonly description: "Дата создания";
                    };
                    readonly updatedAt: {
                        readonly type: "string";
                        readonly format: "date-time";
                        readonly description: "Дата обновления";
                    };
                };
                readonly required: readonly ["id", "name", "category", "imageUrl", "createdAt", "updatedAt"];
            };
            readonly description: "Список оборудования";
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
//# sourceMappingURL=equipment.schema.d.ts.map