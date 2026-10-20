const os = require('os');

const PORT = process.env.PORT || 3000;
const UMR_JAKARTA = 5400000; // Rp 5.400.000 (UMR DKI Jakarta)

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

module.exports = {
  PORT,
  UMR_JAKARTA,
  getLocalIp,
  contentTypes
};
