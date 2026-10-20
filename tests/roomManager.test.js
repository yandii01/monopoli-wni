const test = require('node:test');
const assert = require('node:assert/strict');

const {
  rooms,
  getRoom,
  createBoardRoom,
  deleteRoom,
  getSanitizedPlayers,
  removePlayerFromRoom
} = require('../src/server/roomManager');

test('Room Manager Lifecycle', async (t) => {
  const dummyWs = { readyState: 1, send: () => {} };

  await t.test('creates a new board room with default status and cash', () => {
    const room = createBoardRoom('TEST1', 5400000, null, dummyWs);
    assert.equal(room.code, 'TEST1');
    assert.equal(room.status, 'LOBBY');
    assert.equal(room.startingCash, 5400000);
    assert.equal(room.players.length, 0);
    assert.equal(getRoom('TEST1'), room);
  });

  await t.test('retrieves room with case-insensitive and trimmed code', () => {
    assert.ok(getRoom('test1'));
    assert.ok(getRoom('  TEST1  '));
  });

  await t.test('deletes room cleanly', () => {
    deleteRoom('TEST1');
    assert.equal(getRoom('TEST1'), null);
  });
});

test('Player Sanitization & Security', async (t) => {
  const dummyWs = { readyState: 1, send: () => {} };
  const players = [
    {
      id: 0,
      sessionToken: 'token_123',
      name: 'Player One',
      photo: 'data:image/jpeg;base64,abc',
      cash: 5400000,
      pos: 0,
      color: '#3b82f6',
      emoji: '🧑',
      skipTurns: 0,
      inHospital: false,
      inJail: false,
      alive: true,
      props: [1, 2],
      isHost: true,
      isConnected: true,
      reconnectAttemptsLeft: 3,
      consecutiveMissedTurns: 0,
      ws: dummyWs // Internal circular object that must not be leaked
    }
  ];

  await t.test('strips ws connection object from player state', () => {
    const sanitized = getSanitizedPlayers(players);
    assert.equal(sanitized.length, 1);
    assert.equal(sanitized[0].name, 'Player One');
    assert.equal(sanitized[0].id, 0);
    assert.equal(sanitized[0].cash, 5400000);
    assert.equal(sanitized[0].ws, undefined);
  });
});

test('Player Removal & Property Clearance', async (t) => {
  const dummyWs = { readyState: 1, send: () => {} };
  const room = createBoardRoom('TEST2', 5400000, null, dummyWs);

  // Set up mock tiles
  room.tiles = [
    { index: 0, name: 'Start', owner: null },
    { index: 1, name: 'Warung Madura', owner: 0, buildings: 2, isLandmark: false },
    { index: 2, name: 'Kos Mahasiswa', owner: 1, buildings: 1, isLandmark: false }
  ];

  // Set up 2 players
  room.players = [
    { id: 0, name: 'Pemain 1', alive: true, props: [1], isHost: true },
    { id: 1, name: 'Pemain 2', alive: true, props: [2], isHost: false }
  ];
  room.activePlayerIdx = 0;

  await t.test('removes player and releases their owned properties back to market', () => {
    removePlayerFromRoom(room, 0, 'Keluar');
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].id, 1);

    // Tile 1 owned by player 0 should now be released to market
    assert.equal(room.tiles[1].owner, null);
    assert.equal(room.tiles[1].buildings, 0);
    assert.equal(room.tiles[1].isLandmark, false);

    // Tile 2 owned by player 1 remains intact
    assert.equal(room.tiles[2].owner, 1);
    assert.equal(room.tiles[2].buildings, 1);
  });

  await t.test('adjusts activePlayerIdx correctly when active player leaves', () => {
    assert.equal(room.activePlayerIdx, 0); // now points to player 1
  });

  // Clean up
  deleteRoom('TEST2');
});
