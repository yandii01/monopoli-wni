// =========================================================================
// WEBSOCKET CLIENT & NETWORK EVENT ROUTING
// =========================================================================

function getWsUrl() {
  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = loc.host || 'localhost:3000';
  return `${protocol}//${host}`;
}

function connectSocket(onOpen) {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    if (onOpen) onOpen();
    return;
  }

  wsClient = new WebSocket(getWsUrl());
  wsClient.onopen = () => {
    if (onOpen) onOpen();
  };
  wsClient.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleIncomingWsMessage(msg);
    } catch (e) {
      console.error(e);
    }
  };
  wsClient.onerror = () => {
    showNotification('Gagal Konek LAN', 'Pastikan "node server.js" aktif di port 3000!', 'danger', '⚠️');
  };
}

function sendWs(data) {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify(data));
  }
}

function confirmLeaveRoom() {
  if (confirm('Apakah kamu yakin ingin keluar dari ruangan?')) {
    localStorage.removeItem('monopoli_wni_session');
    sendWs({ type: 'LEAVE_ROOM', playerId: myPlayerId });
    setTimeout(() => {
      window.location.reload();
    }, 200);
  }
}

function startBoardDisplayRoom(savedRoomCode = null) {
  currentAppRole = 'laptop';
  connectSocket(() => {
    sendWs({
      type: 'CREATE_BOARD_DISPLAY',
      roomCode: savedRoomCode || undefined,
      startingCash: UMR_JAKARTA,
      tiles: tiles
    });
  });
}

function initBoardScreen(roomCode, serverIp, port) {
  currentRoomCode = roomCode;
  localStorage.setItem('monopoli_wni_session', JSON.stringify({
    role: 'laptop',
    roomCode: roomCode
  }));

  document.getElementById('setupAppWrap').classList.add('hidden');
  document.getElementById('boardDisplayScreen').classList.remove('hidden');
  document.body.classList.add('display-mode');

  document.getElementById('boardBigRoomPin').textContent = roomCode;
  document.getElementById('boardHostIp').textContent = `${serverIp}:${port}`;

  build36GridTiles();
  renderLaptopGlobalHistoryUI();
  showNotification('Ruangan Siap!', `Silakan scan/buka di HP dan ketik PIN: ${roomCode}`, 'success', '📺', 6000);
}

function broadcastStartGame() {
  if (players.length < 1) {
    alert('Minimal 1 pemain harus join dari HP untuk memulai!');
    return;
  }
  sendWs({ type: 'START_GAME' });
}

function joinAsMobilePlayer(savedSession = null) {
  currentAppRole = 'mobile';
  let roomCode, name, photo, sessionToken;

  if (savedSession) {
    roomCode = savedSession.roomCode;
    name = savedSession.name;
    photo = savedSession.photo;
    sessionToken = savedSession.sessionToken;
    if (photo) myMobilePhoto = photo;
  } else {
    roomCode = document.getElementById('joinRoomCode').value.trim();
    name = document.getElementById('joinPlayerName').value.trim() || 'Warga HP';
    photo = myMobilePhoto;
    sessionToken = 'usr_' + Math.random().toString(36).substring(2, 10);
  }

  if (!roomCode) {
    alert('Masukkan kode ruangan dari layar laptop!');
    return;
  }

  currentRoomCode = roomCode;

  connectSocket(() => {
    sendWs({
      type: 'JOIN_ROOM',
      roomCode,
      name,
      photo,
      sessionToken
    });
  });
}

