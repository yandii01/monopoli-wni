const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { serveStatic } = require('../src/server/staticServer');

test('Static File Server Routing', async (t) => {
  const server = http.createServer((req, res) => {
    serveStatic(req, res);
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  await t.test('serves wni_simulator.html on root path "/"', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const text = await res.text();
    assert.match(text, /WNI Simulator/);
  });

  await t.test('serves modular CSS file with correct Content-Type', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/css/variables.css`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/css/);
    const text = await res.text();
    assert.match(text, /--bg-dark/);
  });

  await t.test('serves modular JS file with correct Content-Type', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/js/constants.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/javascript/);
    const text = await res.text();
    assert.match(text, /BOARD_DATA_36/);
  });

  await t.test('returns 404 for nonexistent files', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/nonexistent-file.xyz`);
    assert.equal(res.status, 404);
  });

  await t.test('blocks path traversal attempts with 403 or 404', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/../../../../etc/passwd`);
    assert.ok(res.status === 403 || res.status === 404);
  });

  server.close();
});
