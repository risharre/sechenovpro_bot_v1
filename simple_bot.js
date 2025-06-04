const { Telegraf } = require('telegraf');
const { session } = require('telegraf');
require('dotenv').config();

// Импорт только базовых модулей базы данных
const { 
  participants, 
  admins,
  testConnection,
  createTablesSQL 
} = require('./simple_database');

// Используем новую переменную токена
const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
console.log(`🔄 Using bot token from: ${process.env.TELEGRAM_BOT_TOKEN ? 'TELEGRAM_BOT_TOKEN' : 'BOT_TOKEN'}`);

const bot = new Telegraf(botToken);

// Middleware для сессий
bot.use(session());

// Состояния для опроса
const STATES = {
  WAITING_FOR_STRENGTH: 'waiting_for_strength',
  WAITING_FOR_EXPERIENCE: 'waiting_for_experience', 
  WAITING_FOR_INTERESTS: 'waiting_for_interests',
  COMPLETED: 'completed'
};

// Инициализация базы данных
async function initDatabase() {
  try {
    console.log('🔄 Initializing simple database...');
    await testConnection();
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Команда /start
bot.command('start', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || '';
    const firstName = ctx.from.first_name || '';
    const lastName = ctx.from.last_name || '';

    // Проверяем, зарегистрирован ли участник
    let participant = await participants.getByUserId(userId);

    if (!participant) {
      // Регистрируем нового участника
      participant = await participants.register(userId, username, firstName, lastName);
      
      // Начинаем опрос
      ctx.session = { state: STATES.WAITING_FOR_STRENGTH, participantId: participant.id };
      
      await ctx.reply(
        `🎉 Добро пожаловать!\n\n` +
        `📋 Ваш номер участника: ${participant.participant_number}\n\n` +
        `Пожалуйста, ответьте на несколько вопросов:\n\n` +
        `1️⃣ Опишите 3 свои сильные черты:`
      );
    } else {
      // Участник уже зарегистрирован
      if (participant.team_number) {
        await ctx.reply(
          `👋 С возвращением!\n\n` +
          `📋 Ваш номер участника: ${participant.participant_number}\n` +
          `👥 Ваша команда: ${participant.team_number}`
        );
      } else if (participant.survey_completed) {
        await ctx.reply(
          `👋 С возвращением!\n\n` +
          `📋 Ваш номер участника: ${participant.participant_number}\n` +
          `⏳ Ожидайте распределения по командам...`
        );
      } else {
        // Продолжаем опрос
        ctx.session = { state: STATES.WAITING_FOR_STRENGTH, participantId: participant.id };
        await ctx.reply(`1️⃣ Опишите 3 свои сильные черты:`);
      }
    }

  } catch (error) {
    console.error('Error in /start command:', error);
    await ctx.reply('❌ Произошла ошибка при регистрации. Попробуйте позже.');
  }
});

