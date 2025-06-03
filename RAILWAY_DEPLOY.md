# 🚀 Деплой на Railway

## 📋 Пошаговая инструкция

### 1. Подготовка аккаунта Railway

1. Перейдите на [Railway.app](https://railway.app)
2. Зарегистрируйтесь через GitHub (рекомендуется)
3. Подтвердите email

### 2. Создание проекта

1. В Railway dashboard нажмите **"New Project"**
2. Выберите **"Deploy from GitHub repo"**
3. Выберите репозиторий `sechenovpro_bot_v1`
4. Railway автоматически обнаружит Node.js проект

### 3. Настройка переменных окружения

В разделе **Variables** добавьте:

```bash
BOT_TOKEN=7450494077:AAF2v6iWkOsVUSAxW2KEJ6sNc3rn0tROyXI
ADMIN_USERNAMES=lkobets,risharre
SUPABASE_URL=ваш_supabase_url
SUPABASE_KEY=ваш_supabase_key
CV_FORM_URL=https://forms.yandex.ru/cloud/67d6fd5090fa7be3dc213e5f/
NODE_ENV=production
```

### 4. Деплой

1. Railway автоматически начнет деплой после добавления переменных
2. Следите за логами в разделе **Deployments**
3. Деплой займет 2-3 минуты

### 5. Проверка работы

После успешного деплоя:
1. Бот будет работать 24/7
2. Автоматические перезапуски при ошибках
3. Логи доступны в Railway dashboard

## 🎯 Особенности Railway деплоя

### Автоматические функции:
- ✅ **Автодеплой** при пуше в GitHub
- ✅ **Автоперезапуск** при ошибках (до 10 раз)
- ✅ **Мониторинг** и логи в реальном времени
- ✅ **Масштабирование** при необходимости

### Конфигурация:
- **Команда запуска:** `npm start` (из package.json)
- **Node.js версия:** 16+ (автоопределение)
- **Память:** 512MB (достаточно для бота)
- **Перезапуски:** Автоматически при сбоях

## 📊 Мониторинг

### В Railway Dashboard доступно:
- 📈 **Метрики использования** CPU и памяти
- 📋 **Логи приложения** в реальном времени
- 🔄 **История деплоев** и роллбеки
- ⚡ **Статус сервиса** и время работы

### Полезные команды для мониторинга:
```bash
# Просмотр логов (в Railway CLI)
railway logs

# Перезапуск сервиса
railway restart

# Статус сервиса
railway status
```

## 🛠️ Troubleshooting

### Если деплой не работает:

1. **Проверьте переменные окружения** - все должны быть заполнены
2. **Проверьте логи** в разделе Deployments
3. **Убедитесь что Supabase доступен** из Railway
4. **Проверьте токен бота** - должен быть валидным

### Типичные ошибки:

❌ **"BOT_TOKEN is not defined"**  
✅ Добавьте переменную BOT_TOKEN в Railway

❌ **"Cannot connect to Supabase"**  
✅ Проверьте SUPABASE_URL и SUPABASE_KEY

❌ **"Module not found"**  
✅ Убедитесь что package.json корректный

## 🚀 После успешного деплоя

### Ваш бот будет:
- 🟢 **Работать 24/7** без перерывов
- 🔄 **Автоматически обновляться** при пуше в GitHub
- 📊 **Обрабатывать 150+ участников** одновременно
- ⚡ **Быстро отвечать** на команды (< 100ms)

### Готов к продакшену:
- ✅ Функционал паузы с сохранением прогресса
- ✅ Максимальное смешивание участников (63.6%)
- ✅ Автоматические ротации каждые 8 минут
- ✅ Админская панель с полным контролем

**Бот готов для реального мероприятия на 150 участников! 🎉**

## Quick Fix for Current Error

**Error:** `supabaseUrl is required.`

**Solution:** Set environment variables in Railway dashboard:

1. Go to your Railway project: https://railway.app/dashboard
2. Click on your project
3. Go to **Variables** tab
4. Add these variables one by one:

```
BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
ADMIN_USERNAMES=your_telegram_username
NODE_ENV=production
CV_FORM_URL=https://forms.yandex.ru/cloud/67d6fd5090fa7be3dc213e5f/
```

4. Click **Deploy** after adding all variables

## Getting Your Values

### BOT_TOKEN
- Go to [@BotFather](https://t.me/BotFather) on Telegram
- Use `/mybots` → Select your bot → **API Token**

### SUPABASE_URL and SUPABASE_KEY
- Go to [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project
- Go to **Settings** → **API**
- Copy **Project URL** (SUPABASE_URL)
- Copy **anon public** key (SUPABASE_KEY)

### ADMIN_USERNAMES
- Your Telegram username (without @)
- Multiple admins: `username1,username2,username3`

## Complete Deployment Steps

### 1. Prepare Repository
```bash
git add .
git commit -m "Production deployment ready"
git push origin main
```

### 2. Create Railway Project
1. Go to [Railway](https://railway.app)
2. Click **Deploy from GitHub repo**
3. Select your repository
4. Railway will auto-deploy

### 3. Set Environment Variables
In Railway dashboard → Variables tab:
- `BOT_TOKEN`: Your Telegram bot token
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase anon key
- `ADMIN_USERNAMES`: Your Telegram username
- `NODE_ENV`: `production`
- `CV_FORM_URL`: Form URL (optional)

### 4. Database Setup (Critical!)
**Before first deployment**, run this SQL in Supabase:

```sql
-- Add missing columns to event_state table
ALTER TABLE event_state ADD COLUMN IF NOT EXISTS event_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE event_state ADD COLUMN IF NOT EXISTS pause_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE event_state ADD COLUMN IF NOT EXISTS total_pause_duration INTEGER DEFAULT 0;
ALTER TABLE event_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

### 5. Verify Deployment
1. Check Railway logs for successful startup
2. Test bot with `/start` command
3. Test admin commands if you're an admin

## Production Features

✅ **Auto-restart** on crashes (up to 10 times)  
✅ **Graceful shutdown** handling  
✅ **Health monitoring** endpoint  
✅ **Error logging** without crashes  
✅ **Database connection** validation  
✅ **Schema validation** on startup  

## Monitoring

- **Health endpoint**: `https://your-app.railway.app/health`
- **Railway logs**: Available in dashboard
- **Bot status**: Use `/status` command as admin

## Troubleshooting

### Bot not responding
1. Check Railway logs for errors
2. Verify all environment variables are set
3. Test database connection in Supabase

### Database errors
1. Ensure you've run the UPDATE_DATABASE.sql script
2. Check Supabase project is active
3. Verify SUPABASE_URL and SUPABASE_KEY

### Memory issues
- Railway free tier: 512MB RAM limit
- Bot optimized for 150+ participants
- Monitor memory usage in logs

## Cost Estimate

**Railway Free Tier:**
- $0/month for hobby projects
- 512MB RAM, 1GB disk
- Sufficient for networking events

**Paid Plan (if needed):**
- $5/month for more resources
- 8GB RAM, faster deployment

## Support

For deployment issues:
1. Check Railway dashboard logs
2. Verify environment variables
3. Test database connectivity
4. Review error messages in bot logs 