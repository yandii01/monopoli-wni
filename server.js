const http = require('http');
const { PORT, UMR_JAKARTA, getLocalIp } = require('./src/config');
const { serveStatic } = require('./src/server/staticServer');
const { setupWebSocket } = require('./src/server/socketServer');
const { rooms } = require('./src/server/roomManager');

const localIp = getLocalIp();

// Static file server
const server = http.createServer((req, res) => {
  serveStatic(req, res);
});

// WebSocket Server setup
const wss = setupWebSocket(server);

// Start server jika dijalankan langsung
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🎮 MONOPOLI WNI MULTIPLAYER SERVER (KAHOOT STYLE)`);
    console.log(`💻 Layar Laptop:  http://localhost:${PORT}`);
    console.log(`📱 Main via HP:   http://${localIp}:${PORT}`);
    console.log(`💰 Saldo Awal:    Rp ${UMR_JAKARTA.toLocaleString('id-ID')} (UMR DKI Jakarta)`);
    console.log(`====================================================`);
  });
}

module.exports = {
  server,
  wss,
  rooms
};
