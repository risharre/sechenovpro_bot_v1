const { Telegraf } = require('telegraf');
const { session } = require('telegraf');
require('dotenv').config();

// Импорт модулей
const { 
  participants, 
  rotations, 
  eventState, 
  admins,
  createTablesSQL 
} = require('./database');

const { 
  stations, 
  networkingDescription,
  CYCLE_TIME 
} = require('./stations');

const {
  distributeParticipants,
  createParticipantMenu,
  createAdminMenu,
  getStationInfo,
  getTimeUntilNextRotation,
  escapeMarkdown,
  createStationMessage,
  createScheduleMessage
} = require('./utils');

const EventScheduler = require('./scheduler');

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);
const scheduler = new EventScheduler(bot);

// Middleware для сессий
bot.use(session());

// Инициализация базы данных
async function initDatabase() {
  try {
    await eventState.init();
    console.log('Database initialized');
    console.log('\nSQL для создания таблиц в Supabase:');
    console.log(createTablesSQL);
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Команда /start
bot.command('start', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || '';
    const firstName = ctx.from.first_name || '';
    const lastName = ctx.from.last_name || '';

    // Проверяем, является ли пользователь админом
    const isAdmin = await admins.isAdmin(username);

    // Проверяем, зарегистрирован ли участник
    let participant = await participants.getByUserId(userId);

    if (!participant) {
      // Регистрируем нового участника
      participant = await participants.register(userId, username, firstName, lastName);
      
      // Приветственное сообщение для нового участника
      let welcomeMessage = `🎉 *Добро пожаловать на Sechenov Pro Network!*\n\n`;
      welcomeMessage += `${escapeMarkdown(networkingDescription)}\n\n`;
      welcomeMessage += `✅ Вы успешно зарегистрированы!\n`;
      welcomeMessage += `📋 Ваш номер участника: *${participant.participant_number}*\n\n`;
      welcomeMessage += `📝 Заполните форму с дополнительной информацией:\n`;
      welcomeMessage += process.env.CV_FORM_URL || 'https://forms.yandex.ru/cloud/67d6fd5090fa7be3dc213e5f/';
      welcomeMessage += `\n\n⏳ Ожидайте начала мероприятия. Вам придет уведомление о вашей первой станции.`;

      await ctx.replyWithMarkdown(welcomeMessage, {
        disable_web_page_preview: true,
        reply_markup: createParticipantMenu()
      });
    } else {
      // Участник уже зарегистрирован
      let message = `👋 *С возвращением!*\n\n`;
      message += `📋 Ваш номер участника: *${participant.participant_number}*\n\n`;
      
      // Проверяем, началось ли мероприятие
      const state = await eventState.get();
      if (state && state.event_started) {
        message += `✅ Мероприятие уже началось!\n`;
        message += `Используйте меню ниже для навигации.`;
      } else {
        message += `⏳ Мероприятие еще не началось.\n`;
        message += `Ожидайте уведомления о начале.`;
      }

      await ctx.replyWithMarkdown(message, {
        reply_markup: createParticipantMenu()
      });
    }

    // Если это админ, показываем админское меню
    if (isAdmin) {
      await ctx.replyWithMarkdown(
        `👨‍💼 *Админ-панель*\n\nВы имеете доступ к управлению мероприятием.`,
        { reply_markup: createAdminMenu() }
      );
    }

  } catch (error) {
    console.error('Error in /start command:', error);
    await ctx.reply('❌ Произошла ошибка при регистрации. Попробуйте позже.');
  }
});

