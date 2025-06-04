# 🤖 Simple Team Distribution Bot

Простой Telegram бот для распределения участников по командам на мероприятии Sechenov Pro Network.

## 🎯 Основной функционал

### Для участников:
1. **Регистрация** через `/start`
2. **Ответы на 3 вопроса:**
   - Опишите 3 свои сильные черты
   - Опишите свой опыт научной работы одним предложением  
   - Опишите свои научные интересы (от 1 до 3 тезисов)
3. **Ожидание** распределения по командам
4. **Получение номера команды** после распределения

### Для администраторов:
1. **`/distribute`** - запустить распределение участников по командам
2. **`/stats`** - посмотреть статистику участников

## 🏗️ Архитектура

- **База данных:** Supabase (PostgreSQL)
- **Платформа:** Railway 
- **Язык:** Node.js + Telegraf

## 📊 Логика распределения

1. Берутся все участники, прошедшие опрос
2. Перемешиваются случайным образом
3. Распределяются по командам циклично (по 5 человек в команде)
4. Максимум 16 команд
5. Всем отправляются уведомления с номером команды

## 🚀 Команды

### Участники:
- `/start` - регистрация и прохождение опроса

### Администраторы:
- `/distribute` - распределить участников по командам
- `/stats` - статистика участников

## 📋 Переменные окружения

```env
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## 🗃️ Структура базы данных

### Таблица participants:
- `id` - уникальный ID
- `user_id` - Telegram user ID
- `username`, `first_name`, `last_name` - данные пользователя
- `participant_number` - номер участника
- `answer1`, `answer2`, `answer3` - ответы на вопросы
- `survey_completed` - завершен ли опрос
- `team_number` - номер команды (после распределения)

### Таблица admins:
- `username` - имя администратора в Telegram

## 📝 SQL для создания таблиц

```sql
-- Запустите этот SQL в Supabase
-- Упрощенная таблица участников
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  participant_number INTEGER UNIQUE,
  
  -- Ответы на вопросы опроса
  answer1 TEXT, -- сильные черты
  answer2 TEXT, -- опыт научной работы
  answer3 TEXT, -- научные интересы
  
  -- Статус
  survey_completed BOOLEAN DEFAULT FALSE,
  team_number INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица администраторов
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавляем администраторов
INSERT INTO admins (username) VALUES ('lkobets'), ('risharre');
```

## 🔧 Деплой

1. **Создайте проект в Railway**
2. **Подключите GitHub репозиторий**
3. **Добавьте переменные окружения**
4. **Создайте таблицы в Supabase**
5. **Railway автоматически запустит бота**

## 📱 Пример использования

1. Участник: `/start`
2. Бот: "Опишите 3 свои сильные черты:"
3. Участник: отвечает
4. Бот: "Опишите свой опыт..."
5. Участник: отвечает  
6. Бот: "Опишите свои научные интересы..."
7. Участник: отвечает
8. Бот: "Подождите, выбираем вам подходящую команду..."
9. Админ: `/distribute`
10. Всем участникам: "Поздравляем! Номер вашей команды: X"

## ⚡ Быстрый старт

```bash
npm install
npm start
```

Простой и эффективный бот для командного распределения! 🎉 