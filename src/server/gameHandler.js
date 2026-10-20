const { UMR_JAKARTA } = require('../config');
const { PLAYER_COLORS, PLAYER_EMOJIS, GOBLIN_VALID_TILES, GOBLIN_REWARD } = require('../shared/constants');
const { broadcast, getSanitizedPlayers, removePlayerFromRoom, getRoom, createBoardRoom } = require('./roomManager');

function handleCreateBoardDisplay(ws, data, state, localIp, port) {
  let roomCode = (data.roomCode || '').toUpperCase().trim();
  let room = roomCode ? getRoom(roomCode) : null;

  if (!room) {
    room = createBoardRoom(roomCode, data.startingCash || UMR_JAKARTA, data.tiles || null, ws);
    roomCode = room.code;
  } else {
    // Reconnect board display
    room.boardWs = ws;
  }

  state.isBoardDisplay = true;
  state.currentRoom = room;

  ws.send(JSON.stringify({
    type: 'BOARD_ROOM_CREATED',
    roomCode,
    serverIp: localIp,
    port,
    startingCash: room.startingCash,
    players: getSanitizedPlayers(room.players),
    gameStatus: room.status,
    activePlayerIdx: room.activePlayerIdx,
    roundNumber: room.roundNumber,
    tiles: room.tiles
  }));
}

function handleJoinRoom(ws, data, state, localIp, port) {
  const roomCode = (data.roomCode || '').toUpperCase().trim();
  const room = getRoom(roomCode);

  if (!room) {
    ws.send(JSON.stringify({ type: 'ERROR', message: `Ruangan ${roomCode} tidak ditemukan!` }));
    return;
  }

  // Cek apakah reconnect menggunakan sessionToken
  if (data.sessionToken) {
    const existingPlayer = room.players.find(p => p.sessionToken === data.sessionToken);
    if (existingPlayer) {
      // Reconnect berhasil!
      existingPlayer.ws = ws;
      existingPlayer.isConnected = true;
      existingPlayer.reconnectAttemptsLeft = 3; // Reset counter saat berhasil konek lagi
      state.playerRecord = existingPlayer;
      state.currentRoom = room;

      ws.send(JSON.stringify({
        type: 'ROOM_JOINED',
        roomCode,
        playerId: existingPlayer.id,
        sessionToken: existingPlayer.sessionToken,
        isHost: existingPlayer.isHost,
        players: getSanitizedPlayers(room.players),
        activePlayerIdx: room.activePlayerIdx,
        roundNumber: room.roundNumber,
        gameStatus: room.status,
        tiles: room.tiles,
        goblinTile: room.goblinTile,
        logs: room.logs || [],
        serverIp: localIp,
        port
      }));

      broadcast(room, {
        type: 'PLAYER_RECONNECTED',
        playerId: existingPlayer.id,
        players: getSanitizedPlayers(room.players),
        tiles: room.tiles,
        goblinTile: room.goblinTile,
        logs: room.logs || [],
        log: `🟢 ${existingPlayer.name} berhasil tersambung kembali!`
      });
      return;
    }
  }

  if (room.status !== 'LOBBY') {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Permainan sudah dimulai!' }));
    return;
  }

  if (room.players.length >= 6) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Ruangan sudah penuh (maks 6 pemain)!' }));
    return;
  }

  const pId = room.players.length;
  const isHost = (pId === 0);
  const sessionToken = data.sessionToken || ('usr_' + Math.random().toString(36).substring(2, 10));

  const playerRecord = {
    id: pId,
    sessionToken,
    name: data.name || `Pemain ${pId + 1}`,
    photo: data.photo || null,
    cash: room.startingCash || UMR_JAKARTA,
    pos: 0,
    color: PLAYER_COLORS[pId] || '#cbd5e1',
    emoji: PLAYER_EMOJIS[pId] || '🙂',
    skipTurns: 0,
    inHospital: false,
    inJail: false,
    alive: true,
    props: [],
    isHost,
    isConnected: true,
    reconnectAttemptsLeft: 3,
    consecutiveMissedTurns: 0,
    ws
  };

  room.players.push(playerRecord);
  state.playerRecord = playerRecord;
  state.currentRoom = room;

  if (!room.logs) room.logs = [];
  const joinLog = `👋 ${playerRecord.name} bergabung ke permainan!`;
  room.logs.push(joinLog);
  if (room.logs.length > 50) room.logs.shift();

  ws.send(JSON.stringify({
    type: 'ROOM_JOINED',
    roomCode,
    playerId: pId,
    sessionToken,
    isHost,
    players: getSanitizedPlayers(room.players),
    tiles: room.tiles,
    goblinTile: room.goblinTile,
    logs: room.logs,
    serverIp: localIp,
    port
  }));

  broadcast(room, {
    type: 'LOBBY_UPDATE',
    players: getSanitizedPlayers(room.players),
    logs: room.logs,
    log: joinLog
  });
}

