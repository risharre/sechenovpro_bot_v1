const cron = require('node-cron');
const { participants, rotations, eventState } = require('./database');
const { getStationInfo, createStationMessage, getTimeUntilNextRotation } = require('./utils');
const { CYCLE_TIME, TRANSITION_TIME, stations } = require('./stations');

class EventScheduler {
  constructor(bot) {
    this.bot = bot;
    this.rotationJob = null;
    this.warningJob = null;
    this.notificationQueue = [];
    this.isProcessing = false;
  }

  // Запустить планировщик
  async start() {
    console.log('Starting event scheduler...');
    
    // Получаем текущее состояние
    const state = await eventState.get();
    if (!state || !state.event_started) {
      console.log('Event is not started, scheduler will not run');
      return;
    }

    if (state.event_paused) {
      console.log('Event is paused, scheduler will not run');
      return;
    }

    // Запускаем задачи по расписанию
    this.scheduleRotations();
    this.scheduleWarnings();
  }

  // Остановить планировщик
  stop() {
    console.log('Stopping event scheduler...');
    
    if (this.rotationJob) {
      this.rotationJob.stop();
      this.rotationJob = null;
    }
    
    if (this.warningJob) {
      this.warningJob.stop();
      this.warningJob = null;
    }
  }

  // Приостановить планировщик (без потери прогресса)
  pause() {
    console.log('Pausing event scheduler...');
    
    if (this.rotationJob) {
      this.rotationJob.stop();
    }
    
    if (this.warningJob) {
      this.warningJob.stop();
    }
  }

  // Возобновить планировщик
  async resume() {
    console.log('Resuming event scheduler...');
    
    // Проверяем состояние
    const state = await eventState.get();
    if (!state || !state.event_started) {
      console.log('Cannot resume: event not started');
      return;
    }

    if (state.event_paused) {
      console.log('Cannot resume: event still paused in database');
      return;
    }

    // Перезапускаем планировщик
    this.scheduleRotations();
    this.scheduleWarnings();
  }

  // Планировать ротации каждые CYCLE_TIME минут
  scheduleRotations() {
    // Запускаем каждые CYCLE_TIME минут
    const cronExpression = `*/${CYCLE_TIME} * * * *`;
    
    this.rotationJob = cron.schedule(cronExpression, async () => {
      try {
        await this.handleRotation();
      } catch (error) {
        console.error('Error in rotation handler:', error);
        // Не крашим весь процесс, только логируем ошибку
        if (process.env.NODE_ENV === 'production') {
          console.log('Rotation handler error in production, continuing...');
        }
      }
    });

    console.log(`Rotation scheduler started (every ${CYCLE_TIME} minutes)`);
  }

  // Планировать предупреждения за TRANSITION_TIME минут до ротации
  scheduleWarnings() {
    // Запускаем за TRANSITION_TIME минут до каждой ротации
    const warningMinute = CYCLE_TIME - TRANSITION_TIME;
    const cronExpression = `*/${CYCLE_TIME} * * * *`;
    
    // Создаем задачу, которая будет запускаться со смещением
    setTimeout(() => {
      this.warningJob = cron.schedule(cronExpression, async () => {
        try {
          await this.handleWarning();
        } catch (error) {
          console.error('Error in warning handler:', error);
          // Не крашим весь процесс, только логируем ошибку
          if (process.env.NODE_ENV === 'production') {
            console.log('Warning handler error in production, continuing...');
          }
        }
      });
      
      console.log(`Warning scheduler started (${TRANSITION_TIME} minutes before rotation)`);
    }, warningMinute * 60 * 1000);
  }

  // Обработать ротацию
  async handleRotation() {
    const state = await eventState.get();
    if (!state || !state.event_started || state.event_paused) {
      if (state.event_paused) {
        console.log('Rotation skipped: event is paused');
      } else {
        this.stop();
      }
      return;
    }

    const currentRotation = state.current_rotation;
    const nextRotation = currentRotation + 1;

    // Если это была последняя ротация, завершаем мероприятие
    if (currentRotation >= stations.length) {
      await this.handleEventEnd();
      return;
    }

    // Обновляем номер ротации
    await eventState.updateRotation(nextRotation);

    // Отправляем уведомления всем участникам
    await this.notifyAllParticipants(nextRotation, 'rotation');
  }