// =========================================================================
// HANDLER PESAN WEBSOCKET DARI SERVER
// =========================================================================
function handleIncomingWsMessage(msg) {
  if (msg.type === 'BOARD_ROOM_CREATED') {
    initBoardScreen(msg.roomCode, msg.serverIp, msg.port);
    if (msg.players && msg.players.length > 0) players = msg.players;
    if (msg.tiles) tiles = msg.tiles;
    if (msg.activePlayerIdx !== undefined) activePlayerIdx = msg.activePlayerIdx;
    if (msg.roundNumber !== undefined) roundNumber = msg.roundNumber;
    updateBoardTokensAndOwners();
  }

  else if (msg.type === 'ROOM_JOINED') {
    if (msg.players && msg.players.length > 0) players = msg.players;
    if (msg.tiles) tiles = msg.tiles;
    if (msg.activePlayerIdx !== undefined) activePlayerIdx = msg.activePlayerIdx;
    if (msg.roundNumber !== undefined) roundNumber = msg.roundNumber;
    if (msg.goblinTile !== undefined) activeGoblinTile = msg.goblinTile;
    if (msg.logs && Array.isArray(msg.logs)) {
      globalActivityLogs = [...msg.logs].reverse();
      renderLaptopGlobalHistoryUI();
    }
    const p = (players && players.find(x => x.id === msg.playerId)) || {};
    initMobileController(msg.playerId, p.name || document.getElementById('joinPlayerName').value, p.photo || myMobilePhoto, p.cash !== undefined ? p.cash : UMR_JAKARTA, msg.sessionToken);
  }

  else if (msg.type === 'PLAYER_RECONNECTED') {
    players = msg.players;
    if (msg.tiles) tiles = msg.tiles;
    if (msg.goblinTile !== undefined) activeGoblinTile = msg.goblinTile;
    if (msg.logs && Array.isArray(msg.logs)) {
      globalActivityLogs = [...msg.logs].reverse();
      renderLaptopGlobalHistoryUI();
    }
    if (currentAppRole === 'laptop') {
      updateBoardTokensAndOwners();
      showNotification('Pemain Tersambung Kembali', msg.log || 'Pemain online lagi!', 'info', '🟢');
      if (msg.log) addGlobalActivityLog(msg.log);
    }
    if (currentAppRole === 'mobile') {
      updateMobileTurnStatus();
      updateMyPropertyListUI();
      if (msg.playerId === myPlayerId) {
        addPersonalActivityLog('🟢 Koneksi pulih kembali ke dalam sesi permainan!');
      }
    }
  }

  else if (msg.type === 'PLAYER_DISCONNECTED') {
    players = msg.players;
    if (msg.log) addGlobalActivityLog(msg.log);
    if (currentAppRole === 'laptop') {
      updateBoardTokensAndOwners();
      showNotification('Pemain Terputus (DC)', msg.log || 'Pemain kehilangan koneksi!', 'warning', '🔌');
    }
  }

  else if (msg.type === 'PLAYER_WARNING_AFK') {
    if (currentAppRole === 'mobile' && msg.playerId === myPlayerId) {
      showBigAlert('⚠️ PERINGATAN AFK!', msg.message, '⚠️');
      addPersonalActivityLog('⚠️ Kamu menerima peringatan AFK karena melewatkan giliran!');
    }
    if (currentAppRole === 'laptop') {
      showNotification('Peringatan AFK', msg.message, 'warning', '⏳');
      addGlobalActivityLog(`⏳ ${msg.message}`);
    }
  }

  else if (msg.type === 'ROOM_LEFT') {
    if (msg.log) addGlobalActivityLog(msg.log);
    if (currentAppRole === 'mobile' && msg.playerId === myPlayerId) {
      localStorage.removeItem('monopoli_wni_session');
      showBigAlert('Dikeluarkan dari Ruangan', msg.reason || 'Kamu telah dikeluarkan dari ruangan.', '🚪');
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    }
  }

  else if (msg.type === 'LOBBY_UPDATE') {
    players = msg.players;
    if (msg.logs && Array.isArray(msg.logs)) {
      globalActivityLogs = [...msg.logs].reverse();
      renderLaptopGlobalHistoryUI();
    } else if (msg.log) {
      addGlobalActivityLog(msg.log);
    }
    if (currentAppRole === 'laptop') {
      updateBoardTokensAndOwners();
      showNotification('Pemain Bergabung!', msg.log || 'Warga baru siap bermain!', 'info', '👋');
    }
  }

  else if (msg.type === 'GAME_STARTED') {
    isGameStarted = true;
    players = msg.players;
    if (msg.tiles) tiles = msg.tiles;
    activePlayerIdx = msg.activePlayerIdx || 0;
    roundNumber = msg.roundNumber || 1;

    const pinBox = document.getElementById('kahootPinBox');
    if (pinBox) pinBox.style.display = 'none';

    const startBtn = document.getElementById('boardStartGameBtn');
    if (startBtn) startBtn.style.display = 'none';

    addGlobalActivityLog('🚀 Permainan Monopoli 5 Pulau Nusantara resmi dimulai!');

    if (currentAppRole === 'mobile') {
      updateMobileTurnStatus();
      updateMyPropertyListUI();
      addPersonalActivityLog('🚀 Permainan resmi dimulai! Bersiaplah melempar dadu.');
      showBigAlert('PERMAINAN DIMULAI!', 'Permainan Monopoli 5 Pulau Nusantara resmi dimulai! Perhatikan giliranmu melangkah.', '🚀');
    } else {
      updateBoardTokensAndOwners();
      showNotification('Game Dimulai!', `Permainan 5 Pulau Nusantara dimulai! Giliran ${players[activePlayerIdx].name}.`, 'success', '🚀');
    }

    startTurnTimer();
  }

  else if (msg.type === 'DICE_ANIMATION_START') {
    const p = players.find(x => x.id === msg.playerId);
    if (msg.goblinTile !== undefined) {
      activeGoblinTile = msg.goblinTile;
      if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
    }
    if (msg.goblinSpawned !== null && msg.goblinSpawned !== undefined) {
      const gTile = tiles[msg.goblinSpawned];
      const gName = gTile ? gTile.name : `Petak #${msg.goblinSpawned}`;
      const goblinText = `👺 GOBLIN EMAS MUNCUL di ${gName}! Mendaratlah untuk klaim Rp 10.000.000!`;
      addGlobalActivityLog(goblinText);
      showNotification('GOBLIN EMAS MUNCUL!', `👺 Goblin membawa karung emas muncul di ${gName}! Mendaratlah di sana untuk klaim Rp 10.000.000!`, 'warning', '👺💰', 8000);
      if (currentAppRole === 'mobile') {
        addPersonalActivityLog(`👺 Kabar Angin: Goblin Emas terlihat membawa karung di ${gName}!`);
      }
    }
    if (p) {
      setBoardDice(msg.d1, msg.d2);
      animateStepByStep(p, msg.total, msg.rollAgain, msg.toJail);
    }
  }

  else if (msg.type === 'PROPERTY_BOUGHT') {
    if (msg.players) players = msg.players;
    if (msg.tiles) tiles = msg.tiles;
    if (msg.logs && Array.isArray(msg.logs)) {
      globalActivityLogs = [...msg.logs].reverse();
      renderLaptopGlobalHistoryUI();
    } else if (msg.logText) {
      addGlobalActivityLog(msg.logText);
    }

    const boughtTile = tiles[msg.tileIdx];
    const tileName = boughtTile ? boughtTile.name : 'Properti';
    if (currentAppRole === 'mobile') {
      if (msg.playerId === myPlayerId) {
        if (msg.isTakeover) {
          addPersonalActivityLog(`⚡ Kamu berhasil mengambil alih kepemilikan ${tileName}!`);
        } else {
          addPersonalActivityLog(`🏡 Kamu resmi membeli properti ${tileName}!`);
        }
      }
      updateMobileTurnStatus();
      updateMyPropertyListUI();
    }

    showNotification('Aset Terbeli/Diambil Alih', msg.logText || 'Transaksi properti berhasil!', 'success', '🏡');
    if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
  }

  else if (msg.type === 'PROPERTY_BUILT') {
    if (msg.players) players = msg.players;
    if (msg.tiles) tiles = msg.tiles;
    if (msg.logs && Array.isArray(msg.logs)) {
      globalActivityLogs = [...msg.logs].reverse();
      renderLaptopGlobalHistoryUI();
    } else if (msg.logText) {
      addGlobalActivityLog(msg.logText);
    }

    const builtTile = tiles[msg.tileIdx];
    const tileName = builtTile ? builtTile.name : 'Properti';
    if (currentAppRole === 'mobile') {
      if (msg.playerId === myPlayerId) {
        if (builtTile && builtTile.isLandmark) {
          addPersonalActivityLog(`👑 Kamu membangun LANDMARK di ${tileName}! Aset kini aman permanen.`);
        } else {
          addPersonalActivityLog(`🏠 Kamu meningkatkan level bangunan di ${tileName}!`);
        }
      }
      updateMobileTurnStatus();
      updateMyPropertyListUI();
    }

    showNotification('Bangunan Ditingkatkan', msg.logText || 'Aset berhasil diupgrade!', 'success', '🏠');
    if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
  }

  else if (msg.type === 'PROPERTY_SOLD') {
    if (msg.players) players = msg.players;
    if (msg.tiles) tiles = msg.tiles;
    if (msg.logs && Array.isArray(msg.logs)) {
      globalActivityLogs = [...msg.logs].reverse();
      renderLaptopGlobalHistoryUI();
    } else if (msg.logText) {
      addGlobalActivityLog(msg.logText);
    }

    const soldTile = tiles[msg.tileIdx];
    const tileName = soldTile ? soldTile.name : 'Properti';
    if (currentAppRole === 'mobile') {
      if (msg.playerId === myPlayerId) {
        addPersonalActivityLog(`🏷️ Kamu menjual aset ${tileName} ke pasar (+${formatKoin(msg.sellPrice)}).`);
      }
      updateMobileTurnStatus();
      updateMyPropertyListUI();
    }

    showNotification('Aset Dijual ke Pasar', msg.logText || 'Aset telah dicairkan!', 'warning', '🏷️');
    if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
  }

  else if (msg.type === 'GOBLIN_CLAIMED') {
    activeGoblinTile = null;
    if (msg.players) players = msg.players;
    if (msg.logs && Array.isArray(msg.logs)) {
      globalActivityLogs = [...msg.logs].reverse();
      renderLaptopGlobalHistoryUI();
    } else if (msg.logText) {
      addGlobalActivityLog(msg.logText);
    }

    if (currentAppRole === 'mobile') {
      if (msg.playerId === myPlayerId) {
        addPersonalActivityLog(`👺💰 REZEKI NOMPLOK! Kamu berhasil menangkap Goblin Emas (+Rp 10.000.000)!`);
      }
      updateMobileTurnStatus();
      updateMyPropertyListUI();
    }

    showNotification('Harta Karun Terambil!', msg.logText || 'Pemain berhasil menangkap Goblin Emas!', 'success', '👺💰', 7000);
    if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
  }

  else if (msg.type === 'PLAYER_BANKRUPTED') {
    if (msg.players) players = msg.players;
    if (msg.tiles) tiles = msg.tiles;
    if (msg.logs && Array.isArray(msg.logs)) {
      globalActivityLogs = [...msg.logs].reverse();
      renderLaptopGlobalHistoryUI();
    } else if (msg.logText) {
      addGlobalActivityLog(msg.logText);
    }

    if (currentAppRole === 'mobile') {
      if (msg.playerId === myPlayerId) {
        addPersonalActivityLog(`💀 Kamu dinyatakan BANGKRUT dan tereliminasi dari permainan.`);
      }
      updateMobileTurnStatus();
      updateMyPropertyListUI();
    }

    showNotification('Pemain Bangkrut!', msg.logText || 'Seorang pemain telah bangkrut!', 'danger', '💀', 7000);
    if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
  }

  else if (msg.type === 'STATE_UPDATED') {
    if (msg.gameState) {
      if (msg.gameState.players) players = msg.gameState.players;
      if (msg.gameState.tiles) tiles = msg.gameState.tiles;
      if (msg.gameState.goblinTile !== undefined) activeGoblinTile = msg.gameState.goblinTile;
    }
    if (msg.logs && Array.isArray(msg.logs)) {
      globalActivityLogs = [...msg.logs].reverse();
      renderLaptopGlobalHistoryUI();
    } else if (msg.eventText) {
      addGlobalActivityLog(msg.eventText);
    }
    if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
    if (currentAppRole === 'mobile') {
      updateMobileTurnStatus();
      updateMyPropertyListUI();
    }
    startTurnTimer();
  }

  else if (msg.type === 'TURN_ENDED') {
    activePlayerIdx = msg.nextPlayerIdx;
    roundNumber = msg.roundNumber;

    if (currentAppRole === 'laptop') {
      updateBoardTokensAndOwners();
      const banner = document.getElementById('boardStatusBanner');
      if (banner && players[activePlayerIdx]) {
        banner.textContent = `Sekarang giliran: ${players[activePlayerIdx].name}`;
      }
    }

    if (currentAppRole === 'mobile') {
      updateMobileTurnStatus();
      updateMyPropertyListUI();
      if (activePlayerIdx === myPlayerId) {
        addPersonalActivityLog(`🎲 Giliranmu sekarang! Ayo lempar dadu.`);
      }
    }

    startTurnTimer();
  }

  else if (msg.type === 'ERROR') {
    showNotification('Peringatan', msg.message, 'warning', '⚠️');
  }
}
