"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.sendSuccess = sendSuccess;
/**
 * Форматирование успешного ответа
 */
function successResponse(data) {
    return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Отправка успешного ответа
 */
function sendSuccess(reply, data, statusCode = 200) {
    return reply.status(statusCode).send(successResponse(data));
}
//# sourceMappingURL=api-response.js.map