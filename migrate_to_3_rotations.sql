-- Миграция к системе с 3 ротациями
-- Выполните этот SQL в Supabase SQL Editor ПЕРЕД перезапуском мероприятия

-- 1. ИСПРАВЛЯЕМ ТИП ПОЛЯ station_id (если еще не исправлено)
DO $$ 
BEGIN
    -- Проверяем текущий тип колонки
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rotations' 
        AND column_name = 'station_id' 
        AND (data_type = 'character varying' AND character_maximum_length = 1)
    ) THEN
        -- Исправляем тип колонки с VARCHAR(1) на TEXT
        ALTER TABLE rotations ALTER COLUMN station_id TYPE TEXT;
        RAISE NOTICE 'Тип поля station_id исправлен с VARCHAR(1) на TEXT';
    ELSE
        RAISE NOTICE 'Поле station_id уже имеет правильный тип';
    END IF;
END $$;

-- 2. ОЧИЩАЕМ СТАРЫЕ РОТАЦИИ (с 9 станциями)
-- ВНИМАНИЕ: Это удалит все существующие маршруты участников!
DELETE FROM rotations;
RAISE NOTICE 'Все старые ротации удалены';

-- 3. СБРАСЫВАЕМ СОСТОЯНИЕ МЕРОПРИЯТИЯ
UPDATE event_state SET 
    current_rotation = 0,
    event_started = FALSE,
    event_paused = FALSE,
    event_start_time = NULL,
    last_rotation_time = NULL,
    total_pause_duration = 0,
    paused_at = NULL;

RAISE NOTICE 'Состояние мероприятия сброшено';

-- 4. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
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

-- 5. ИНФОРМАЦИЯ О НОВОЙ СИСТЕМЕ
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ МИГРАЦИЯ ЗАВЕРШЕНА!';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 НОВАЯ СИСТЕМА:';
    RAISE NOTICE '   • 3 ротации вместо 9';
    RAISE NOTICE '   • 15 минут общее время (3 × 5 минут)';
    RAISE NOTICE '   • Каждый участник посещает все 3 группы станций';
    RAISE NOTICE '   • 100%% покрытие групп гарантировано';
    RAISE NOTICE '';
    RAISE NOTICE '📋 СЛЕДУЮЩИЕ ШАГИ:';
    RAISE NOTICE '   1. Перезапустите бота в Railway';
    RAISE NOTICE '   2. Используйте /start_event для запуска нового мероприятия';
    RAISE NOTICE '   3. Новые маршруты будут созданы автоматически';
    RAISE NOTICE '';
END $$; 