// Команда распределения для админов
bot.command('distribute', async (ctx) => {
  try {
    const username = ctx.from.username || '';
    const isAdmin = await admins.isAdmin(username);

    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    // Получаем всех участников, которые прошли опрос
    const completedParticipants = await participants.getCompleted();
    
    if (completedParticipants.length === 0) {
      await ctx.reply('❌ Нет участников, прошедших опрос!');
      return;
    }

    await ctx.reply(`🚀 Начинаю распределение...\n\n📊 Участников: ${completedParticipants.length}`);

    // Перемешиваем участников случайным образом
    const shuffled = completedParticipants.sort(() => Math.random() - 0.5);
    
    // Распределяем по командам (строго не более 5 человек в команде)
    const maxTeamSize = 5;
    const teamsCount = Math.ceil(shuffled.length / maxTeamSize);
    
    let teamAssignments = [];
    let currentTeam = 1;
    let currentTeamSize = 0;

    for (let i = 0; i < shuffled.length; i++) {
      // Если текущая команда заполнена (5 человек) и это не последняя команда
      if (currentTeamSize >= maxTeamSize && currentTeam < teamsCount) {
        currentTeam++;
        currentTeamSize = 0;
      }
      
      teamAssignments.push({
        participantId: shuffled[i].id,
        teamNumber: currentTeam
      });
      
      currentTeamSize++;
    }
    
    // Сохраняем распределение в базу
    for (const assignment of teamAssignments) {
      await participants.assignTeam(assignment.participantId, assignment.teamNumber);
    }

    // Отправляем уведомления участникам
    let notificationsSent = 0;
    for (const assignment of teamAssignments) {
      try {
        const participant = shuffled.find(p => p.id === assignment.participantId);
        await bot.telegram.sendMessage(
          participant.user_id,
          `🎉 Поздравляем!\n\n👥 Номер вашей команды: ${assignment.teamNumber}\n\nУдачи в командной работе!`
        );
        notificationsSent++;
      } catch (error) {
        console.error(`Failed to notify participant ${assignment.participantId}:`, error);
      }
    }

    // Статистика распределения
    const teamStats = {};
    teamAssignments.forEach(a => {
      teamStats[a.teamNumber] = (teamStats[a.teamNumber] || 0) + 1;
    });

    let statsMessage = `✅ Распределение завершено!\n\n📊 Статистика:\n`;
    statsMessage += `• Всего участников: ${shuffled.length}\n`;
    statsMessage += `• Команд создано: ${currentTeam}\n`;
    statsMessage += `• Участников распределено: ${teamAssignments.length}\n`;
    statsMessage += `• Уведомлений отправлено: ${notificationsSent}\n\n`;
    statsMessage += `👥 Состав команд:\n`;
    
    for (let i = 1; i <= currentTeam; i++) {
      statsMessage += `Команда ${i}: ${teamStats[i] || 0} чел.\n`;
    }

    await ctx.reply(statsMessage);

  } catch (error) {
    console.error('Error in /distribute command:', error);
    await ctx.reply('❌ Произошла ошибка при распределении.');
  }
});

// Команда статистики для админов
bot.command('stats', async (ctx) => {
  try {
    const username = ctx.from.username || '';
    const isAdmin = await admins.isAdmin(username);

    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    const totalParticipants = await participants.getCount();
    const completedParticipants = await participants.getCompleted();
    const distributedParticipants = await participants.getDistributed();

    let message = `📊 Статистика участников:\n\n`;
    message += `👥 Всего зарегистрировано: ${totalParticipants}\n`;
    message += `✅ Прошли опрос: ${completedParticipants.length}\n`;
    message += `🎯 Распределены по командам: ${distributedParticipants.length}\n`;
    message += `⏳ Ожидают распределения: ${completedParticipants.length - distributedParticipants.length}`;

    await ctx.reply(message);

  } catch (error) {
    console.error('Error in /stats command:', error);
    await ctx.reply('❌ Произошла ошибка при получении статистики.');
  }
});

// Обработка текстовых сообщений (ответы на вопросы)
bot.on('text', async (ctx) => {
  try {
    if (!ctx.session || !ctx.session.state) {
      return;
    }

    const userId = ctx.from.id;
    const answer = ctx.message.text;
    const participantId = ctx.session.participantId;

    switch (ctx.session.state) {
      case STATES.WAITING_FOR_STRENGTH:
        // Сохраняем ответ на первый вопрос
        await participants.updateAnswer1(participantId, answer);
        
        ctx.session.state = STATES.WAITING_FOR_EXPERIENCE;
        await ctx.reply(`✅ Спасибо!\n\n2️⃣ Опишите свой опыт научной работы одним предложением:`);
        break;

      case STATES.WAITING_FOR_EXPERIENCE:
        // Сохраняем ответ на второй вопрос
        await participants.updateAnswer2(participantId, answer);
        
        ctx.session.state = STATES.WAITING_FOR_INTERESTS;
        await ctx.reply(`✅ Отлично!\n\n3️⃣ Опишите свои научные интересы (от 1 до 3 тезисов):`);
        break;

      case STATES.WAITING_FOR_INTERESTS:
        // Сохраняем ответ на третий вопрос
        await participants.updateAnswer3(participantId, answer);
        await participants.markSurveyCompleted(participantId);
        
        ctx.session.state = STATES.COMPLETED;
        await ctx.reply(
          `✅ Спасибо за ответы!\n\n` +
          `⏳ Подождите, выбираем вам подходящую команду...\n\n` +
          `Вы получите уведомление, когда распределение будет завершено.`
        );
        break;
    }

  } catch (error) {
    console.error('Error processing text message:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
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
    
    await bot.launch();
    console.log('✅ Simple bot started successfully');
  } catch (error) {
    console.error('❌ Error starting bot:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start(); 