// Команда /start_event (для админов)
bot.command('start_event', async (ctx) => {
  try {
    const username = ctx.from.username || '';
    const isAdmin = await admins.isAdmin(username);

    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    // Проверяем текущее состояние
    const state = await eventState.get();
    if (state && state.event_started) {
      await ctx.reply('⚠️ Мероприятие уже запущено!');
      return;
    }

    // Получаем всех участников
    const allParticipants = await participants.getAll();
    if (allParticipants.length === 0) {
      await ctx.reply('❌ Нет зарегистрированных участников!');
      return;
    }

    await ctx.reply(`🚀 Запускаю мероприятие...\n\n📊 Участников: ${allParticipants.length}`);

    // Очищаем старые ротации
    await rotations.deleteAll();

    // Генерируем распределение
    const distributions = distributeParticipants(allParticipants.length);

    // Сохраняем ротации для каждого участника
    for (let i = 0; i < allParticipants.length; i++) {
      const participant = allParticipants[i];
      const stationSequence = distributions[i];
      await rotations.createForParticipant(participant.id, stationSequence);
    }

    // Запускаем мероприятие
    await eventState.start();

    // Отправляем первые уведомления
    await scheduler.sendInitialNotifications();

    // Запускаем планировщик
    await scheduler.start();

    await ctx.reply(`✅ Мероприятие успешно запущено!\n\n🔄 Автоматическая ротация каждые ${CYCLE_TIME} минут.`);

  } catch (error) {
    console.error('Error in /start_event command:', error);
    await ctx.reply('❌ Произошла ошибка при запуске мероприятия.');
  }
});

// Команда /stop_event (для админов)
bot.command('stop_event', async (ctx) => {
  try {
    const username = ctx.from.username || '';
    const isAdmin = await admins.isAdmin(username);

    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    // Останавливаем мероприятие
    await eventState.stop();
    scheduler.stop();

    await ctx.reply('⏹️ Мероприятие остановлено.');

  } catch (error) {
    console.error('Error in /stop_event command:', error);
    await ctx.reply('❌ Произошла ошибка при остановке мероприятия.');
  }
});

// Команда /status (для админов)
bot.command('status', async (ctx) => {
  try {
    const username = ctx.from.username || '';
    const isAdmin = await admins.isAdmin(username);

    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    const state = await eventState.get();
    const participantCount = await participants.getCount();

    let message = `📊 *Статус мероприятия*\n\n`;
    message += `👥 Участников: ${participantCount}\n`;
    
    if (state && state.event_started) {
      message += `✅ Статус: Активно\n`;
      message += `🔄 Текущая ротация: ${state.current_rotation} из ${stations.length}\n`;
      
      const timeRemaining = getTimeUntilNextRotation(state.last_rotation_time, CYCLE_TIME);
      message += `⏱️ До следующей ротации: ${timeRemaining.formatted}\n`;
    } else {
      message += `⏸️ Статус: Не запущено`;
    }

    await ctx.replyWithMarkdown(message);

  } catch (error) {
    console.error('Error in /status command:', error);
    await ctx.reply('❌ Произошла ошибка при получении статуса.');
  }
});

