-- Исправление поля station_id в таблице rotations
-- Эта миграция нужна для исправления ошибки "value too long for type character varying(1)"

-- Проверяем текущий тип колонки station_id
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'rotations' AND column_name = 'station_id';

-- Изменяем тип колонки station_id с VARCHAR(1) на TEXT
ALTER TABLE rotations 
ALTER COLUMN station_id TYPE TEXT;

-- Проверяем, что изменение применилось
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'rotations' AND column_name = 'station_id';

-- Также убедимся, что у нас правильные индексы
CREATE INDEX IF NOT EXISTS idx_rotations_participant_rotation ON rotations(participant_id, rotation_number);
CREATE INDEX IF NOT EXISTS idx_rotations_station_id ON rotations(station_id); 