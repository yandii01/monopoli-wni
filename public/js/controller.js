// =========================================================================
// MOBILE CONTROLLER INTERACTION & EMERGENCY SELL SYSTEM
// =========================================================================

function switchSetupTab(tab) {
  document.getElementById('tabLaptopMode').classList.toggle('active', tab === 'laptop');
  document.getElementById('tabMobileMode').classList.toggle('active', tab === 'mobile');

  document.getElementById('panelLaptopView').classList.toggle('hidden', tab !== 'laptop');
  document.getElementById('panelMobileView').classList.toggle('hidden', tab !== 'mobile');
}

function initMobileController(playerId, name, photo, cash, sessionToken) {
  myPlayerId = playerId;
  localStorage.setItem('monopoli_wni_session', JSON.stringify({
    role: 'mobile',
    roomCode: currentRoomCode,
    playerId: playerId,
    name: name,
    photo: photo || null,
    sessionToken: sessionToken
  }));

  document.getElementById('setupAppWrap').classList.add('hidden');
  document.getElementById('mobileControllerScreen').classList.remove('hidden');

  document.getElementById('myMobileName').textContent = name;
  document.getElementById('myMobileCash').textContent = formatKoin(cash);
  if (photo) {
    document.getElementById('myMobileAvatar').innerHTML = `<img src="${photo}">`;
  }

  showBigAlert('Tersambung ke Permainan!', 'Selamat datang! Awasi layar laptop/TV untuk melihat peta monopoli dan bersiaplah saat giliranmu tiba.', '📱');
  updateMobileTurnStatus();
  updateMyPropertyListUI();
  if (myPersonalActivityLogs.length === 0) {
    addPersonalActivityLog(`👋 Kamu (${name}) berhasil masuk ke dalam ruangan permainan!`);
  } else {
    renderMobilePersonalHistoryUI();
  }
}

function updateMobileTurnStatus() {
  if (myPlayerId < 0 || !players[myPlayerId]) return;
  const isMyTurn = (activePlayerIdx === myPlayerId);
  const p = players[myPlayerId];

  document.getElementById('myMobileCash').textContent = formatKoin(p.cash);
  const badge = document.getElementById('myTurnBadge');
  const rollBtn = document.getElementById('mobileRollBtn');

  if (isMyTurn) {
    badge.textContent = '🌟 GILIRAN KAMU SEKARANG!';
    badge.style.color = 'var(--accent-green)';
    rollBtn.disabled = false;
    rollBtn.classList.remove('secondary');
    rollBtn.classList.add('primary');
  } else {
    const currentActivePlayer = players[activePlayerIdx] ? players[activePlayerIdx].name : 'Pemain lain';
    badge.textContent = `⏳ GILIRAN: ${currentActivePlayer}`;
    badge.style.color = 'var(--text-muted)';
    rollBtn.disabled = true;
    rollBtn.classList.remove('primary');
    rollBtn.classList.add('secondary');
  }

  if (tiles[p.pos]) {
    document.getElementById('myCurrentTileText').textContent = `${tiles[p.pos].emoji} ${tiles[p.pos].name}`;
    document.getElementById('myIslandRegionText').textContent = `Wilayah: Pulau ${tiles[p.pos].island}`;
  }
}

function updateMyPropertyListUI() {
  const myP = players[myPlayerId];
  if (!myP) return;

  const countEl = document.getElementById('myPropsCount');
  const quickList = document.getElementById('myPropsQuickList');
  if (!countEl || !quickList) return;

  countEl.textContent = (myP.props || []).length;

  if (!myP.props || myP.props.length === 0) {
    quickList.innerHTML = 'Belum memiliki aset properti.';
    return;
  }

  quickList.innerHTML = myP.props.map(idx => {
    const t = tiles[idx];
    if (!t) return '';
    const statusText = t.isLandmark ? '👑 LANDMARK' : `${'🏠'.repeat(t.buildings) || 'Tanah'}`;
    return `<div style="padding:2px 0;">• ${t.emoji} <b>${t.name}</b> (${statusText})</div>`;
  }).join('');
}

function renderMobilePersonalHistoryUI() {
  const listEl = document.getElementById('mobileHistoryList');
  if (!listEl) return;
  if (myPersonalActivityLogs.length === 0) {
    listEl.innerHTML = '<div class="history-feed-item">Belum ada aktivitas pribadimu. Bersiaplah melempar dadu saat giliranmu tiba!</div>';
    return;
  }
  listEl.innerHTML = myPersonalActivityLogs.map(item => `
    <div class="history-feed-item">${item}</div>
  `).join('');
}

