# 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Ошибка схемы базы данных

## 🚨 Проблема

При запуске мероприятия возникает ошибка:
```
Error creating rotations: {
  code: '22001',
  message: 'value too long for type character varying(1)'
}
```

## 🔍 Причина

Поле `station_id` в таблице `rotations` имеет неправильный тип `VARCHAR(1)`, который может хранить только **один символ**, а наши идентификаторы станций содержат несколько символов:
- ✅ Правильно: "1.1", "2.3", "3.2"
- ❌ Проблема: поле позволяет только "1", "2", "3"

## ⚡ БЫСТРОЕ РЕШЕНИЕ

### Шаг 1: Откройте Supabase Dashboard
1. Зайдите в [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **SQL Editor**

### Шаг 2: Выполните SQL миграцию
Скопируйте и выполните следующий SQL:

```sql
-- Проверяем текущий тип колонки (должен показать character varying с length = 1)
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'rotations' AND column_name = 'station_id';

-- Исправляем тип колонки с VARCHAR(1) на TEXT
ALTER TABLE rotations 
ALTER COLUMN station_id TYPE TEXT;

-- Проверяем, что изменение применилось (теперь должен показать text без ограничений)
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'rotations' AND column_name = 'station_id';

-- Добавляем полезный индекс для производительности  
CREATE INDEX IF NOT EXISTS idx_rotations_station_id ON rotations(station_id);
```

### Шаг 3: Перезапустите бот в Railway
1. Зайдите в Railway Dashboard
2. Найдите ваш проект
3. Нажмите **Redeploy** или просто подождите автоматического обновления

### Шаг 4: Проверьте работу
1. Откройте вашего телеграм-бота
2. Выполните команду `/start_event` (для админов)
3. Убедитесь, что ошибка больше не возникает

## ✅ Ожидаемый результат

После исправления:
- ✅ Поле `station_id` может хранить любые строки ("1.1", "2.2", "3.3")
- ✅ Бот успешно создает ротации для участников
- ✅ Мероприятие запускается без ошибок
- ✅ Участники получают корректную информацию о станциях

## 🔍 Как проверить что исправление сработало

Выполните в Supabase SQL Editor:
```sql
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'rotations' AND column_name = 'station_id';
```

**До исправления:**
```
column_name | data_type         | character_maximum_length
station_id  | character varying | 1
```

**После исправления:**
```
column_name | data_type | character_maximum_length
station_id  | text      | null
```

## 🛡️ Предотвращение в будущем

Эта проблема исправлена в:
- ✅ `database.js` - обновлена схема по умолчанию
- ✅ `README.md` - обновлены инструкции по установке
- ✅ `fix_station_id_column.sql` - готовый скрипт миграции

При новых установках проблема не повторится.

## 📞 Если проблема не решилась

1. Убедитесь, что SQL выполнился без ошибок
2. Проверьте, что вы выполнили команды в правильной базе данных
3. Перезапустите бот полностью (может потребоваться несколько минут)
4. Если проблема остается - проверьте Railway логи на наличие других ошибок 