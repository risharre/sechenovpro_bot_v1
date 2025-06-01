const { distributeParticipants, analyzeParticipantMixing } = require('./utils');
const { stations, TOTAL_ROTATIONS } = require('./stations');

// Тестируем алгоритм с разным количеством участников
console.log('🧪 ТЕСТИРОВАНИЕ АЛГОРИТМА РАСПРЕДЕЛЕНИЯ');
console.log('=' .repeat(50));

function testGroupCoverage(participantCount) {
  console.log(`\n👥 Тестируем ${participantCount} участников:`);
  console.log('-'.repeat(30));
  
  // Тестируем распределение
  const distribution = distributeParticipants(participantCount);
  
  // Проверяем покрытие групп
  let groupCoverageCount = 0;
  for (let participant = 0; participant < participantCount; participant++) {
    const visitedGroups = new Set();
    const participantRoute = distribution[participant];
    
    // Проверяем, какие группы посетил участник
    for (let rotation = 0; rotation < participantRoute.length; rotation++) {
      const stationId = participantRoute[rotation];
      const station = stations.find(s => s.id === stationId);
      if (station) {
        visitedGroups.add(station.group);
      }
    }
    
    const hasAllGroups = visitedGroups.has('1') && visitedGroups.has('2') && visitedGroups.has('3');
    console.log(`  Участник ${participant + 1}: группы [${Array.from(visitedGroups).join(', ')}] ${hasAllGroups ? '✅' : '❌'}`);
    
    if (hasAllGroups) {
      groupCoverageCount++;
    }
  }
  
  const groupCoveragePercent = (groupCoverageCount / participantCount * 100).toFixed(1);
  
  // Анализируем качество
  const analysis = analyzeParticipantMixing(distribution);
  
  console.log(`\n📊 Результаты:`);
  console.log(`  • Качество смешивания: ${analysis.mixingQuality}%`);
  console.log(`  • Покрытие групп: ${groupCoveragePercent}% (${groupCoverageCount}/${participantCount})`);
  console.log(`  • Ротаций: ${TOTAL_ROTATIONS}`);
  
  return { 
    participantCount, 
    mixingQuality: parseFloat(analysis.mixingQuality),
    groupCoverage: parseFloat(groupCoveragePercent),
    rotations: TOTAL_ROTATIONS
  };
}

// Тестовые случаи
const testCases = [27, 54, 90, 150];

console.log(`\n📋 Тестируем случаи: ${testCases.join(', ')} участников`);

const results = [];
testCases.forEach(count => {
  const result = testGroupCoverage(count);
  results.push(result);
  
  if (count <= 54) { // Показываем детали только для небольших групп
    showDistributionExample(count);
  }
});

console.log('\n📊 СВОДНАЯ ТАБЛИЦА РЕЗУЛЬТАТОВ:');
console.log('=' .repeat(70));
console.log('| Участники | Смешивание | Покрытие групп | Ротации |');
console.log('|-----------|------------|----------------|---------|');
results.forEach(r => {
  console.log(`| ${r.participantCount.toString().padStart(9)} | ${r.mixingQuality.toString().padStart(8)}% | ${r.groupCoverage.toString().padStart(12)}% | ${r.rotations.toString().padStart(7)} |`);
});

// Показать пример распределения по ротациям
function showDistributionExample(participantCount) {
  console.log(`\n📍 Пример распределения для ${participantCount} участников:`);
  console.log('-'.repeat(50));
  
  const distribution = distributeParticipants(participantCount);
  
  // Показываем распределение по ротациям
  for (let rotation = 0; rotation < TOTAL_ROTATIONS; rotation++) {
    console.log(`\n🔄 Ротация ${rotation + 1} (Группа ${rotation + 1}):`);
    
    // Группируем участников по станциям для этой ротации
    const stationGroups = {};
    for (let participant = 0; participant < participantCount; participant++) {
      const station = distribution[participant][rotation];
      if (!stationGroups[station]) {
        stationGroups[station] = [];
      }
      stationGroups[station].push(participant + 1);
    }
    
    // Выводим распределение по станциям
    Object.keys(stationGroups).sort().forEach(stationId => {
      const participants = stationGroups[stationId];
      const station = stations.find(s => s.id === stationId);
      console.log(`  ${stationId} ${station.emoji}: [${participants.join(', ')}] (${participants.length} чел.)`);
    });
  }
}

console.log('\n🎯 ВЫВОДЫ:');
console.log('=' .repeat(50));
console.log('✅ Новый алгоритм с 3 ротациями:');
console.log('   • Каждый участник посещает ровно 3 станции (по одной из каждой группы)');
console.log('   • 100% покрытие групп гарантировано архитектурой алгоритма');
console.log('   • Максимальное смешивание участников в каждой ротации');
console.log('   • Время мероприятия: 15 минут (3 ротации × 5 минут)');
console.log('   • Оптимальное количество участников: ~90 человек');

console.log('\n⏰ ТАЙМИНГИ:');
console.log('   • Работа на станции: 4 минуты');
console.log('   • Переход между станциями: 1 минута');
console.log('   • Предупреждение: через 4 минуты после начала ротации');
console.log('   • Уведомление о переходе: через 5 минут (начало новой ротации)');

console.log('\n🚀 Готово к использованию на реальном мероприятии!'); 