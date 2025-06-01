-- Упрощенная миграция к системе с 3 ротациями
-- Выполните этот SQL в Supabase SQL Editor

-- 1. Исправляем тип поля station_id (если нужно)
ALTER TABLE rotations ALTER COLUMN station_id TYPE TEXT;

-- 2. Очищаем старые ротации
DELETE FROM rotations;

-- 3. Сбрасываем состояние мероприятия
UPDATE event_state SET 
    current_rotation = 0,
    event_started = FALSE,
    event_paused = FALSE,
    event_start_time = NULL,
    last_rotation_time = NULL,
    total_pause_duration = 0,
    paused_at = NULL;

-- 4. Проверяем результат
SELECT 
    'rotations' as table_name,
    COUNT(*) as row_count,
    'Должно быть 0' as expected
FROM rotations

UNION ALL

SELECT 
    'event_state' as table_name,
    CASE WHEN event_started THEN 1 ELSE 0 END as row_count,
    'Должно быть 0 (не запущено)' as expected
FROM event_state

UNION ALL

SELECT 
    'participants' as table_name,
    COUNT(*) as row_count,
    'Участники сохранены' as expected
FROM participants; 