function handleStartGame(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom) return;
  if (currentRoom.players.length < 1) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Belum ada pemain yang bergabung!' }));
    return;
  }

  currentRoom.status = 'PLAYING';
  currentRoom.activePlayerIdx = 0;
  currentRoom.roundNumber = 1;
  currentRoom.isRolled = false;
  currentRoom.goblinTile = null;

  broadcast(currentRoom, {
    type: 'GAME_STARTED',
    activePlayerIdx: 0,
    roundNumber: 1,
    players: getSanitizedPlayers(currentRoom.players),
    tiles: currentRoom.tiles
  });
}

function handleDiceRolled(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom || currentRoom.status !== 'PLAYING') return;
  const pId = data.playerId !== undefined ? data.playerId : (state.playerRecord ? state.playerRecord.id : null);

  // Reset missed turns jika pemain berhasil lempar dadu
  const roller = currentRoom.players.find(p => p.id === pId);
  if (roller) roller.consecutiveMissedTurns = 0;

  if (pId !== currentRoom.activePlayerIdx) {
    if (ws) ws.send(JSON.stringify({ type: 'ERROR', message: 'Bukan giliranmu sekarang!' }));
    return;
  }

  if (currentRoom.isRolled) return;
  currentRoom.isRolled = true;

  // Rare Case Event: Kemunculan Goblin Pembawa Emas (+Rp 10.000.000)
  // Terjadi acak ~14% kemungkinan jika belum ada goblin aktif
  let goblinSpawned = null;
  if (!currentRoom.goblinTile && Math.random() < 0.14) {
    const validTiles = GOBLIN_VALID_TILES;
    const spawnPos = validTiles[Math.floor(Math.random() * validTiles.length)];
    currentRoom.goblinTile = spawnPos;
    goblinSpawned = spawnPos;
    const logMsg = `👺 GOBLIN EMAS MUNCUL di Petak #${spawnPos}! Mendaratlah di sana untuk merebut Rp 10.000.000!`;
    if (!currentRoom.logs) currentRoom.logs = [];
    currentRoom.logs.push(logMsg);
  }

  broadcast(currentRoom, {
    type: 'DICE_ANIMATION_START',
    playerId: pId,
    d1: data.d1,
    d2: data.d2,
    total: data.total,
    rollAgain: data.rollAgain || false,
    toJail: data.toJail || false,
    goblinTile: currentRoom.goblinTile,
    goblinSpawned
  });
}

function handlePlayerMissedTurn(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom || currentRoom.status !== 'PLAYING') return;
  const pId = data.playerId;
  const targetPlayer = currentRoom.players.find(p => p.id === pId);
  if (targetPlayer) {
    targetPlayer.consecutiveMissedTurns = (targetPlayer.consecutiveMissedTurns || 0) + 1;

    if (targetPlayer.consecutiveMissedTurns >= 3) {
      // Auto kick pemain karena 3x melewatkan giliran berturut-turut!
      removePlayerFromRoom(currentRoom, targetPlayer.id, 'AFK / 3x melewatkan giliran berturut-turut');
    } else {
      broadcast(currentRoom, {
        type: 'PLAYER_WARNING_AFK',
        playerId: targetPlayer.id,
        missedCount: targetPlayer.consecutiveMissedTurns,
        log: `⚠️ ${targetPlayer.name} melewatkan giliran (${targetPlayer.consecutiveMissedTurns}/3)!`
      });
    }
  }
}

