import { AppError } from '../../core/errors/app-error';

/**
 * Парсит строковый ID в число с валидацией
 */
export function parseId(id: string, entityName: string): number {
  const parsed = parseInt(id, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new AppError(`Invalid ${entityName} ID: ${id}`, 400);
  }
  return parsed;
}

/**
 * Валидирует положительное число
 */
export function validatePositiveNumber(
  value: any, 
  fieldName: string, 
  defaultValue?: number
): number | undefined {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (isNaN(num) || num <= 0) {
    throw new AppError(`${fieldName} must be a positive number`, 400);
  }
  
  return num;
}
