/**
 * JSON Schema для валидации запросов и ответов модуля Users
 */
/**
 * Схема пользователя
 */
export declare const userSchema: {
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
        readonly limitDocument: {
            readonly type: readonly ["integer", "null"];
        };
        readonly limitSizePdf: {
            readonly type: readonly ["integer", "null"];
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
/**
 * Схема создания пользователя
 */
export declare const createUserSchema: {
    readonly type: "object";
    readonly properties: {
        readonly username: {
            readonly type: "string";
        };
        readonly email: {
            readonly type: "string";
            readonly format: "email";
        };
        readonly password: {
            readonly type: "string";
            readonly minLength: 6;
        };
        readonly name: {
            readonly type: "string";
        };
        readonly status: {
            readonly type: "boolean";
        };
        readonly limitDocument: {
            readonly type: "integer";
        };
        readonly limitSizePdf: {
            readonly type: "integer";
        };
    };
    readonly required: readonly ["password"];
    readonly anyOf: readonly [{
        readonly required: readonly ["username"];
    }, {
        readonly required: readonly ["email"];
    }];
};
/**
 * Схема обновления пользователя
 */
export declare const updateUserSchema: {
    readonly type: "object";
    readonly properties: {
        readonly username: {
            readonly type: "string";
        };
        readonly email: {
            readonly type: "string";
            readonly format: "email";
        };
        readonly password: {
            readonly type: "string";
            readonly minLength: 6;
        };
        readonly name: {
            readonly type: "string";
        };
        readonly status: {
            readonly type: "boolean";
        };
        readonly limitDocument: {
            readonly type: "integer";
        };
        readonly limitSizePdf: {
            readonly type: "integer";
        };
    };
};
/**
 * Схема назначения роли
 */
export declare const assignRoleSchema: {
    readonly type: "object";
    readonly properties: {
        readonly roleId: {
            readonly type: "integer";
        };
    };
    readonly required: readonly ["roleId"];
};
//# sourceMappingURL=user.schema.d.ts.map