function openEmergencySellModal(requiredAmount = 0) {
  const myP = players[myPlayerId];
  if (!myP) return;

  const listEl = document.getElementById('emergencyPropertyList');
  const descEl = document.getElementById('emergencySellDesc');
  const modal = document.getElementById('emergencySellModal');

  if (requiredAmount > 0) {
    descEl.innerHTML = `Kamu membutuhkan dana tunai sebesar <b style="color:var(--accent-red)">${formatKoin(requiredAmount)}</b> untuk membayar tagihan. Pilih properti yang ingin dijual ke pasar (dihargai 80% dari total investasi):`;
  } else {
    descEl.textContent = `Pilih properti yang ingin kamu cairkan menjadi dana tunai Rupiah (dihargai 80% dari harga beli & bangunan):`;
  }

  if (!myP.props || myP.props.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:10px;">Kamu tidak memiliki aset untuk dijual!</div>';
  } else {
    listEl.innerHTML = myP.props.map(pIdx => {
      const t = tiles[pIdx];
      if (!t) return '';
      // Harga jual = 80% dari (harga beli + biaya bangunan)
      const invested = t.price + (t.build * t.buildings);
      const sellPrice = Math.floor(invested * 0.8);
      const landmarkBadge = t.isLandmark ? '👑 Landmark' : `Rumah: ${t.buildings}`;

      return `
        <div class="my-property-item">
          <div>
            <b>${t.emoji} ${t.name}</b>
            <div style="font-size:11px; color:var(--text-muted);">${landmarkBadge}</div>
          </div>
          <button class="warning" style="padding:6px 10px; font-size:11px;" onclick="sellProperty(${pIdx}, ${sellPrice})">
            Jual +${formatKoin(sellPrice)}
          </button>
        </div>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
}

function closeEmergencyModal() {
  const modal = document.getElementById('emergencySellModal');
  if (modal) modal.classList.add('hidden');
}

function sellProperty(tileIdx, sellPrice) {
  sendWs({
    type: 'ACTION_SELL_PROPERTY',
    playerId: myPlayerId,
    tileIdx,
    sellPrice
  });

  closeEmergencyModal();
}

function declareBankruptcy() {
  closeEmergencyModal();
  showBigAlert('BANGKRUT!', 'Kamu telah menyatakan bangkrut! Semua aset propertimu dilepaskan kembali ke pasar.', '💀');
  
  sendWs({
    type: 'ACTION_BANKRUPT',
    playerId: myPlayerId
  });

  setTimeout(() => {
    endTurnAuto();
  }, 1000);
}

function onMobileRollClick() {
  if (activePlayerIdx !== myPlayerId) {
    showNotification('Bukan Giliranmu!', 'Tunggu giliran pemain lain selesai.', 'warning', '⏳');
    return;
  }

  clearInterval(turnTimerInterval);
  const rollBtn = document.getElementById('mobileRollBtn');
  if (rollBtn) rollBtn.disabled = true;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2;

  let rollAgain = false;
  let toJail = false;

  // RULE DADU 12 JALAN LAGI, 3X BERTURUT-TURUT MASUK PENJARA
  if (total === 12) {
    doubleCount++;
    if (doubleCount >= 3) {
      toJail = true;
      doubleCount = 0;
      rollAgain = false;
    } else {
      rollAgain = true;
    }
  } else {
    doubleCount = 0;
  }

  sendWs({
    type: 'DICE_ROLLED',
    playerId: myPlayerId,
    d1, d2, total,
    rollAgain,
    toJail
  });
}

function onMobileDecision(accept) {
  const myP = players[myPlayerId];
  if (!myP) return;
  const tileIdx = myP.pos;
  const tile = tiles[tileIdx];

  if (accept && tile) {
    let neededPrice = 0;
    if (pendingActionType === 'BUY') {
      neededPrice = tile.price;
    } else if (pendingActionType === 'UPGRADE') {
      neededPrice = tile.build;
    } else if (pendingActionType === 'TAKEOVER') {
      neededPrice = (tile.price + (tile.build * tile.buildings)) * 2;
    }

    // CEK SALDO: Gak boleh beli kalau duitnya kurang
    if (myP.cash < neededPrice) {
      const shortage = neededPrice - myP.cash;
      if (myP.props && myP.props.length > 0) {
        showBigAlert(
          'Saldo Belum Cukup!', 
          `Harga: ${formatKoin(neededPrice)}, saldo kamu: ${formatKoin(myP.cash)} (kurang ${formatKoin(shortage)}).\n\nKamu memiliki aset properti yang bisa dijual dulu di bawah! Setelah saldo cukup, kamu bisa membeli/upgrade properti ini.`,
          '💸'
        );
        openEmergencySellModal(shortage);
        return;
      } else {
        showBigAlert(
          'Saldo Tidak Cukup!', 
          `Kamu membutuhkan ${formatKoin(neededPrice)} untuk transaksi ini, tetapi saldo kamu hanya ${formatKoin(myP.cash)} dan tidak memiliki aset lain untuk dijual. Transaksi dibatalkan!`,
          '🚫'
        );
        document.getElementById('mobileActionPanel').classList.add('hidden');
        proceedEndTurnOrRollAgain();
        return;
      }
    }

    document.getElementById('mobileActionPanel').classList.add('hidden');

    if (pendingActionType === 'BUY') {
      sendWs({
        type: 'ACTION_BUY_PROPERTY',
        playerId: myPlayerId,
        tileIdx
      });
    } else if (pendingActionType === 'UPGRADE') {
      sendWs({
        type: 'ACTION_BUILD_PROPERTY',
        playerId: myPlayerId,
        tileIdx
      });
    } else if (pendingActionType === 'TAKEOVER') {
      sendWs({
        type: 'ACTION_BUY_PROPERTY',
        playerId: myPlayerId,
        tileIdx,
        customPrice: neededPrice,
        isTakeover: true
      });
    }
  } else {
    document.getElementById('mobileActionPanel').classList.add('hidden');
  }

  proceedEndTurnOrRollAgain();
}

function proceedEndTurnOrRollAgain() {
  const myP = players[myPlayerId];
  if (doubleCount === 0) {
    setTimeout(() => {
      const nextIdx = (activePlayerIdx + 1) % players.length;
      sendWs({
        type: 'ACTION_END_TURN',
        nextPlayerIdx: nextIdx,
        roundNumber: (nextIdx === 0 ? roundNumber + 1 : roundNumber)
      });
    }, 500);
  } else {
    setTimeout(() => {
      sendWs({
        type: 'SYNC_STATE',
        activePlayerIdx: myPlayerId,
        isRolled: false,
        eventText: `🎲 ${myP ? myP.name : 'Pemain'} dapat dadu 12 dan melempar lagi!`
      });
    }, 600);
  }
}
