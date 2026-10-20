const fs = require('fs');
const path = require('path');
const { contentTypes } = require('../config');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PUBLIC_DIR = path.resolve(PROJECT_ROOT, 'public');

function serveStatic(req, res) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '/index.html') {
    reqPath = '/wni_simulator.html';
  }

  // Cek apakah file berada di root project atau di folder public
  let filePath = path.join(PROJECT_ROOT, reqPath);
  let resolvedPath = path.resolve(filePath);

  // Keamanan: Cegah directory traversal
  if (!resolvedPath.startsWith(PROJECT_ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Coba cari di folder public jika request diawali nama file/folder
      const publicFilePath = path.join(PUBLIC_DIR, reqPath);
      const resolvedPublicPath = path.resolve(publicFilePath);

      if (resolvedPublicPath.startsWith(PROJECT_ROOT)) {
        fs.readFile(resolvedPublicPath, (pubErr, pubContent) => {
          if (pubErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            const ext = path.extname(resolvedPublicPath).toLowerCase();
            res.writeHead(200, {
              'Content-Type': contentTypes[ext] || 'application/octet-stream',
              'Cache-Control': 'no-cache'
            });
            res.end(pubContent);
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    fs.readFile(resolvedPath, (fileErr, content) => {
      if (fileErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${fileErr.code}`);
        return;
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': contentTypes[ext] || 'text/plain',
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });
}

module.exports = {
  serveStatic,
  PROJECT_ROOT,
  PUBLIC_DIR
};