function handleSyncState(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom) return;
  if (data.activePlayerIdx !== undefined) currentRoom.activePlayerIdx = data.activePlayerIdx;
  if (data.roundNumber !== undefined) currentRoom.roundNumber = data.roundNumber;
  if (data.isRolled !== undefined) currentRoom.isRolled = data.isRolled;
  if (data.gameState && data.gameState.tiles) currentRoom.tiles = data.gameState.tiles;
  if (data.gameState && data.gameState.players) {
    data.gameState.players.forEach(p => {
      const ep = currentRoom.players.find(x => x.id === p.id);
      if (ep) {
        ep.cash = p.cash;
        ep.pos = p.pos;
        ep.props = p.props;
        ep.alive = p.alive;
        ep.inHospital = p.inHospital;
        ep.inJail = p.inJail;
      }
    });
  }
  if (data.goblinTile !== undefined) {
    currentRoom.goblinTile = data.goblinTile;
  }

  if (data.eventText) {
    if (!currentRoom.logs) currentRoom.logs = [];
    currentRoom.logs.push(data.eventText);
    if (currentRoom.logs.length > 50) currentRoom.logs.shift();
  }

  broadcast(currentRoom, {
    type: 'STATE_UPDATED',
    gameState: {
      players: getSanitizedPlayers(currentRoom.players),
      tiles: currentRoom.tiles,
      goblinTile: currentRoom.goblinTile
    },
    eventText: data.eventText,
    logs: currentRoom.logs,
    senderId: state.playerRecord ? state.playerRecord.id : null
  });
}

function handleBuyProperty(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom) return;
  const pId = data.playerId !== undefined ? data.playerId : (state.playerRecord ? state.playerRecord.id : null);
  const buyer = currentRoom.players.find(p => p.id === pId);
  const tileIdx = data.tileIdx;

  if (buyer && currentRoom.tiles && currentRoom.tiles[tileIdx]) {
    const t = currentRoom.tiles[tileIdx];
    const actualCost = data.customPrice || t.price;

    // Proteksi: Saldo harus cukup (tidak boleh minus)
    if (buyer.cash < actualCost) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: `Saldo tidak mencukupi untuk membeli ${t.name}! Jual properti terlebih dahulu jika ada.`
      }));
      return;
    }

    const prevOwnerId = t.owner;
    const prevOwner = (prevOwnerId !== null && prevOwnerId !== undefined) ? currentRoom.players.find(x => x.id === prevOwnerId) : null;

    buyer.cash -= actualCost;
    t.owner = buyer.id;
    if (!buyer.props.includes(tileIdx)) buyer.props.push(tileIdx);

    let logText = '';
    if (prevOwner && prevOwner.id !== buyer.id) {
      prevOwner.cash += actualCost;
      const pIdx = prevOwner.props.indexOf(tileIdx);
      if (pIdx !== -1) prevOwner.props.splice(pIdx, 1);
      logText = `⚡ ${buyer.name} mengambil alih ${t.name} dari ${prevOwner.name} seharga Rp ${actualCost.toLocaleString('id-ID')}!`;
    } else {
      logText = `🏡 ${buyer.name} resmi membeli properti ${t.name}!`;
    }

    if (!currentRoom.logs) currentRoom.logs = [];
    currentRoom.logs.push(logText);
    if (currentRoom.logs.length > 50) currentRoom.logs.shift();

    broadcast(currentRoom, {
      type: 'PROPERTY_BOUGHT',
      playerId: pId,
      tileIdx,
      customPrice: data.customPrice,
      isTakeover: data.isTakeover || false,
      players: getSanitizedPlayers(currentRoom.players),
      tiles: currentRoom.tiles,
      logs: currentRoom.logs,
      logText
    });
  }
}

