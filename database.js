const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Проверяем наличие необходимых переменных окружения
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY', 'BOT_TOKEN'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('\n🔧 Please set the following environment variables:');
  missingVars.forEach(varName => {
    console.error(`   ${varName}=your_${varName.toLowerCase()}_value`);
  });
  
  if (process.env.NODE_ENV === 'production') {
    console.error('\n🚀 For Railway deployment, set these in your Railway dashboard:');
    console.error('   1. Go to your Railway project');
    console.error('   2. Click on Variables tab');
    console.error('   3. Add each variable with its value');
  } else {
    console.error('\n💻 For local development, create a .env file with these variables');
  }
  
  throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
}

console.log('✅ Environment variables validated');
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Set' : 'Missing'}`);
console.log(`   SUPABASE_KEY: ${process.env.SUPABASE_KEY ? 'Set' : 'Missing'}`);
console.log(`   BOT_TOKEN: ${process.env.BOT_TOKEN ? 'Set' : 'Missing'}`);

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

// Проверка подключения к базе данных
const testConnection = async () => {
  try {
    console.log('Testing database connection...');
    
    // Тестируем простой запрос
    const { data, error } = await supabase
      .from('event_state')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Database connection failed:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

// Проверка схемы базы данных
const validateSchema = async () => {
  try {
    console.log('Validating database schema...');
    
    // Проверяем наличие нужных столбцов
    const { data, error } = await supabase
      .from('event_state')
      .select('event_started, event_paused, current_rotation, total_pause_duration')
      .limit(1);
    
    if (error) {
      if (error.message.includes('event_paused')) {
        console.error('❌ Missing columns in event_state table!');
        console.error('Please run the SQL update script in Supabase:');
        console.error('ALTER TABLE event_state ADD COLUMN event_paused BOOLEAN DEFAULT FALSE;');
        console.error('ALTER TABLE event_state ADD COLUMN pause_time TIMESTAMP WITH TIME ZONE;');
        console.error('ALTER TABLE event_state ADD COLUMN total_pause_duration INTEGER DEFAULT 0;');
        throw new Error('Database schema is outdated. Please update event_state table.');
      }
      throw error;
    }
    
    console.log('✅ Database schema is valid');
    return true;
  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    throw error;
  }
};

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
  testConnection,
  validateSchema,
  participants,
  rotations,
  eventState,
  admins,
  createTablesSQL
}; 