// Обработчик callback queries
bot.on('callback_query', async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    const username = ctx.from.username || '';

    // Подтверждаем получение callback
    await ctx.answerCbQuery();

    // Получаем данные участника
    const participant = await participants.getByUserId(userId);
    
    if (!participant && !data.startsWith('admin_')) {
      await ctx.reply('❌ Вы не зарегистрированы! Используйте /start');
      return;
    }

    // Получаем состояние мероприятия
    const state = await eventState.get();
    const eventStarted = state && state.event_started;

    switch (data) {
      case 'current_station':
        if (!eventStarted) {
          await ctx.reply('⏳ Мероприятие еще не началось.');
          break;
        }

        const currentStationId = await rotations.getCurrentStation(participant.id, state.current_rotation);
        if (currentStationId) {
          const station = getStationInfo(currentStationId);
          const timeRemaining = getTimeUntilNextRotation(state.last_rotation_time, CYCLE_TIME);
          const message = createStationMessage(station, state.current_rotation, stations.length, timeRemaining);
          await ctx.replyWithMarkdown(message);
        } else {
          await ctx.reply('❌ Не удалось получить информацию о текущей станции.');
        }
        break;

      case 'next_station':
        if (!eventStarted) {
          await ctx.reply('⏳ Мероприятие еще не началось.');
          break;
        }

        const nextRotation = state.current_rotation + 1;
        if (nextRotation > stations.length) {
          await ctx.reply('🏁 Это последняя станция! Мероприятие скоро завершится.');
          break;
        }

        const nextStationId = await rotations.getCurrentStation(participant.id, nextRotation);
        if (nextStationId) {
          const station = getStationInfo(nextStationId);
          let message = `⏭️ *Следующая станция*\n\n`;
          message += `${station.emoji} *${escapeMarkdown(station.name)}*\n\n`;
          message += `_${escapeMarkdown(station.shortTitle)}_`;
          await ctx.replyWithMarkdown(message);
        }
        break;

      case 'my_schedule':
        const participantRotations = await rotations.getByParticipantId(participant.id);
        if (participantRotations.length > 0) {
          const currentRotation = eventStarted ? state.current_rotation : 0;
          const message = createScheduleMessage(participant.participant_number, participantRotations, currentRotation);
          await ctx.replyWithMarkdown(message);
        } else {
          await ctx.reply('📅 Расписание будет доступно после начала мероприятия.');
        }
        break;

      case 'contact_organizer':
        let contactMessage = `📞 *Контакты организаторов*\n\n`;
        contactMessage += `По всем вопросам обращайтесь к организаторам мероприятия.\n\n`;
        contactMessage += `Также вы можете подойти к любому волонтеру на станции.`;
        await ctx.replyWithMarkdown(contactMessage);
        break;

      case 'my_info':
        let infoMessage = `ℹ️ *Ваша информация*\n\n`;
        infoMessage += `📋 Номер участника: *${participant.participant_number}*\n`;
        infoMessage += `👤 Имя: ${participant.first_name || 'Не указано'}\n`;
        if (participant.username) {
          infoMessage += `🆔 Username: @${participant.username}\n`;
        }
        await ctx.replyWithMarkdown(infoMessage);
        break;

      // Админские действия
      case 'admin_start_event':
        const isAdminStart = await admins.isAdmin(username);
        if (isAdminStart) {
          ctx.callbackQuery.message.text = '/start_event';
          ctx.callbackQuery.message.from = ctx.from;
          await bot.handleUpdate({ message: ctx.callbackQuery.message });
        }
        break;

      case 'admin_stop_event':
        const isAdminStop = await admins.isAdmin(username);
        if (isAdminStop) {
          ctx.callbackQuery.message.text = '/stop_event';
          ctx.callbackQuery.message.from = ctx.from;
          await bot.handleUpdate({ message: ctx.callbackQuery.message });
        }
        break;

      case 'admin_status':
        const isAdminStatus = await admins.isAdmin(username);
        if (isAdminStatus) {
          ctx.callbackQuery.message.text = '/status';
          ctx.callbackQuery.message.from = ctx.from;
          await bot.handleUpdate({ message: ctx.callbackQuery.message });
        }
        break;

      case 'admin_participants':
        const isAdminParticipants = await admins.isAdmin(username);
        if (isAdminParticipants) {
          const allParticipants = await participants.getAll();
          let message = `👥 *Список участников (${allParticipants.length})*\n\n`;
          
          // Показываем первые 20 участников
          const limit = Math.min(20, allParticipants.length);
          for (let i = 0; i < limit; i++) {
            const p = allParticipants[i];
            message += `${p.participant_number}. ${p.first_name || 'Без имени'}`;
            if (p.username) message += ` (@${p.username})`;
            message += '\n';
          }
          
          if (allParticipants.length > 20) {
            message += `\n... и еще ${allParticipants.length - 20} участников`;
          }
          
          await ctx.replyWithMarkdown(message);
        }
        break;
    }

  } catch (error) {
    console.error('Error in callback query handler:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
});

// Запуск бота
async function start() {
  try {
    await initDatabase();
    
    // Восстанавливаем планировщик, если мероприятие было запущено
    const state = await eventState.get();
    if (state && state.event_started) {
      await scheduler.start();
      console.log('Event scheduler restored');
    }
    
    await bot.launch();
    console.log('Bot started successfully');
  } catch (error) {
    console.error('Error starting bot:', error);
    process.exit(1);
  }
}

// Graceful stop
process.once('SIGINT', () => {
  scheduler.stop();
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  scheduler.stop();
  bot.stop('SIGTERM');
});

// Запускаем бота
start(); 