const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { WebSocket } = require('ws');
const { serveStatic } = require('../src/server/staticServer');
const { setupWebSocket } = require('../src/server/socketServer');

test('End-to-End WebSocket Game Lifecycle', async (t) => {
  const server = http.createServer((req, res) => {
    serveStatic(req, res);
  });
  const wss = setupWebSocket(server);

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  let roomCode = '';
  let boardWs = null;
  let mobileWs = null;

  await t.test('Laptop creates board display room', async () => {
    boardWs = new WebSocket(`ws://127.0.0.1:${port}`);

    await new Promise((resolve, reject) => {
      boardWs.on('open', () => {
        boardWs.send(JSON.stringify({
          type: 'CREATE_BOARD_DISPLAY',
          startingCash: 5400000
        }));
      });

      boardWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'BOARD_ROOM_CREATED') {
          assert.ok(msg.roomCode);
          assert.equal(msg.startingCash, 5400000);
          roomCode = msg.roomCode;
          resolve();
        }
      });

      boardWs.on('error', reject);
    });
  });

  await t.test('Mobile player joins the room', async () => {
    mobileWs = new WebSocket(`ws://127.0.0.1:${port}`);

    await new Promise((resolve, reject) => {
      mobileWs.on('open', () => {
        mobileWs.send(JSON.stringify({
          type: 'JOIN_ROOM',
          roomCode,
          name: 'Budi Santoso',
          sessionToken: 'usr_test_budi'
        }));
      });

      mobileWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ROOM_JOINED') {
          assert.equal(msg.roomCode, roomCode);
          assert.equal(msg.playerId, 0);
          assert.equal(msg.isHost, true);
          assert.equal(msg.sessionToken, 'usr_test_budi');
          resolve();
        }
      });

      mobileWs.on('error', reject);
    });
  });

  await t.test('Start game broadcast received by board and mobile', async () => {
    const boardPromise = new Promise(resolve => {
      boardWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'GAME_STARTED') resolve();
      });
    });

    const mobilePromise = new Promise(resolve => {
      mobileWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'GAME_STARTED') resolve();
      });
    });

    boardWs.send(JSON.stringify({ type: 'START_GAME' }));
    await Promise.all([boardPromise, mobilePromise]);
  });

  // Clean up connections and server
  boardWs.close();
  mobileWs.close();
  wss.close();
  server.close();
});
