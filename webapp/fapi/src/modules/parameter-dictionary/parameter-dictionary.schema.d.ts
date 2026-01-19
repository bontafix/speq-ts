/**
 * JSON Schema для валидации запросов и ответов модуля Parameter Dictionary
 */
/**
 * Схема параметра словаря
 */
export declare const parameterDictionarySchema: {
    readonly type: "object";
    readonly properties: {
        readonly key: {
            readonly type: "string";
        };
        readonly labelRu: {
            readonly type: "string";
        };
        readonly labelEn: {
            readonly type: readonly ["string", "null"];
        };
        readonly descriptionRu: {
            readonly type: readonly ["string", "null"];
        };
        readonly category: {
            readonly type: "string";
        };
        readonly paramType: {
            readonly type: "string";
        };
        readonly unit: {
            readonly type: readonly ["string", "null"];
        };
        readonly minValue: {
            readonly type: readonly ["number", "string", "null"];
        };
        readonly maxValue: {
            readonly type: readonly ["number", "string", "null"];
        };
        readonly enumValues: {
            readonly type: readonly ["array", "null"];
            readonly items: {
                readonly type: "string";
            };
        };
        readonly aliases: {
            readonly type: readonly ["array", "null"];
            readonly items: {
                readonly type: "string";
            };
        };
        readonly sqlExpression: {
            readonly type: "string";
        };
        readonly isSearchable: {
            readonly type: readonly ["boolean", "null"];
        };
        readonly isFilterable: {
            readonly type: readonly ["boolean", "null"];
        };
        readonly priority: {
            readonly type: readonly ["integer", "null"];
        };
        readonly version: {
            readonly type: readonly ["string", "null"];
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
    readonly required: readonly ["key", "labelRu", "category", "paramType", "sqlExpression"];
};
/**
 * Схема создания параметра словаря
 */
export declare const createParameterDictionarySchema: {
    readonly type: "object";
    readonly properties: {
        readonly key: {
            readonly type: "string";
        };
        readonly labelRu: {
            readonly type: "string";
        };
        readonly labelEn: {
            readonly type: "string";
        };
        readonly descriptionRu: {
            readonly type: "string";
        };
        readonly category: {
            readonly type: "string";
        };
        readonly paramType: {
            readonly type: "string";
        };
        readonly unit: {
            readonly type: "string";
        };
        readonly minValue: {
            readonly type: "number";
        };
        readonly maxValue: {
            readonly type: "number";
        };
        readonly enumValues: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly aliases: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly sqlExpression: {
            readonly type: "string";
        };
        readonly isSearchable: {
            readonly type: "boolean";
        };
        readonly isFilterable: {
            readonly type: "boolean";
        };
        readonly priority: {
            readonly type: "integer";
        };
        readonly version: {
            readonly type: "string";
        };
    };
    readonly required: readonly ["key", "labelRu", "category", "paramType", "sqlExpression"];
};
/**
 * Схема обновления параметра словаря
 */
export declare const updateParameterDictionarySchema: {
    readonly type: "object";
    readonly properties: {
        readonly labelRu: {
            readonly type: "string";
        };
        readonly labelEn: {
            readonly type: "string";
        };
        readonly descriptionRu: {
            readonly type: "string";
        };
        readonly category: {
            readonly type: "string";
        };
        readonly paramType: {
            readonly type: "string";
        };
        readonly unit: {
            readonly type: "string";
        };
        readonly minValue: {
            readonly type: "number";
        };
        readonly maxValue: {
            readonly type: "number";
        };
        readonly enumValues: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly aliases: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly sqlExpression: {
            readonly type: "string";
        };
        readonly isSearchable: {
            readonly type: "boolean";
        };
        readonly isFilterable: {
            readonly type: "boolean";
        };
        readonly priority: {
            readonly type: "integer";
        };
        readonly version: {
            readonly type: "string";
        };
    };
};
//# sourceMappingURL=parameter-dictionary.schema.d.ts.map