  // Обработать предупреждение о переходе
  async handleWarning() {
    const state = await eventState.get();
    if (!state || !state.event_started || state.event_paused) {
      return;
    }

    const currentRotation = state.current_rotation;
    const nextRotation = currentRotation + 1;

    // Если следующая ротация будет последней или мы уже на последней
    if (nextRotation > stations.length) {
      return;
    }

    // Отправляем предупреждения всем участникам
    await this.notifyAllParticipants(nextRotation, 'warning');
  }

  // Обработать завершение мероприятия
  async handleEventEnd() {
    console.log('Event ended, sending final notifications...');
    
    // Останавливаем мероприятие
    await eventState.stop();
    this.stop();

    // Отправляем финальные уведомления
    await this.notifyAllParticipants(null, 'end');
  }

  // Отправить уведомления всем участникам
  async notifyAllParticipants(rotationNumber, type) {
    const allParticipants = await participants.getAll();
    
    // Добавляем уведомления в очередь
    for (const participant of allParticipants) {
      this.notificationQueue.push({
        participant,
        rotationNumber,
        type
      });
    }

    // Запускаем обработку очереди, если она еще не запущена
    if (!this.isProcessing) {
      this.processNotificationQueue();
    }
  }

  // Обработать очередь уведомлений с задержкой
  async processNotificationQueue() {
    this.isProcessing = true;

    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
      
      try {
        await this.sendNotification(notification);
        // Задержка между сообщениями для предотвращения rate limit
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }

    this.isProcessing = false;
  }

  // Отправить одно уведомление
  async sendNotification({ participant, rotationNumber, type }) {
    try {
      let message = '';

      if (type === 'rotation') {
        // Уведомление о новой станции
        const stationId = await rotations.getCurrentStation(participant.id, rotationNumber);
        if (!stationId) return;

        const station = getStationInfo(stationId);
        message = createStationMessage(station, rotationNumber, stations.length);
        message = `🔄 *Переход на новую станцию!*\n\n${message}`;
        
      } else if (type === 'warning') {
        // Предупреждение о скором переходе
        const currentStationId = await rotations.getCurrentStation(participant.id, rotationNumber - 1);
        const nextStationId = await rotations.getCurrentStation(participant.id, rotationNumber);
        
        if (!nextStationId) return;

        const nextStation = getStationInfo(nextStationId);
        message = `⚠️ *Внимание!*\n\n`;
        message += `Через ${TRANSITION_TIME} минуты переход на следующую станцию:\n\n`;
        message += `${nextStation.emoji} *${nextStation.name}*\n`;
        message += `_${nextStation.shortTitle}_\n\n`;
        message += `Пожалуйста, завершите текущую активность и приготовьтесь к переходу.`;
        
      } else if (type === 'end') {
        // Уведомление о завершении мероприятия
        message = `🎉 *Мероприятие завершено!*\n\n`;
        message += `Спасибо за участие в Sechenov Pro Network!\n\n`;
        message += `Вы успешно прошли все 9 станций.\n\n`;
        message += `📝 Не забудьте заполнить форму обратной связи:\n`;
        message += process.env.CV_FORM_URL || 'https://forms.yandex.ru/cloud/67d6fd5090fa7be3dc213e5f/';
      }

      // Отправляем сообщение
      await this.bot.telegram.sendMessage(
        participant.user_id,
        message,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
      
    } catch (error) {
      // Игнорируем ошибки отправки (например, если пользователь заблокировал бота)
      if (error.code !== 403) {
        console.error(`Error sending notification to ${participant.participant_number}:`, error.message);
      }
    }
  }

  // Отправить первые уведомления при запуске мероприятия
  async sendInitialNotifications() {
    await this.notifyAllParticipants(1, 'rotation');
  }
}

module.exports = EventScheduler; 