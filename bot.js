const { Telegraf } = require('telegraf');
const { session } = require('telegraf');
require('dotenv').config();

// Импорт модулей
const { 
  participants, 
  rotations, 
  eventState, 
  admins,
  testConnection,
  validateSchema,
  createTablesSQL 
} = require('./database');

const { 
  stations, 
  networkingDescription,
  CYCLE_TIME 
} = require('./stations');

const {
  distributeParticipants,
  analyzeParticipantMixing,
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
    console.log('🔄 Initializing database...');
    
    // Проверяем подключение
    await testConnection();
    
    // Проверяем схему
    await validateSchema();
    
    // Инициализируем состояние
    await eventState.init();
    
    console.log('✅ Database initialized successfully');
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('\nSQL для создания таблиц в Supabase:');
      console.log(createTablesSQL);
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    
    if (process.env.NODE_ENV === 'production') {
      // В продакшене не запускаем бота если база недоступна
      throw error;
    } else {
      // В разработке показываем инструкции
      console.log('\n🛠️ To fix this, run the following SQL in Supabase:');
      console.log(createTablesSQL);
      throw error;
    }
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
      welcomeMessage += `${networkingDescription}\n\n`;
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
      const currentState = await eventState.get();
      await ctx.replyWithMarkdown(
        `👨‍💼 *Админ-панель*\n\nВы имеете доступ к управлению мероприятием.`,
        { reply_markup: createAdminMenu(currentState) }
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

    console.log('🔍 Starting event via command...');

    // Проверяем текущее состояние
    console.log('🔍 Checking current state...');
    const state = await eventState.get();
    if (state && state.event_started) {
      await ctx.reply('⚠️ Мероприятие уже запущено!');
      return;
    }

    // Получаем всех участников
    console.log('🔍 Getting all participants...');
    const allParticipants = await participants.getAll();
    console.log(`🔍 Found ${allParticipants.length} participants`);
    if (allParticipants.length === 0) {
      await ctx.reply('❌ Нет зарегистрированных участников!');
      return;
    }

    await ctx.reply(`🚀 Запускаю мероприятие...\n\n📊 Участников: ${allParticipants.length}`);

    // Очищаем старые ротации
    console.log('🔍 Deleting old rotations...');
    await rotations.deleteAll();

    // Генерируем распределение
    console.log('🔍 Generating participant distribution...');
    const distributions = distributeParticipants(allParticipants.length);
    console.log('🔍 Distribution generated successfully');

    // Сохраняем ротации для каждого участника
    console.log('🔍 Saving rotations for each participant...');
    for (let i = 0; i < allParticipants.length; i++) {
      const participant = allParticipants[i];
      const stationSequence = distributions[i];
      console.log(`🔍 Saving rotations for participant ${i + 1}/${allParticipants.length} (ID: ${participant.id})`);
      await rotations.createForParticipant(participant.id, stationSequence);
    }
    console.log('🔍 All rotations saved successfully');

    // Запускаем мероприятие
    console.log('🔍 Starting event state...');
    await eventState.start();

    // Отправляем первые уведомления
    console.log('🔍 Sending initial notifications...');
    await scheduler.sendInitialNotifications();

    // Запускаем планировщик
    console.log('🔍 Starting scheduler...');
    await scheduler.start();

    console.log('🔍 Event started successfully!');
    await ctx.reply(`✅ Мероприятие успешно запущено!\n\n🔄 Автоматическая ротация каждые ${CYCLE_TIME} минут.`);
    
    // Показываем обновленное админское меню
    const updatedState = await eventState.get();
    await ctx.replyWithMarkdown(
      `👨‍�� *Админ-панель*\n\n✅ Мероприятие активно`,
      { reply_markup: createAdminMenu(updatedState) }
    );

  } catch (error) {
    console.error('❌ Error in /start_event command:', error);
    console.error('Error stack:', error.stack);
    await ctx.reply(`❌ Произошла ошибка при запуске мероприятия: ${error.message}`);
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

    await ctx.reply('⏹️ Мероприятие остановлено.\n\n⚠️ При перезапуске участники получат новые маршруты.');

  } catch (error) {
    console.error('Error in /stop_event command:', error);
    await ctx.reply('❌ Произошла ошибка при остановке мероприятия.');
  }
});

