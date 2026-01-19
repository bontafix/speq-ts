"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.requireAnyRole = requireAnyRole;
const jwt_1 = require("../../shared/lib/jwt");
const app_error_1 = require("../errors/app-error");
const user_repository_1 = require("../../modules/users/user.repository");
/**
 * Middleware для проверки авторизации
 * Добавляет user в request
 */
async function authenticate(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new app_error_1.UnauthorizedError("Authorization header is required");
    }
    const token = authHeader.substring(7);
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        // Получаем роли пользователя из БД
        const userRepository = new user_repository_1.UserRepository(request.server);
        const roles = await userRepository.getUserRoles(payload.userId);
        request.user = {
            ...payload,
            roles,
        };
    }
    catch (error) {
        throw new app_error_1.UnauthorizedError("Invalid or expired token");
    }
}
/**
 * Middleware для проверки наличия конкретной роли
 */
function requireRole(roleName) {
    return async (request, reply) => {
        // Сначала проверяем авторизацию
        await authenticate(request, reply);
        if (!request.user) {
            throw new app_error_1.UnauthorizedError("User not authenticated");
        }
        if (!request.user.roles.includes(roleName)) {
            throw new app_error_1.ForbiddenError(`Role '${roleName}' is required`);
        }
    };
}
/**
 * Middleware для проверки наличия одной из ролей
 */
function requireAnyRole(roleNames) {
    return async (request, reply) => {
        // Сначала проверяем авторизацию
        await authenticate(request, reply);
        if (!request.user) {
            throw new app_error_1.UnauthorizedError("User not authenticated");
        }
        const hasRole = roleNames.some((role) => request.user.roles.includes(role));
        if (!hasRole) {
            throw new app_error_1.ForbiddenError(`One of roles [${roleNames.join(", ")}] is required`);
        }
    };
}
//# sourceMappingURL=auth.decorator.js.map