-- ============================================================================
-- Миграция 010: Разрешить param_type='string' в справочнике параметров
-- ============================================================================
--
-- Нужно для грузовых "текстовых" характеристик (например: Шины, Кабина, Мосты),
-- чтобы их можно было складывать в equipment.normalized_parameters по словарю.

ALTER TABLE IF EXISTS parameter_dictionary
  DROP CONSTRAINT IF EXISTS parameter_dictionary_param_type_check;

ALTER TABLE IF EXISTS parameter_dictionary
  ADD CONSTRAINT parameter_dictionary_param_type_check
  CHECK (param_type IN ('number', 'enum', 'boolean', 'string'));