function handleBuildProperty(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom) return;
  const pId = data.playerId !== undefined ? data.playerId : (state.playerRecord ? state.playerRecord.id : null);
  const builder = currentRoom.players.find(p => p.id === pId);
  const tileIdx = data.tileIdx;

  if (builder && currentRoom.tiles && currentRoom.tiles[tileIdx]) {
    const t = currentRoom.tiles[tileIdx];
    if (builder.cash < t.build) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: `Saldo tidak cukup untuk upgrade ${t.name}! Jual properti lain terlebih dahulu.`
      }));
      return;
    }

    builder.cash -= t.build;
    t.buildings = (t.buildings || 0) + 1;
    let logText = '';
    if (t.buildings >= 3) {
      t.isLandmark = true;
      logText = `👑 ${builder.name} membangun LANDMARK di ${t.name}! Aset ini terlindungi permanen.`;
    } else {
      logText = `🏠 ${builder.name} meningkatkan level bangunan di ${t.name} (Tingkat ${t.buildings})!`;
    }

    if (!currentRoom.logs) currentRoom.logs = [];
    currentRoom.logs.push(logText);
    if (currentRoom.logs.length > 50) currentRoom.logs.shift();

    broadcast(currentRoom, {
      type: 'PROPERTY_BUILT',
      playerId: pId,
      tileIdx,
      players: getSanitizedPlayers(currentRoom.players),
      tiles: currentRoom.tiles,
      logs: currentRoom.logs,
      logText
    });
  }
}

function handleSellProperty(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom) return;
  const pId = data.playerId !== undefined ? data.playerId : (state.playerRecord ? state.playerRecord.id : null);
  const seller = currentRoom.players.find(p => p.id === pId);
  const tileIdx = data.tileIdx;

  if (seller && currentRoom.tiles && currentRoom.tiles[tileIdx]) {
    const t = currentRoom.tiles[tileIdx];
    t.owner = null;
    t.buildings = 0;
    t.isLandmark = false;
    seller.cash += data.sellPrice;
    const propIdx = seller.props.indexOf(tileIdx);
    if (propIdx !== -1) seller.props.splice(propIdx, 1);

    const logText = `🏷️ ${seller.name} menjual properti ${t.name} ke pasar seharga +Rp ${data.sellPrice.toLocaleString('id-ID')}!`;
    if (!currentRoom.logs) currentRoom.logs = [];
    currentRoom.logs.push(logText);
    if (currentRoom.logs.length > 50) currentRoom.logs.shift();

    broadcast(currentRoom, {
      type: 'PROPERTY_SOLD',
      playerId: pId,
      tileIdx,
      sellPrice: data.sellPrice,
      players: getSanitizedPlayers(currentRoom.players),
      tiles: currentRoom.tiles,
      logs: currentRoom.logs,
      logText
    });
  }
}

function handleClaimGoblin(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom) return;
  const pId = data.playerId !== undefined ? data.playerId : (state.playerRecord ? state.playerRecord.id : null);
  const claimer = currentRoom.players.find(p => p.id === pId);
  if (claimer && currentRoom.goblinTile !== null) {
    const reward = GOBLIN_REWARD;
    claimer.cash += reward;
    currentRoom.goblinTile = null;

    const logText = `👺💰 JACKPOT! ${claimer.name} menangkap GOBLIN EMAS dan merebut hadiah Rp 10.000.000!`;
    if (!currentRoom.logs) currentRoom.logs = [];
    currentRoom.logs.push(logText);
    if (currentRoom.logs.length > 50) currentRoom.logs.shift();

    broadcast(currentRoom, {
      type: 'GOBLIN_CLAIMED',
      playerId: pId,
      reward,
      players: getSanitizedPlayers(currentRoom.players),
      goblinTile: null,
      logs: currentRoom.logs,
      logText
    });
  }
}

