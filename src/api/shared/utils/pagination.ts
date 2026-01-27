export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Вычисляет параметры пагинации с безопасными значениями по умолчанию
 */
export function calculatePagination(
  page?: number, 
  limit?: number,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  const safePage = page && page > 0 ? page : 1;
  let safeLimit = limit && limit > 0 ? limit : defaultLimit;
  
  // Ограничиваем максимальный limit
  if (safeLimit > maxLimit) {
    safeLimit = maxLimit;
  }
  
  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

/**
 * Формирует ответ с пагинацией (плоская структура)
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  pagination: PaginationParams
) {
  return {
    items,
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit) || 1,
  };
}
