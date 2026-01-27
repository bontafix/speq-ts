/**
 * Билдер для построения динамических UPDATE запросов
 */
export class UpdateQueryBuilder {
  private updates: string[] = [];
  private values: any[] = [];
  private paramIndex = 1;
  
  /**
   * Добавляет поле для обновления
   * @param field - имя поля в объекте данных
   * @param value - значение поля
   * @param dbField - имя поля в БД (если отличается от field)
   */
  addField(field: string, value: any, dbField?: string): this {
    if (value !== undefined) {
      this.updates.push(`${dbField || field} = $${this.paramIndex++}`);
      this.values.push(value);
    }
    return this;
  }
  
  /**
   * Добавляет поле с преобразованием camelCase -> snake_case
   */
  addFieldSnakeCase(field: string, value: any): this {
    if (value !== undefined) {
      const dbField = this.toSnakeCase(field);
      return this.addField(field, value, dbField);
    }
    return this;
  }
  
  /**
   * Добавляет обновление временной метки (обычно updated_at)
   * @param field - имя поля (по умолчанию updated_at)
   */
  addTimestamp(field: string = 'updated_at'): this {
    this.updates.push(`${field} = CURRENT_TIMESTAMP`);
    return this;
  }

  /**
   * Проверяет, есть ли поля для обновления
   */
  hasUpdates(): boolean {
    return this.updates.length > 0;
  }
  
  /**
   * Строит финальный SQL запрос
   */
  build(table: string, idField: string, idValue: any): { sql: string; values: any[] } {
    if (this.updates.length === 0) {
      throw new Error('No fields to update');
    }
    
    const sql = `
      UPDATE ${table} 
      SET ${this.updates.join(', ')} 
      WHERE ${idField} = $${this.paramIndex} 
      RETURNING *
    `.trim();
    
    return {
      sql,
      values: [...this.values, idValue],
    };
  }
  
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
