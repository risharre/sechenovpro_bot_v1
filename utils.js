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

// Алгоритм равномерного распределения участников по станциям
function distributeParticipants(participantCount) {
  const stationIds = stations.map(s => s.id); // ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
  const distributions = [];
  
  // Для каждого участника создаем случайную последовательность прохождения станций
  for (let i = 0; i < participantCount; i++) {
    const participantPath = shuffle(stationIds);
    distributions.push(participantPath);
  }
  
  // Проверяем равномерность распределения для каждой ротации
  // и корректируем при необходимости
  for (let rotation = 0; rotation < stationIds.length; rotation++) {
    const stationCounts = {};
    stationIds.forEach(id => stationCounts[id] = 0);
    
    // Подсчитываем количество участников на каждой станции для текущей ротации
    distributions.forEach(path => {
      stationCounts[path[rotation]]++;
    });
    
    // Целевое количество участников на станцию
    const targetPerStation = Math.floor(participantCount / stationIds.length);
    const remainder = participantCount % stationIds.length;
    
    // Корректируем распределение, если есть дисбаланс
    let iterations = 0;
    const maxIterations = 1000;
    
    while (iterations < maxIterations) {
      let needsAdjustment = false;
      
      // Проверяем, нужна ли корректировка
      for (const stationId of stationIds) {
        const expectedCount = targetPerStation + (remainder > 0 ? 1 : 0);
        if (Math.abs(stationCounts[stationId] - targetPerStation) > 1) {
          needsAdjustment = true;
          break;
        }
      }
      
      if (!needsAdjustment) break;
      
      // Находим перегруженные и недогруженные станции
      const overloaded = [];
      const underloaded = [];
      
      for (const stationId of stationIds) {
        if (stationCounts[stationId] > targetPerStation + 1) {
          overloaded.push(stationId);
        } else if (stationCounts[stationId] < targetPerStation) {
          underloaded.push(stationId);
        }
      }
      
      if (overloaded.length === 0 || underloaded.length === 0) break;
      
      // Меняем местами участников
      let swapped = false;
      for (let i = 0; i < distributions.length && !swapped; i++) {
        if (overloaded.includes(distributions[i][rotation])) {
          for (let j = i + 1; j < distributions.length; j++) {
            if (underloaded.includes(distributions[j][rotation])) {
              // Проверяем, что обмен не нарушит уникальность маршрута
              const canSwap = distributions[i][rotation] !== distributions[j][rotation];
              if (canSwap) {
                // Меняем местами станции в текущей ротации
                [distributions[i][rotation], distributions[j][rotation]] = 
                [distributions[j][rotation], distributions[i][rotation]];
                
                // Обновляем счетчики
                stationCounts[distributions[i][rotation]]++;
                stationCounts[distributions[j][rotation]]--;
                swapped = true;
                break;
              }
            }
          }
        }
      }
      
      if (!swapped) break;
      iterations++;
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
function createAdminMenu() {
  return {
    inline_keyboard: [
      [{ text: '🚀 Запустить мероприятие', callback_data: 'admin_start_event' }],
      [{ text: '⏹️ Остановить мероприятие', callback_data: 'admin_stop_event' }],
      [{ text: '📊 Статус мероприятия', callback_data: 'admin_status' }],
      [{ text: '👥 Список участников', callback_data: 'admin_participants' }]
    ]
  };
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
  let message = `${station.emoji} *Станция ${station.id}: ${escapeMarkdown(station.name)}*\n\n`;
  message += `📍 Ротация ${rotationNumber} из ${totalRotations}\n\n`;
  message += `❓ *${escapeMarkdown(station.shortTitle)}*\n\n`;
  message += `${escapeMarkdown(station.description)}\n`;
  
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
    
    message += `${rotationNum}. ${station.emoji} ${escapeMarkdown(station.name)}`;
    
    if (isCurrent) {
      message += ` *(сейчас)*`;
    }
    
    message += '\n';
  });
  
  return message;
}

module.exports = {
  shuffle,
  distributeParticipants,
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