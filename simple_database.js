const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// SQL для создания упрощенных таблиц
const createTablesSQL = `
-- Упрощенная таблица участников
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  participant_number INTEGER UNIQUE,
  
  -- Ответы на вопросы опроса
  answer1 TEXT, -- сильные черты
  answer2 TEXT, -- опыт научной работы
  answer3 TEXT, -- научные интересы
  
  -- Статус
  survey_completed BOOLEAN DEFAULT FALSE,
  team_number INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица администраторов
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавляем индексы
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_survey_completed ON participants(survey_completed);
CREATE INDEX IF NOT EXISTS idx_participants_team_number ON participants(team_number);
`;

// Проверка подключения к базе данных
async function testConnection() {
  try {
    console.log('Testing database connection...');
    const { data, error } = await supabase.from('participants').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Участники
const participants = {
  // Регистрация нового участника
  async register(userId, username, firstName, lastName) {
    // Получаем следующий номер участника
    const { data: lastParticipant } = await supabase
      .from('participants')
      .select('participant_number')
      .order('participant_number', { ascending: false })
      .limit(1);
    
    const nextNumber = lastParticipant && lastParticipant.length > 0 
      ? lastParticipant[0].participant_number + 1 
      : 1;

    const { data, error } = await supabase
      .from('participants')
      .insert([{
        user_id: userId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        participant_number: nextNumber
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Получение участника по user_id
  async getByUserId(userId) {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Обновление ответа на первый вопрос
  async updateAnswer1(participantId, answer) {
    const { error } = await supabase
      .from('participants')
      .update({ 
        answer1: answer,
        updated_at: new Date().toISOString()
      })
      .eq('id', participantId);

    if (error) throw error;
  },

  // Обновление ответа на второй вопрос
  async updateAnswer2(participantId, answer) {
    const { error } = await supabase
      .from('participants')
      .update({ 
        answer2: answer,
        updated_at: new Date().toISOString()
      })
      .eq('id', participantId);

    if (error) throw error;
  },

  // Обновление ответа на третий вопрос
  async updateAnswer3(participantId, answer) {
    const { error } = await supabase
      .from('participants')
      .update({ 
        answer3: answer,
        updated_at: new Date().toISOString()
      })
      .eq('id', participantId);

    if (error) throw error;
  },

  // Отметка о завершении опроса
  async markSurveyCompleted(participantId) {
    const { error } = await supabase
      .from('participants')
      .update({ 
        survey_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', participantId);

    if (error) throw error;
  },

  // Назначение команды
  async assignTeam(participantId, teamNumber) {
    const { error } = await supabase
      .from('participants')
      .update({ 
        team_number: teamNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', participantId);

    if (error) throw error;
  },

  // Получение всех участников
  async getAll() {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('participant_number');

    if (error) throw error;
    return data || [];
  },

  // Получение участников, завершивших опрос
  async getCompleted() {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('survey_completed', true)
      .order('participant_number');

    if (error) throw error;
    return data || [];
  },

  // Получение распределенных участников
  async getDistributed() {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .not('team_number', 'is', null)
      .order('team_number');

    if (error) throw error;
    return data || [];
  },

  // Подсчет общего количества участников
  async getCount() {
    const { count, error } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  }
};

// Администраторы
const admins = {
  async isAdmin(username) {
    if (!username) return false;
    
    const { data, error } = await supabase
      .from('admins')
      .select('username')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking admin status:', error);
      return false;
    }

    return !!data;
  },

  async add(username) {
    const { data, error } = await supabase
      .from('admins')
      .insert([{ username }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

module.exports = {
  participants,
  admins,
  testConnection,
  createTablesSQL
}; 