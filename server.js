const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer, WebSocket } = require('ws');

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

const localIp = getLocalIp();

// Static file server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '/index.html') {
    reqPath = '/wni_simulator.html';
  }

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(content);
    }
  });
});

const wss = new WebSocketServer({ server });

// Room management
// rooms = Map<roomCode, RoomObject>
const rooms = new Map();

function broadcast(room, msgObj) {
  const data = JSON.stringify(msgObj);
  // Kirim ke semua pemain yang terkoneksi
  room.players.forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  });
  // Kirim ke Board Display (Layar Laptop/TV) jika ada
  if (room.boardWs && room.boardWs.readyState === WebSocket.OPEN) {
    room.boardWs.send(data);
  }
}

function getSanitizedPlayers(players) {
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
    props: p.props,
    isHost: p.isHost,
    isConnected: p.isConnected !== false,
    reconnectAttemptsLeft: p.reconnectAttemptsLeft !== undefined ? p.reconnectAttemptsLeft : 3,
    consecutiveMissedTurns: p.consecutiveMissedTurns || 0
  }));
}

function removePlayerFromRoom(room, playerId, reason = 'Keluar dari permainan') {
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

wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerRecord = null;
  let isBoardDisplay = false;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // 1. LAPTOP SEBAGAI PAPAN DISPLAY UTAMA (BOARD SCREEN)
      if (data.type === 'CREATE_BOARD_DISPLAY') {
        let roomCode = (data.roomCode || '').toUpperCase().trim();
        let room = roomCode ? rooms.get(roomCode) : null;

        if (!room) {
          roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
          room = {
            code: roomCode,
            boardWs: ws,
            status: 'LOBBY',
            startingCash: data.startingCash || UMR_JAKARTA,
            players: [],
            activePlayerIdx: 0,
            roundNumber: 1,
            tiles: data.tiles || null,
            isRolled: false,
            logs: [`Ruangan Papan ${roomCode} dibuat (Mode Layar Laptop/TV Kahoot).`]
          };
          rooms.set(roomCode, room);
        } else {
          // Reconnect board display
          room.boardWs = ws;
        }

        isBoardDisplay = true;
        currentRoom = room;

        ws.send(JSON.stringify({
          type: 'BOARD_ROOM_CREATED',
          roomCode,
          serverIp: localIp,
          port: PORT,
          startingCash: room.startingCash,
          players: getSanitizedPlayers(room.players),
          gameStatus: room.status,
          activePlayerIdx: room.activePlayerIdx,
          roundNumber: room.roundNumber,
          tiles: room.tiles
        }));
      }

      // 2. JOIN ROOM (DARI HP / CONTROLLER)
      else if (data.type === 'JOIN_ROOM') {
        const roomCode = (data.roomCode || '').toUpperCase().trim();
        const room = rooms.get(roomCode);

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
            playerRecord = existingPlayer;
            currentRoom = room;

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
              port: PORT
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

        const colors = ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];
        const emojis = ['🧑', '👩', '🧔', '👩‍🦱', '🧑‍💻', '🧕'];
        const pId = room.players.length;
        const isHost = (pId === 0);
        const sessionToken = data.sessionToken || ('usr_' + Math.random().toString(36).substring(2, 10));

        playerRecord = {
          id: pId,
          sessionToken,
          name: data.name || `Pemain ${pId + 1}`,
          photo: data.photo || null,
          cash: room.startingCash || UMR_JAKARTA,
          pos: 0,
          color: colors[pId] || '#cbd5e1',
          emoji: emojis[pId] || '🙂',
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
        currentRoom = room;

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
          port: PORT
        }));

        broadcast(room, {
          type: 'LOBBY_UPDATE',
          players: getSanitizedPlayers(room.players),
          logs: room.logs,
          log: joinLog
        });
      }

      // 3. START GAME
      else if (data.type === 'START_GAME') {
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

      // 4. DICE ROLLED
      else if (data.type === 'DICE_ROLLED') {
        if (!currentRoom || currentRoom.status !== 'PLAYING') return;
        const pId = data.playerId !== undefined ? data.playerId : (playerRecord ? playerRecord.id : null);
        
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
        // Terjadi acak ~12% kemungkinan jika belum ada goblin aktif
        let goblinSpawned = null;
        if (!currentRoom.goblinTile && Math.random() < 0.14) {
          // Pilih petak selain petak sudut (bukan 0, 9, 18, 27)
          const validTiles = [1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,17,19,20,21,22,23,24,25,26,28,29,30,31,32,33,34,35];
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
          goblinSpawned: goblinSpawned
        });
      }

      // 5. PLAYER MISSED TURN (AUTO KICK JIKA 3 KALI KOSONG)
      else if (data.type === 'PLAYER_MISSED_TURN') {
        if (!currentRoom || currentRoom.status !== 'PLAYING') return;
        const pId = data.playerId;
        const targetPlayer = currentRoom.players.find(p => p.id === pId);
        if (targetPlayer) {
          targetPlayer.consecutiveMissedTurns = (targetPlayer.consecutiveMissedTurns || 0) + 1;
          
          if (targetPlayer.consecutiveMissedTurns >= 3) {
            // Auto kick pemain karena 3x melewatkan giliran berturut-turut!
            removePlayerFromRoom(currentRoom, targetPlayer.id, 'AFK / 3x melewatkan giliran berturut-turut');
            return;
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

      // 6. SYNC STATE & EVENTS
      else if (data.type === 'SYNC_STATE') {
        if (!currentRoom) return;
        if (data.activePlayerIdx !== undefined) currentRoom.activePlayerIdx = data.activePlayerIdx;
        if (data.roundNumber !== undefined) currentRoom.roundNumber = data.roundNumber;
        if (data.isRolled !== undefined) currentRoom.isRolled = data.isRolled;
        if (data.gameState && data.gameState.tiles) currentRoom.tiles = data.gameState.tiles;
        if (data.gameState && data.gameState.players) {
          // Sinkronisasi data pemain jika dikirim
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
          senderId: playerRecord ? playerRecord.id : null
        });
      }

      // 7. ACTIONS (BUY, BUILD, SELL, CLAIM GOBLIN, END TURN)
      else if (data.type === 'ACTION_BUY_PROPERTY') {
        if (!currentRoom) return;
        const pId = data.playerId !== undefined ? data.playerId : playerRecord.id;
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

      else if (data.type === 'ACTION_BUILD_PROPERTY') {
        if (!currentRoom) return;
        const pId = data.playerId !== undefined ? data.playerId : playerRecord.id;
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

      else if (data.type === 'ACTION_SELL_PROPERTY') {
        if (!currentRoom) return;
        const pId = data.playerId !== undefined ? data.playerId : playerRecord.id;
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

      // REBUT GOBLIN EMAS
      else if (data.type === 'ACTION_CLAIM_GOBLIN') {
        if (!currentRoom) return;
        const pId = data.playerId !== undefined ? data.playerId : playerRecord.id;
        const claimer = currentRoom.players.find(p => p.id === pId);
        if (claimer && currentRoom.goblinTile !== null) {
          const reward = 10000000; // Rp 10.000.000
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

      // KLAIM BANGKRUT RESMI
      else if (data.type === 'ACTION_BANKRUPT') {
        if (!currentRoom) return;
        const pId = data.playerId !== undefined ? data.playerId : playerRecord.id;
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

      else if (data.type === 'ACTION_END_TURN') {
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

      // 8. KELUAR RUANGAN SECARA EKSPLISIT DARI TOMBOL "KELUAR"
      else if (data.type === 'LEAVE_ROOM') {
        if (currentRoom && playerRecord) {
          removePlayerFromRoom(currentRoom, playerRecord.id, 'Keluar secara manual');
        }
      }

    } catch (e) {
      console.error('Socket message parse error:', e);
    }
  });

  ws.on('close', () => {
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
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🎮 MONOPOLI WNI MULTIPLAYER SERVER (KAHOOT STYLE)`);
  console.log(`📍 Layar Laptop:  http://localhost:${PORT}`);
  console.log(`📱 Main via HP:   http://${localIp}:${PORT}`);
  console.log(`💰 Saldo Awal:    Rp ${UMR_JAKARTA.toLocaleString('id-ID')} (UMR DKI Jakarta)`);
  console.log(`====================================================`);
});
