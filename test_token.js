// Простой тест токена
const https = require('https');

const token = '7450494077:AAF2v6iWkOsVUSAxW2KEJ6sNc3rn0tROyXI';

const url = `https://api.telegram.org/bot${token}/getMe`;

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.ok) {
        console.log('✅ Токен валидный!');
        console.log('Информация о боте:', response.result);
      } else {
        console.log('❌ Токен невалидный!');
        console.log('Ошибка:', response);
      }
    } catch (error) {
      console.log('❌ Ошибка парсинга ответа:', error);
    }
  });
}).on('error', (error) => {
  console.log('❌ Ошибка запроса:', error);
}); 