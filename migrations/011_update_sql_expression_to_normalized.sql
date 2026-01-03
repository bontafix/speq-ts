-- ============================================================================
-- Миграция 011: Обновление sql_expression для использования normalized_parameters
-- ============================================================================
--
-- Обновляет все sql_expression в parameter_dictionary, чтобы они использовали
-- normalized_parameters вместо main_parameters для единообразия и производительности.

UPDATE parameter_dictionary 
SET sql_expression = CASE 
  WHEN param_type = 'number' THEN '(normalized_parameters->>' || quote_literal(key) || ')::numeric'
  ELSE 'normalized_parameters->>' || quote_literal(key)
END,
updated_at = NOW()
WHERE sql_expression LIKE '%main_parameters%';

-- Проверка: сколько записей было обновлено
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Обновлено записей: %', updated_count;
END $$;