// Команда /pause_event (для админов)
bot.command('pause_event', async (ctx) => {
  try {
    const username = ctx.from.username || '';
    const isAdmin = await admins.isAdmin(username);

    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    const state = await eventState.get();
    if (!state || !state.event_started) {
      await ctx.reply('⚠️ Мероприятие не запущено!');
      return;
    }

    if (state.event_paused) {
      await ctx.reply('⚠️ Мероприятие уже приостановлено!');
      return;
    }

    // Приостанавливаем мероприятие
    await eventState.pause();
    scheduler.pause();

    await ctx.reply('⏸️ Мероприятие приостановлено.\n\n💡 Прогресс участников сохранен. Используйте /resume_event для продолжения.');

  } catch (error) {
    console.error('Error in /pause_event command:', error);
    await ctx.reply('❌ Произошла ошибка при приостановке мероприятия.');
  }
});

// Команда /resume_event (для админов)
bot.command('resume_event', async (ctx) => {
  try {
    const username = ctx.from.username || '';
    const isAdmin = await admins.isAdmin(username);

    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    const state = await eventState.get();
    if (!state || !state.event_started) {
      await ctx.reply('⚠️ Мероприятие не запущено!');
      return;
    }

    if (!state.event_paused) {
      await ctx.reply('⚠️ Мероприятие не приостановлено!');
      return;
    }

    // Возобновляем мероприятие
    await eventState.resume();
    await scheduler.resume();

    const pauseDuration = Math.floor((state.total_pause_duration || 0) / 60);
    await ctx.reply(`▶️ Мероприятие возобновлено!\n\n⏱️ Общее время паузы: ${pauseDuration} мин.\n🔄 Автоматическая ротация продолжается.`);

  } catch (error) {
    console.error('Error in /resume_event command:', error);
    await ctx.reply('❌ Произошла ошибка при возобновлении мероприятия.');
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

// Команда /analyze_mixing (для админов)
bot.command('analyze_mixing', async (ctx) => {
  try {
    const username = ctx.from.username || '';
    const isAdmin = await admins.isAdmin(username);

    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    const allParticipants = await participants.getAll();
    if (allParticipants.length === 0) {
      await ctx.reply('❌ Нет зарегистрированных участников!');
      return;
    }

    // Генерируем тестовое распределение
    const distributions = distributeParticipants(allParticipants.length);
    const analysis = analyzeParticipantMixing(distributions);

    let message = `📊 *Анализ качества смешивания*\n\n`;
    message += `👥 Участников: ${allParticipants.length}\n`;
    message += `🔄 Ротаций: ${stations.length}\n\n`;
    message += `📈 *Статистика встреч:*\n`;
    message += `• Всего возможных пар: ${analysis.totalPairs}\n`;
    message += `• Пар, которые встретятся: ${analysis.pairsWhoMet}\n`;
    message += `• Пар, которые никогда не встретятся: ${analysis.pairsWhoNeverMet}\n\n`;
    message += `🎯 *Качество смешивания:*\n`;
    message += `• Максимум встреч одной пары: ${analysis.maxMeetingsPerPair}\n`;
    message += `• Среднее встреч на пару: ${analysis.avgMeetingsPerPair}\n`;
    message += `• Процент знакомств: ${analysis.mixingQuality}%\n\n`;
    
    if (analysis.mixingQuality >= 80) {
      message += `✅ Отличное смешивание!`;
    } else if (analysis.mixingQuality >= 60) {
      message += `⚠️ Хорошее смешивание.`;
    } else {
      message += `❌ Плохое смешивание.`;
    }

    await ctx.replyWithMarkdown(message);

  } catch (error) {
    console.error('Error in /analyze_mixing command:', error);
    await ctx.reply('❌ Произошла ошибка при анализе смешивания.');
  }
});

// Команда /admin_menu (для админов) - быстрый доступ к админской панели
bot.command('admin_menu', async (ctx) => {
  try {
    const username = ctx.from.username || '';
    const isAdmin = await admins.isAdmin(username);

    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    const currentState = await eventState.get();
    const participantCount = await participants.getCount();
    
    let statusText = '';
    if (currentState && currentState.event_started) {
      if (currentState.event_paused) {
        statusText = '⏸️ Мероприятие приостановлено';
      } else {
        statusText = '✅ Мероприятие активно';
      }
    } else {
      statusText = '⏸️ Мероприятие не запущено';
    }

    await ctx.replyWithMarkdown(
      `👨‍💼 *Админ-панель*\n\n${statusText}\n👥 Участников: ${participantCount}`,
      { reply_markup: createAdminMenu(currentState) }
    );

  } catch (error) {
    console.error('Error in /admin_menu command:', error);
    await ctx.reply('❌ Произошла ошибка при получении админского меню.');
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

        if (state.event_paused) {
          await ctx.reply('⏸️ Мероприятие приостановлено.\n\nОжидайте возобновления от организаторов.');
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

        if (state.event_paused) {
          await ctx.reply('⏸️ Мероприятие приостановлено.\n\nИнформация о следующей станции будет доступна после возобновления.');
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
          message += `${station.emoji} *${station.name}*\n\n`;
          message += `_${station.shortTitle}_`;
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
        if (!isAdminStart) {
          await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
          break;
        }

        try {
          console.log('🔍 Starting event process...');
          
          // Проверяем текущее состояние
          console.log('🔍 Checking current state...');
          const currentState = await eventState.get();
          if (currentState && currentState.event_started) {
            await ctx.reply('⚠️ Мероприятие уже запущено!');
            break;
          }

          // Получаем всех участников
          console.log('🔍 Getting all participants...');
          const allParticipants = await participants.getAll();
          console.log(`🔍 Found ${allParticipants.length} participants`);
          if (allParticipants.length === 0) {
            await ctx.reply('❌ Нет зарегистрированных участников!');
            break;
          }

          await ctx.reply(`🚀 Запускаю мероприятие...\n\n📊 Участников: ${allParticipants.length}`);

          // Очищаем старые ротации
          console.log('🔍 Deleting old rotations...');
          await rotations.deleteAll();

          // Генерируем распределение
          console.log('🔍 Generating participant distribution...');
          const distributions = distributeParticipants(allParticipants.length);
          console.log('🔍 Distribution generated successfully');

          // Сохраняем ротации для каждого участника
          console.log('🔍 Saving rotations for each participant...');
          for (let i = 0; i < allParticipants.length; i++) {
            const participant = allParticipants[i];
            const stationSequence = distributions[i];
            console.log(`🔍 Saving rotations for participant ${i + 1}/${allParticipants.length} (ID: ${participant.id})`);
            await rotations.createForParticipant(participant.id, stationSequence);
          }
          console.log('🔍 All rotations saved successfully');

          // Запускаем мероприятие
          console.log('🔍 Starting event state...');
          await eventState.start();

          // Отправляем первые уведомления
          console.log('🔍 Sending initial notifications...');
          await scheduler.sendInitialNotifications();

          // Запускаем планировщик
          console.log('🔍 Starting scheduler...');
          await scheduler.start();

          console.log('🔍 Event started successfully!');
          await ctx.reply(`✅ Мероприятие успешно запущено!\n\n🔄 Автоматическая ротация каждые ${CYCLE_TIME} минут.`);
          
          // Показываем обновленное админское меню
          const updatedState = await eventState.get();
          await ctx.replyWithMarkdown(
            `👨‍💼 *Админ-панель*\n\n✅ Мероприятие активно`,
            { reply_markup: createAdminMenu(updatedState) }
          );
        } catch (error) {
          console.error('❌ Error in admin_start_event callback:', error);
          console.error('Error stack:', error.stack);
          await ctx.reply(`❌ Произошла ошибка при запуске мероприятия: ${error.message}`);
        }
        break;

      case 'admin_pause_event':
        const isAdminPause = await admins.isAdmin(username);
        if (!isAdminPause) {
          await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
          break;
        }

        try {
          const currentState = await eventState.get();
          if (!currentState || !currentState.event_started) {
            await ctx.reply('⚠️ Мероприятие не запущено!');
            break;
          }

          if (currentState.event_paused) {
            await ctx.reply('⚠️ Мероприятие уже приостановлено!');
            break;
          }

          // Приостанавливаем мероприятие
          await eventState.pause();
          scheduler.pause();

          await ctx.reply('⏸️ Мероприятие приостановлено.\n\n💡 Прогресс участников сохранен. Используйте "Возобновить" для продолжения.');
          
          // Показываем обновленное админское меню
          const updatedState = await eventState.get();
          await ctx.replyWithMarkdown(
            `👨‍💼 *Админ-панель*\n\n⏸️ Мероприятие приостановлено`,
            { reply_markup: createAdminMenu(updatedState) }
          );
        } catch (error) {
          console.error('Error in admin_pause_event callback:', error);
          await ctx.reply('❌ Произошла ошибка при приостановке мероприятия.');
        }
        break;

      case 'admin_resume_event':
        const isAdminResume = await admins.isAdmin(username);
        if (!isAdminResume) {
          await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
          break;
        }

        try {
          const currentState = await eventState.get();
          if (!currentState || !currentState.event_started) {
            await ctx.reply('⚠️ Мероприятие не запущено!');
            break;
          }

          if (!currentState.event_paused) {
            await ctx.reply('⚠️ Мероприятие не приостановлено!');
            break;
          }

          // Возобновляем мероприятие
          await eventState.resume();
          await scheduler.resume();

          const pauseDuration = Math.floor((currentState.total_pause_duration || 0) / 60);
          await ctx.reply(`▶️ Мероприятие возобновлено!\n\n⏱️ Общее время паузы: ${pauseDuration} мин.\n🔄 Автоматическая ротация продолжается.`);
          
          // Показываем обновленное админское меню
          const updatedState = await eventState.get();
          await ctx.replyWithMarkdown(
            `👨‍💼 *Админ-панель*\n\n✅ Мероприятие активно`,
            { reply_markup: createAdminMenu(updatedState) }
          );
        } catch (error) {
          console.error('Error in admin_resume_event callback:', error);
          await ctx.reply('❌ Произошла ошибка при возобновлении мероприятия.');
        }
        break;

      case 'admin_stop_event':
        const isAdminStop = await admins.isAdmin(username);
        if (!isAdminStop) {
          await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
          break;
        }

        try {
          // Останавливаем мероприятие
          await eventState.stop();
          scheduler.stop();
          await ctx.reply('⏹️ Мероприятие остановлено.\n\n⚠️ При перезапуске участники получат новые маршруты.');
          
          // Показываем обновленное админское меню
          const updatedState = await eventState.get();
          await ctx.replyWithMarkdown(
            `👨‍💼 *Админ-панель*\n\n⏹️ Мероприятие остановлено`,
            { reply_markup: createAdminMenu(updatedState) }
          );
        } catch (error) {
          console.error('Error in admin_stop_event callback:', error);
          await ctx.reply('❌ Произошла ошибка при остановке мероприятия.');
        }
        break;

      case 'admin_status':
        const isAdminStatus = await admins.isAdmin(username);
        if (!isAdminStatus) {
          await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
          break;
        }

        try {
          const currentState = await eventState.get();
          const participantCount = await participants.getCount();

          let statusMessage = `📊 *Статус мероприятия*\n\n`;
          statusMessage += `👥 Участников: ${participantCount}\n`;
          
          if (currentState && currentState.event_started) {
            if (currentState.event_paused) {
              statusMessage += `⏸️ Статус: Приостановлено\n`;
              const pauseDuration = Math.floor((currentState.total_pause_duration || 0) / 60);
              statusMessage += `⏱️ Время паузы: ${pauseDuration} мин.\n`;
            } else {
              statusMessage += `✅ Статус: Активно\n`;
              const timeRemaining = getTimeUntilNextRotation(currentState.last_rotation_time, CYCLE_TIME);
              statusMessage += `⏱️ До следующей ротации: ${timeRemaining.formatted}\n`;
            }
            statusMessage += `🔄 Текущая ротация: ${currentState.current_rotation} из ${stations.length}\n`;
          } else {
            statusMessage += `⏸️ Статус: Не запущено`;
          }

          await ctx.replyWithMarkdown(statusMessage);
        } catch (error) {
          console.error('Error in admin_status callback:', error);
          await ctx.reply('❌ Произошла ошибка при получении статуса.');
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
  
  // Не крашимся при ошибках базы данных
  if (err.code && err.code.startsWith('PGRST')) {
    console.error('Supabase error:', err.message);
    ctx.reply('⚠️ Временная проблема с базой данных. Попробуйте позже.').catch(() => {});
    return;
  }
  
  // Логируем все остальные ошибки но не крашимся
  console.error('Bot error details:', {
    error: err.message,
    stack: err.stack,
    update: ctx.update
  });
});

// Улучшенная обработка некритичных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Не выходим из процесса, только логируем
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // В продакшене можем попытаться graceful shutdown
  if (process.env.NODE_ENV === 'production') {
    console.log('Attempting graceful shutdown...');
    scheduler.stop();
    bot.stop('Uncaught Exception');
    process.exit(1);
  }
});

// Graceful shutdown signals  
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  scheduler.stop();
  
  bot.stop(signal).then(() => {
    console.log('Bot stopped gracefully');
    process.exit(0);
  }).catch((error) => {
    console.error('Error during shutdown:', error);
    process.exit(1);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('Force exiting...');
    process.exit(1);
  }, 10000);
};

// Graceful stop
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Запускаем бота
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

// Запускаем бота
start(); 