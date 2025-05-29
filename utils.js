const { stations } = require('./stations');

// Функция для случайного перемешивания массива (Fisher-Yates shuffle)
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Алгоритм максимального смешивания участников по станциям
function distributeParticipants(participantCount) {
  const stationIds = stations.map(s => s.id); // ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
  const distributions = [];
  
  // Создаем массив всех участников (номера от 0 до participantCount-1)
  const allParticipants = Array.from({ length: participantCount }, (_, i) => i);
  
  // Для каждой ротации генерируем полностью случайное распределение
  for (let rotation = 0; rotation < stationIds.length; rotation++) {
    // Перемешиваем участников случайным образом
    const shuffledParticipants = shuffle([...allParticipants]);
    
    // Вычисляем, сколько людей должно быть на каждой станции
    const baseParticipantsPerStation = Math.floor(participantCount / stationIds.length);
    const extraParticipants = participantCount % stationIds.length;
    
    let participantIndex = 0;
    
    // Распределяем участников по станциям для этой ротации
    for (let stationIndex = 0; stationIndex < stationIds.length; stationIndex++) {
      const stationId = stationIds[stationIndex];
      
      // Определяем количество участников для этой станции
      const participantsForThisStation = baseParticipantsPerStation + 
        (stationIndex < extraParticipants ? 1 : 0);
      
      // Назначаем участников на эту станцию
      for (let i = 0; i < participantsForThisStation; i++) {
        const participantNumber = shuffledParticipants[participantIndex];
        
        // Если это первая ротация, создаем массив для этого участника
        if (rotation === 0) {
          distributions[participantNumber] = [];
        }
        
        // Добавляем станцию в маршрут участника
        distributions[participantNumber][rotation] = stationId;
        
        participantIndex++;
      }
    }
  }
  
  return distributions;
}

// Форматирование времени
function formatTime(date) {
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow'
  });
}

// Форматирование даты
function formatDate(date) {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow'
  });
}

// Создание inline клавиатуры для меню участника
function createParticipantMenu() {
  return {
    inline_keyboard: [
      [{ text: '📍 Текущая станция', callback_data: 'current_station' }],
      [{ text: '⏭️ Следующая станция', callback_data: 'next_station' }],
      [{ text: '⏰ Моё расписание', callback_data: 'my_schedule' }],
      [{ text: '📞 Связь с организатором', callback_data: 'contact_organizer' }],
      [{ text: 'ℹ️ Моя информация', callback_data: 'my_info' }]
    ]
  };
}

// Создание inline клавиатуры для админского меню
function createAdminMenu(eventState = null) {
  const keyboard = [];
  
  if (!eventState || !eventState.event_started) {
    // Мероприятие не запущено
    keyboard.push([{ text: '🚀 Запустить мероприятие', callback_data: 'admin_start_event' }]);
  } else {
    // Мероприятие запущено
    if (eventState.event_paused) {
      // На паузе
      keyboard.push([{ text: '▶️ Возобновить мероприятие', callback_data: 'admin_resume_event' }]);
      keyboard.push([{ text: '⏹️ Остановить мероприятие', callback_data: 'admin_stop_event' }]);
    } else {
      // Активно
      keyboard.push([{ text: '⏸️ Приостановить мероприятие', callback_data: 'admin_pause_event' }]);
      keyboard.push([{ text: '⏹️ Остановить мероприятие', callback_data: 'admin_stop_event' }]);
    }
  }
  
  // Общие кнопки
  keyboard.push([{ text: '📊 Статус мероприятия', callback_data: 'admin_status' }]);
  keyboard.push([{ text: '👥 Список участников', callback_data: 'admin_participants' }]);
  
  return { inline_keyboard: keyboard };
}

// Получить информацию о станции по ID
function getStationInfo(stationId) {
  return stations.find(s => s.id === stationId);
}

