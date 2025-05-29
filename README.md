# Sechenov Pro Network Event Bot

Телеграм-бот для автоматического управления сетевым мероприятием с 9 станциями и 150 участниками.

## 🚀 Быстрый старт

### 1. Клонирование и установка зависимостей

```bash
# Клонировать репозиторий
git clone <repository-url>
cd sechenovpro_bot_v1

# Установить зависимости
npm install
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корневой директории:

```env
BOT_TOKEN=your_telegram_bot_token_here
ADMIN_USERNAMES=admin_username1,admin_username2
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
CV_FORM_URL=https://forms.yandex.ru/cloud/67d6fd5090fa7be3dc213e5f/
```

### 3. Настройка базы данных Supabase

1. Создайте проект на [Supabase](https://supabase.com)
2. Перейдите в SQL Editor
3. Выполните следующий SQL скрипт:

```sql
-- Таблица участников
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  participant_number VARCHAR(3) UNIQUE NOT NULL,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица ротаций (расписание для каждого участника)
CREATE TABLE IF NOT EXISTS rotations (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  rotation_number INTEGER NOT NULL,
  station_id VARCHAR(1) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant_id, rotation_number)
);

-- Таблица текущего состояния мероприятия
CREATE TABLE IF NOT EXISTS event_state (
  id SERIAL PRIMARY KEY,
  current_rotation INTEGER DEFAULT 0,
  event_started BOOLEAN DEFAULT FALSE,
  event_start_time TIMESTAMP WITH TIME ZONE,
  last_rotation_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица админов
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  user_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Инициализация состояния
INSERT INTO event_state (current_rotation, event_started) 
VALUES (0, false) 
ON CONFLICT DO NOTHING;
```

### 4. Создание телеграм-бота

1. Откройте [@BotFather](https://t.me/botfather) в Telegram
2. Создайте нового бота командой `/newbot`
3. Скопируйте токен и вставьте в `.env` файл

### 5. Запуск бота

```bash
# Режим разработки
npm run dev

# Продакшн режим
npm start
```

## 🎯 Основные команды

### Для участников:
- `/start` - Регистрация и главное меню

### Для администраторов:
- `/start_event` - Запустить мероприятие
- `/pause_event` - Приостановить мероприятие (с сохранением прогресса)
- `/resume_event` - Возобновить приостановленное мероприятие  
- `/stop_event` - Остановить мероприятие (сброс прогресса)
- `/status` - Показать статус мероприятия

## ⚙️ Логика работы

### Состояния мероприятия:
1. **Не запущено** - участники регистрируются, ротации не созданы
2. **Активно** - мероприятие идет, автоматические ротации работают
3. **На паузе** - мероприятие приостановлено, прогресс сохранен
4. **Остановлено** - мероприятие завершено или принудительно остановлено

### Разница между "Пауза" и "Остановка":

#### 🔄 **Пауза** (`/pause_event`):
- ✅ Прогресс участников **сохраняется**
- ✅ Ротации остаются в базе данных
- ✅ При возобновлении участники продолжают с той же станции
- ✅ Счетчик времени паузы ведется отдельно
- 🎯 **Использовать при:** технических проблемах, перерывах

#### ⏹️ **Остановка** (`/stop_event`):
- ❌ Прогресс участников **сбрасывается**
- ❌ При перезапуске генерируются новые маршруты
- ❌ Участники могут попасть на уже пройденные станции
- 🎯 **Использовать при:** полном перезапуске мероприятия

### Алгоритм распределения:
1. **Равномерное распределение**: Алгоритм Fisher-Yates с балансировкой
2. **Автоматическая корректировка**: Исправление дисбаланса между станциями
3. **Индивидуальные маршруты**: Каждый участник получает уникальную последовательность

### Безопасность:
- Админы задаются через переменную окружения `ADMIN_USERNAMES`
- Проверка прав доступа на каждую административную команду
- Защита от одновременного выполнения критических операций

### Восстановление после сбоев:
- При перезапуске бота автоматически восстанавливается планировщик
- Состояние мероприятия сохраняется в базе данных
- Логирование всех операций для отладки

## 📍 Станции

1. 🦷 **A: Кабинет стоматолога**
2. 💼 **B: Приёмная важного человека**
3. 📚 **C: Стол экзаменатора**
4. 🔬 **D: Лаборатория**
5. 💻 **E: Компьютерный класс**
6. 🏥 **F: Операционная**
7. 🍽️ **G: Буфет**
8. 📊 **H: Постерная сессия**
9. 🔬 **I: За микроскопом**

## 🔧 Структура проекта

```
├── bot.js          # Главный файл бота
├── database.js     # Работа с Supabase
├── stations.js     # Информация о станциях
├── scheduler.js    # Автоматическое расписание
├── utils.js        # Вспомогательные функции
├── package.json    # Зависимости
└── README.md       # Документация
```

## 🚀 Деплой на Railway

1. Создайте аккаунт на [Railway](https://railway.app)
2. Создайте новый проект
3. Подключите GitHub репозиторий
4. Добавьте переменные окружения
5. Деплой произойдет автоматически

## ⚠️ Важные моменты

- Бот рассчитан на ~150 участников
- Мероприятие длится 72 минуты (9 станций × 8 минут)
- Каждый участник проходит все 9 станций в уникальной последовательности
- Распределение происходит равномерно (≈16-17 человек на станцию)

## 🐛 Решение проблем

### Бот не запускается
- Проверьте правильность токена в `.env`
- Убедитесь, что установлены все зависимости

### Ошибки с базой данных
- Проверьте подключение к Supabase
- Убедитесь, что созданы все таблицы

### Участники не получают уведомления
- Проверьте, что мероприятие запущено (`/status`)
- Убедитесь, что участники не заблокировали бота

## 📞 Поддержка

При возникновении проблем обращайтесь к администраторам мероприятия. 