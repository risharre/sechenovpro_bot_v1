const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Инициализация Supabase клиента
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Создание таблиц (выполнить один раз в Supabase SQL Editor)
const createTablesSQL = `
-- Таблица участников
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  participant_number INTEGER UNIQUE NOT NULL,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица ротаций
CREATE TABLE IF NOT EXISTS rotations (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES participants(id),
  rotation_number INTEGER NOT NULL,
  station_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица состояния мероприятия
CREATE TABLE IF NOT EXISTS event_state (
  id SERIAL PRIMARY KEY,
  event_started BOOLEAN DEFAULT FALSE,
  event_paused BOOLEAN DEFAULT FALSE,
  current_rotation INTEGER DEFAULT 1,
  last_rotation_time TIMESTAMP WITH TIME ZONE,
  pause_time TIMESTAMP WITH TIME ZONE,
  total_pause_duration INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица админов
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_rotations_participant_rotation ON rotations(participant_id, rotation_number);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
`;

// Функции для работы с участниками
const participants = {
  // Регистрация нового участника
  async register(userId, username, firstName, lastName) {
    try {
      // Получаем следующий доступный номер
      const { data: count } = await supabase
        .from('participants')
        .select('participant_number', { count: 'exact' });
      
      const nextNumber = String(count.length + 1).padStart(3, '0');
      
      const { data, error } = await supabase
        .from('participants')
        .insert({
          user_id: userId,
          username: username,
          first_name: firstName,
          last_name: lastName,
          participant_number: nextNumber
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error registering participant:', error);
      throw error;
    }
  },

  // Получить участника по user_id
  async getByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error getting participant:', error);
      throw error;
    }
  },

  // Получить всех участников
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .order('participant_number');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting all participants:', error);
      throw error;
    }
  },

  // Получить количество участников
  async getCount() {
    try {
      const { count, error } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting participants count:', error);
      throw error;
    }
  }
};

// Функции для работы с ротациями
const rotations = {
  // Создать ротации для участника
  async createForParticipant(participantId, stationSequence) {
    try {
      const rotationData = stationSequence.map((stationId, index) => ({
        participant_id: participantId,
        rotation_number: index + 1,
        station_id: stationId
      }));

      const { error } = await supabase
        .from('rotations')
        .insert(rotationData);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating rotations:', error);
      throw error;
    }
  },

  // Получить ротации участника
  async getByParticipantId(participantId) {
    try {
      const { data, error } = await supabase
        .from('rotations')
        .select('*')
        .eq('participant_id', participantId)
        .order('rotation_number');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting participant rotations:', error);
      throw error;
    }
  },

  // Получить текущую станцию участника
  async getCurrentStation(participantId, currentRotation) {
    try {
      const { data, error } = await supabase
        .from('rotations')
        .select('station_id')
        .eq('participant_id', participantId)
        .eq('rotation_number', currentRotation)
        .single();
      
      if (error) throw error;
      return data?.station_id;
    } catch (error) {
      console.error('Error getting current station:', error);
      return null;
    }
  },

  // Удалить все ротации (для перезапуска)
  async deleteAll() {
    try {
      const { error } = await supabase
        .from('rotations')
        .delete()
        .gt('id', 0);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting all rotations:', error);
      throw error;
    }
  }
};

// Функции для работы с состоянием мероприятия
const eventState = {
  // Инициализировать состояние
  async init() {
    // Инициализируем состояние, если его нет
    const { data } = await supabase
      .from('event_state')
      .select('*')
      .limit(1);
    
    if (!data || data.length === 0) {
      await supabase
        .from('event_state')
        .insert({
          event_started: false,
          event_paused: false,
          current_rotation: 1,
          total_pause_duration: 0
        });
    }
  },

  // Получить текущее состояние
  async get() {
    const { data, error } = await supabase
      .from('event_state')
      .select('*')
      .limit(1)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Запустить мероприятие
  async start() {
    const { data, error } = await supabase
      .from('event_state')
      .update({
        event_started: true,
        event_paused: false,
        current_rotation: 1,
        last_rotation_time: new Date().toISOString(),
        pause_time: null,
        total_pause_duration: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);
    
    if (error) throw error;
    return data;
  },

  // Остановить мероприятие
  async stop() {
    const { data, error } = await supabase
      .from('event_state')
      .update({
        event_started: false,
        event_paused: false,
        pause_time: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);
    
    if (error) throw error;
    return data;
  },

  // Обновить текущую ротацию
  async updateRotation(rotationNumber) {
    const { data, error } = await supabase
      .from('event_state')
      .update({
        current_rotation: rotationNumber,
        last_rotation_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);
    
    if (error) throw error;
    return data;
  },

  // Пауза
  async pause() {
    const { data, error } = await supabase
      .from('event_state')
      .update({
        event_paused: true,
        pause_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);
    
    if (error) throw error;
    return data;
  },

  // Возобновить
  async resume() {
    // Сначала получаем текущее состояние для расчета времени паузы
    const currentState = await this.get();
    const pauseDuration = currentState.pause_time ? 
      Math.floor((new Date() - new Date(currentState.pause_time)) / 1000) : 0;
    
    const { data, error } = await supabase
      .from('event_state')
      .update({
        event_paused: false,
        pause_time: null,
        total_pause_duration: (currentState.total_pause_duration || 0) + pauseDuration,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);
    
    if (error) throw error;
    return data;
  }
};

// Функции для работы с админами
const admins = {
  // Проверить, является ли пользователь админом
  async isAdmin(username) {
    try {
      // Сначала проверяем в переменных окружения
      const envAdmins = process.env.ADMIN_USERNAMES?.split(',') || [];
      if (envAdmins.includes(username)) {
        return true;
      }

      // Затем проверяем в базе данных
      const { data, error } = await supabase
        .from('admins')
        .select('username')
        .eq('username', username)
        .single();
      
      return !!data;
    } catch (error) {
      console.error('Error checking admin:', error);
      return false;
    }
  },

  // Добавить админа
  async add(username, userId) {
    try {
      const { error } = await supabase
        .from('admins')
        .insert({
          username: username,
          user_id: userId
        });
      
      if (error && error.code !== '23505') throw error; // Игнорируем ошибку дубликата
      return true;
    } catch (error) {
      console.error('Error adding admin:', error);
      throw error;
    }
  }
};

module.exports = {
  supabase,
  participants,
  rotations,
  eventState,
  admins,
  createTablesSQL
}; 