// Рассчитать время до следующей ротации
function getTimeUntilNextRotation(lastRotationTime, cycleTime) {
  const now = new Date();
  const lastRotation = new Date(lastRotationTime);
  const nextRotation = new Date(lastRotation.getTime() + cycleTime * 60 * 1000);
  const timeRemaining = Math.max(0, nextRotation - now);
  
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);
  
  return {
    totalMs: timeRemaining,
    minutes,
    seconds,
    formatted: `${minutes}:${seconds.toString().padStart(2, '0')}`
  };
}

// Escape markdown специальных символов
function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Создать сообщение о текущей станции
function createStationMessage(station, rotationNumber, totalRotations, timeRemaining = null) {
  let message = `${station.emoji} *Станция ${station.id}: ${station.name}*\n\n`;
  message += `📍 Ротация ${rotationNumber} из ${totalRotations}\n\n`;
  message += `❓ *${station.shortTitle}*\n\n`;
  message += `${station.description}\n`;
  
  if (timeRemaining) {
    message += `\n⏱️ До перехода: ${timeRemaining.formatted}`;
  }
  
  return message;
}

// Создать сообщение с расписанием участника
function createScheduleMessage(participantNumber, rotations, currentRotation) {
  let message = `📅 *Ваше индивидуальное расписание*\n`;
  message += `Участник №${participantNumber}\n\n`;
  
  rotations.forEach((rotation, index) => {
    const station = getStationInfo(rotation.station_id);
    const rotationNum = index + 1;
    const isCurrent = rotationNum === currentRotation;
    
    if (isCurrent) {
      message += `▶️ `;
    } else if (rotationNum < currentRotation) {
      message += `✅ `;
    } else {
      message += `⏳ `;
    }
    
    message += `${rotationNum}. ${station.emoji} ${station.name}`;
    
    if (isCurrent) {
      message += ` *(сейчас)*`;
    }
    
    message += '\n';
  });
  
  return message;
}

// Анализ качества смешивания участников
function analyzeParticipantMixing(distributions) {
  const participantCount = distributions.length;
  const rotationCount = distributions[0].length;
  
  // Подсчитываем, сколько раз каждая пара участников встречается вместе
  const meetingCounts = {};
  
  for (let rotation = 0; rotation < rotationCount; rotation++) {
    // Группируем участников по станциям для этой ротации
    const stationGroups = {};
    
    for (let participant = 0; participant < participantCount; participant++) {
      const station = distributions[participant][rotation];
      if (!stationGroups[station]) {
        stationGroups[station] = [];
      }
      stationGroups[station].push(participant);
    }
    
    // Для каждой станции подсчитываем встречи участников
    Object.values(stationGroups).forEach(group => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const pair = `${Math.min(group[i], group[j])}-${Math.max(group[i], group[j])}`;
          meetingCounts[pair] = (meetingCounts[pair] || 0) + 1;
        }
      }
    });
  }
  
  // Анализируем результаты
  const meetingFrequencies = Object.values(meetingCounts);
  const maxMeetings = meetingFrequencies.length > 0 ? Math.max(...meetingFrequencies) : 0;
  const avgMeetings = meetingFrequencies.length > 0 ? 
    meetingFrequencies.reduce((a, b) => a + b, 0) / meetingFrequencies.length : 0;
  const totalPossiblePairs = (participantCount * (participantCount - 1)) / 2;
  const pairsWhoNeverMet = totalPossiblePairs - meetingFrequencies.length;
  
  return {
    totalPairs: totalPossiblePairs,
    pairsWhoMet: meetingFrequencies.length,
    pairsWhoNeverMet: pairsWhoNeverMet,
    maxMeetingsPerPair: maxMeetings,
    avgMeetingsPerPair: avgMeetings.toFixed(2),
    mixingQuality: ((meetingFrequencies.length / totalPossiblePairs) * 100).toFixed(1)
  };
}

module.exports = {
  shuffle,
  distributeParticipants,
  analyzeParticipantMixing,
  formatTime,
  formatDate,
  createParticipantMenu,
  createAdminMenu,
  getStationInfo,
  getTimeUntilNextRotation,
  escapeMarkdown,
  createStationMessage,
  createScheduleMessage
}; 