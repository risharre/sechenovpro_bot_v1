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
    try {
      const { data: existing } = await supabase
        .from('event_state')
        .select('*')
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('event_state')
          .insert({
            current_rotation: 0,
            event_started: false
          });
        
        if (error) throw error;
      }
      return true;
    } catch (error) {
      console.error('Error initializing event state:', error);
      throw error;
    }
  },

  // Получить текущее состояние
  async get() {
    try {
      const { data, error } = await supabase
        .from('event_state')
        .select('*')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error getting event state:', error);
      throw error;
    }
  },

  // Запустить мероприятие
  async start() {
    try {
      const { error } = await supabase
        .from('event_state')
        .update({
          event_started: true,
          event_start_time: new Date().toISOString(),
          current_rotation: 1,
          last_rotation_time: new Date().toISOString()
        })
        .eq('id', 1);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error starting event:', error);
      throw error;
    }
  },

  // Остановить мероприятие
  async stop() {
    try {
      const { error } = await supabase
        .from('event_state')
        .update({
          event_started: false
        })
        .eq('id', 1);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error stopping event:', error);
      throw error;
    }
  },

  // Обновить текущую ротацию
  async updateRotation(rotationNumber) {
    try {
      const { error } = await supabase
        .from('event_state')
        .update({
          current_rotation: rotationNumber,
          last_rotation_time: new Date().toISOString()
        })
        .eq('id', 1);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating rotation:', error);
      throw error;
    }
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