function handleBankrupt(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom) return;
  const pId = data.playerId !== undefined ? data.playerId : (state.playerRecord ? state.playerRecord.id : null);
  const p = currentRoom.players.find(x => x.id === pId);
  if (p) {
    p.alive = false;
    p.cash = 0;
    // Lepas seluruh properti
    if (currentRoom.tiles) {
      currentRoom.tiles.forEach(t => {
        if (t.owner === pId) {
          t.owner = null;
          t.buildings = 0;
          t.isLandmark = false;
        }
      });
    }
    p.props = [];

    const logText = `💀 ${p.name} dinyatakan BANGKRUT! Seluruh asetnya dilelang kembali ke pasar.`;
    if (!currentRoom.logs) currentRoom.logs = [];
    currentRoom.logs.push(logText);
    if (currentRoom.logs.length > 50) currentRoom.logs.shift();

    broadcast(currentRoom, {
      type: 'PLAYER_BANKRUPTED',
      playerId: pId,
      players: getSanitizedPlayers(currentRoom.players),
      tiles: currentRoom.tiles,
      logs: currentRoom.logs,
      logText
    });
  }
}

function handleEndTurn(ws, data, state) {
  const currentRoom = state.currentRoom;
  if (!currentRoom) return;
  currentRoom.activePlayerIdx = data.nextPlayerIdx;
  currentRoom.roundNumber = data.roundNumber || currentRoom.roundNumber;
  currentRoom.isRolled = false;

  broadcast(currentRoom, {
    type: 'TURN_ENDED',
    nextPlayerIdx: data.nextPlayerIdx,
    roundNumber: data.roundNumber
  });
}

function handleLeaveRoom(ws, data, state) {
  if (state.currentRoom && state.playerRecord) {
    removePlayerFromRoom(state.currentRoom, state.playerRecord.id, 'Keluar secara manual');
  }
}

function handleDisconnect(ws, state) {
  const currentRoom = state.currentRoom;
  const playerRecord = state.playerRecord;
  const isBoardDisplay = state.isBoardDisplay;

  if (currentRoom) {
    if (isBoardDisplay) {
      currentRoom.boardWs = null;
    }
    if (playerRecord) {
      playerRecord.isConnected = false;
      playerRecord.ws = null;

      // Kurangi kesempatan reconnect (maksimal 3x)
      playerRecord.reconnectAttemptsLeft = (playerRecord.reconnectAttemptsLeft !== undefined ? playerRecord.reconnectAttemptsLeft : 3) - 1;

      if (currentRoom.status === 'LOBBY' || playerRecord.reconnectAttemptsLeft <= 0) {
        // Jika masih di lobby atau jatah 3x reconnect sudah habis -> keluarkan dari room
        const reason = playerRecord.reconnectAttemptsLeft <= 0 ? 'Gagal Reconnect 3x' : 'Keluar dari Lobby';
        removePlayerFromRoom(currentRoom, playerRecord.id, reason);
      } else {
        // Status PLAYING: beri toleransi reconnect
        broadcast(currentRoom, {
          type: 'PLAYER_DISCONNECTED',
          playerId: playerRecord.id,
          playerName: playerRecord.name,
          attemptsLeft: playerRecord.reconnectAttemptsLeft,
          players: getSanitizedPlayers(currentRoom.players),
          log: `🟡 ${playerRecord.name} terputus (Sisa jatah reconnect: ${playerRecord.reconnectAttemptsLeft}x)`
        });
      }
    }
  }
}

module.exports = {
  handleCreateBoardDisplay,
  handleJoinRoom,
  handleStartGame,
  handleDiceRolled,
  handlePlayerMissedTurn,
  handleSyncState,
  handleBuyProperty,
  handleBuildProperty,
  handleSellProperty,
  handleClaimGoblin,
  handleBankrupt,
  handleEndTurn,
  handleLeaveRoom,
  handleDisconnect
};
