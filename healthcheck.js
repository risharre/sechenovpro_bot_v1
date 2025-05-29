const http = require('http');
const { testConnection } = require('./database');

// Простой HTTP сервер для healthcheck
const server = http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    try {
      // Проверяем подключение к базе
      await testConnection();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }));
    } catch (error) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Запускаем healthcheck сервер на порту 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Healthcheck server running on port ${PORT}`);
});

module.exports = server; 