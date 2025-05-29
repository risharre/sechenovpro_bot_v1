-- Скрипт для обновления базы данных
-- Добавляем поля для функционала паузы в таблицу event_state

-- Добавляем новые поля
ALTER TABLE event_state 
ADD COLUMN IF NOT EXISTS event_paused BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pause_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_pause_duration INTEGER DEFAULT 0;

-- Обновляем существующую запись (если есть)
UPDATE event_state 
SET 
  event_paused = FALSE,
  total_pause_duration = 0
WHERE id = 1 AND event_paused IS NULL;

-- Если записи нет, создаем новую
INSERT INTO event_state (
  event_started, 
  event_paused, 
  current_rotation, 
  total_pause_duration
) 
SELECT FALSE, FALSE, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM event_state LIMIT 1);

-- Проверяем результат
SELECT * FROM event_state; 