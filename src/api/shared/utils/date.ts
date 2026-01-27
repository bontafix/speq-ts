/**
 * Форматирует дату в ISO строку
 */
export function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return date instanceof Date 
    ? date.toISOString() 
    : new Date(date).toISOString();
}

/**
 * Форматирует даты created_at и updated_at из строки БД
 */
export function formatTimestamps(row: { created_at?: any; updated_at?: any }) {
  return {
    createdAt: row.created_at ? formatDate(row.created_at) : null,
    updatedAt: row.updated_at ? formatDate(row.updated_at) : null,
  };
}
