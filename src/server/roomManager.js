const { WebSocket } = require('ws');
const { UMR_JAKARTA } = require('../config');

// Room management
// rooms = Map<roomCode, RoomObject>
const rooms = new Map();

function broadcast(room, msgObj) {
  if (!room) return;
  const data = JSON.stringify(msgObj);
  // Kirim ke semua pemain yang terkoneksi
  if (Array.isArray(room.players)) {
    room.players.forEach(p => {
      if (p.ws && p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(data);
      }
    });
  }
  // Kirim ke Board Display (Layar Laptop/TV) jika ada
  if (room.boardWs && room.boardWs.readyState === WebSocket.OPEN) {
    room.boardWs.send(data);
  }
}

function getSanitizedPlayers(players) {
  if (!Array.isArray(players)) return [];
  return players.map(p => ({
    id: p.id,
    sessionToken: p.sessionToken,
    name: p.name,
    photo: p.photo || null,
    cash: p.cash,
    pos: p.pos,
    color: p.color,
    emoji: p.emoji,
    skipTurns: p.skipTurns,
    inHospital: p.inHospital || false,
    inJail: p.inJail || false,
    alive: p.alive,
    props: p.props || [],
    isHost: p.isHost,
    isConnected: p.isConnected !== false,
    reconnectAttemptsLeft: p.reconnectAttemptsLeft !== undefined ? p.reconnectAttemptsLeft : 3,
    consecutiveMissedTurns: p.consecutiveMissedTurns || 0
  }));
}

function removePlayerFromRoom(room, playerId, reason = 'Keluar dari permainan') {
  if (!room || !Array.isArray(room.players)) return;
  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx === -1) return;
  const removed = room.players[idx];

  // Lepas properti milik pemain kembali ke pasar
  if (room.tiles && Array.isArray(room.tiles)) {
    room.tiles.forEach(t => {
      if (t.owner === playerId) {
        t.owner = null;
        t.buildings = 0;
        t.isLandmark = false;
      }
    });
  }

  // Jika giliran pemain yang keluar, alihkan giliran ke pemain berikutnya
  const wasActive = (room.activePlayerIdx === idx);
  room.players.splice(idx, 1);

  if (room.players.length === 0 && !room.boardWs) {
    rooms.delete(room.code);
    return;
  }

  if (wasActive && room.players.length > 0) {
    room.activePlayerIdx = room.activePlayerIdx % room.players.length;
    room.isRolled = false;
  } else if (room.activePlayerIdx >= room.players.length && room.players.length > 0) {
    room.activePlayerIdx = 0;
  }

  broadcast(room, {
    type: 'PLAYER_LEFT',
    playerId: removed.id,
    playerName: removed.name,
    reason,
    players: getSanitizedPlayers(room.players),
    activePlayerIdx: room.activePlayerIdx,
    log: `🚪 ${removed.name} dikeluarkan (${reason}).`
  });
}

function getRoom(roomCode) {
  if (!roomCode) return null;
  return rooms.get(roomCode.toUpperCase().trim()) || null;
}

function createBoardRoom(roomCode, startingCash, tiles, ws) {
  const code = (roomCode || Math.random().toString(36).substring(2, 6)).toUpperCase().trim();
  const room = {
    code,
    boardWs: ws,
    status: 'LOBBY',
    startingCash: startingCash || UMR_JAKARTA,
    players: [],
    activePlayerIdx: 0,
    roundNumber: 1,
    tiles: tiles || null,
    isRolled: false,
    logs: [`Ruangan Papan ${code} dibuat (Mode Layar Laptop/TV Kahoot).`]
  };
  rooms.set(code, room);
  return room;
}

function deleteRoom(roomCode) {
  if (!roomCode) return false;
  return rooms.delete(roomCode.toUpperCase().trim());
}

module.exports = {
  rooms,
  broadcast,
  getSanitizedPlayers,
  removePlayerFromRoom,
  getRoom,
  createBoardRoom,
  deleteRoom
};
