const { distributeParticipants, analyzeParticipantMixing } = require('./utils');
const { stations } = require('./stations');

console.log('🔍 ОТЛАДКА ДЛЯ МАЛЫХ ГРУПП');
console.log('=' .repeat(50));

function testSmallGroup(participantCount) {
  console.log(`\n👥 Тестируем ${participantCount} участников:`);
  console.log('-'.repeat(30));
  
  try {
    // Тестируем распределение
    const distribution = distributeParticipants(participantCount);
    console.log('✅ Распределение создано успешно');
    
    // Проверяем покрытие групп
    let groupCoverageSuccess = true;
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
      
      if (!hasAllGroups) {
        groupCoverageSuccess = false;
      }
    }
    
    // Показываем детальные маршруты только для малых групп
    if (participantCount <= 5) {
      console.log('\n📍 Детальные маршруты:');
      for (let participant = 0; participant < participantCount; participant++) {
        const route = distribution[participant];
        console.log(`  Участник ${participant + 1}: ${route.join(' → ')}`);
      }
    }
    
    // Анализируем качество
    const analysis = analyzeParticipantMixing(distribution);
    console.log(`\n📊 Статистика:`);
    console.log(`  • Качество смешивания: ${analysis.mixingQuality}%`);
    console.log(`  • Покрытие групп: ${groupCoverageSuccess ? '100%' : 'ОШИБКА'}`);
    
    // Проверяем распределение по станциям
    console.log(`\n🎯 Распределение по станциям для ротации 1:`);
    const stationGroups = {};
    for (let participant = 0; participant < participantCount; participant++) {
      const station = distribution[participant][0];
      if (!stationGroups[station]) {
        stationGroups[station] = [];
      }
      stationGroups[station].push(participant + 1);
    }
    
    Object.keys(stationGroups).sort().forEach(station => {
      const participants = stationGroups[station];
      const stationInfo = stations.find(s => s.id === station);
      console.log(`  ${station} (${stationInfo.emoji}): [${participants.join(', ')}] (${participants.length} чел.)`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ ОШИБКА при тестировании:', error.message);
    console.error('Стек ошибки:', error.stack);
    return false;
  }
}

// Тестируем разные размеры групп
const testCases = [1, 2, 3, 5, 10];

testCases.forEach(count => {
  const success = testSmallGroup(count);
  if (!success) {
    console.log(`\n💥 КРИТИЧЕСКАЯ ОШИБКА для ${count} участников!`);
  }
});

console.log('\n🏁 Тестирование завершено'); 