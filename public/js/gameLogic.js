// =========================================================================
// GAME LOOP, ANIMATION & TILE ACTION RESOLUTION
// =========================================================================

function startTurnTimer() {
  clearInterval(turnTimerInterval);
  turnSecondsLeft = 15;
  updateTimerDisplays();

  const boardBadge = document.getElementById('boardTimerBadge');
  if (boardBadge) boardBadge.classList.remove('hidden');

  turnTimerInterval = setInterval(() => {
    turnSecondsLeft--;
    updateTimerDisplays();

    if (turnSecondsLeft <= 0) {
      clearInterval(turnTimerInterval);
      handleTurnTimeout();
    }
  }, 1000);
}

function updateTimerDisplays() {
  const mobileTimer = document.getElementById('mobileTimerBadge');
  if (mobileTimer) mobileTimer.textContent = turnSecondsLeft;

  const boardTimer = document.getElementById('boardTimerBadge');
  if (boardTimer) boardTimer.textContent = turnSecondsLeft;
}

function handleTurnTimeout() {
  showNotification('Waktu Habis!', `Waktu 15 detik habis! Giliran otomatis berpindah.`, 'warning', '⏰');
  
  // Beritahu server bahwa pemain yang aktif melewatkan giliran (untuk pelacakan 3x auto kick)
  const timedOutPlayer = players[activePlayerIdx];
  if (timedOutPlayer) {
    sendWs({
      type: 'PLAYER_MISSED_TURN',
      playerId: timedOutPlayer.id
    });
  }

  if (currentAppRole === 'mobile' && activePlayerIdx === myPlayerId) {
    showBigAlert('Waktu 15 Detik Habis!', 'Kamu tidak melempar dadu tepat waktu. Giliran otomatis berpindah ke pemain berikutnya!', '⏰');
    const rollBtn = document.getElementById('mobileRollBtn');
    if (rollBtn) rollBtn.disabled = true;
    const actionPanel = document.getElementById('mobileActionPanel');
    if (actionPanel) actionPanel.classList.add('hidden');
  }

  if (currentAppRole === 'laptop') {
    endTurnAuto();
  }
}

function animateStepByStep(player, totalSteps, rollAgain, toJail) {
  isMoving = true;
  let stepsLeft = totalSteps;

  if (toJail) {
    showNotification('Tiga Kali Dadu 12!', `${player.name} kena razia knalpot brong & dilarikan ke Pos Razia!`, 'danger', '🚨', 6000);
    player.pos = 18;
    player.inJail = true;
    if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
    isMoving = false;
    handleNextTurn(false, player);
    return;
  }

  const interval = setInterval(() => {
    player.pos = (player.pos + 1) % 36;
    stepsLeft--;

    // LEWAT START (GAJI UMR JAKARTA RP 5.400.000)
    if (player.pos === 0) {
      player.cash += UMR_JAKARTA;
      showNotification('Gajian UMR!', `💵 ${player.name} lewat Petak Start & dapat Gaji UMR Jakarta Rp 5.400.000!`, 'success', '💵', 5000);
      if (currentAppRole === 'mobile' && player.id === myPlayerId) {
        addPersonalActivityLog(`💵 Melewati Start: Menerima Gaji UMR Jakarta +Rp ${UMR_JAKARTA.toLocaleString('id-ID')}!`);
      }
    }

    if (currentAppRole === 'laptop') updateBoardTokensAndOwners();

    if (stepsLeft <= 0) {
      clearInterval(interval);
      isMoving = false;
      setTimeout(() => {
        resolveTileAction(player, rollAgain);
      }, 350);
    }
  }, 220);
}

function resolveTileAction(player, rollAgain) {
  const tile = tiles[player.pos];
  if (!tile) return;

  const banner = document.getElementById('boardStatusBanner');
  if (banner) {
    banner.innerHTML = `<b>${player.name}</b> mendarat di ${tile.emoji} <b>${tile.name}</b> (${tile.island})`;
  }

  const isMe = (player.id === myPlayerId);

  // EVENT RARE: CEK APAKAH MENDARAT DI PETAK GOBLIN EMAS
  if (activeGoblinTile !== null && player.pos === activeGoblinTile) {
    if (isMe) {
      sendWs({
        type: 'ACTION_CLAIM_GOBLIN',
        playerId: player.id
      });
      showBigAlert('MENANGKAP GOBLIN EMAS!', '🎉 SELAMAT! Kamu berhasil menangkap Goblin Emas yang langka! Kamu mendapatkan kucuran harta karun +Rp 10.000.000!', '👺💰');
    }
    showNotification('GOBLIN TERTANGKAP!', `🎉 ${player.name} mendarat di sarang Goblin Emas dan meraup Rp 10.000.000!`, 'success', '👺💰', 7000);
    activeGoblinTile = null;
    if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
  }

  // 1. ISU KARHUTLA & ISPA -> DILARIKAN KE RS
  if (tile.type === 'karhutla') {
    player.inHospital = true;
    deductCashOrSell(player, 500000, 'Biaya Medis Darurat Karhutla');

    if (currentAppRole === 'mobile' && isMe) {
      addPersonalActivityLog('🔥😷 Terkena ISPA Karhutla! Dilarikan ke RS & bayar biaya medis Rp 500.000.');
      showBigAlert('TERKENA ISPA KARHUTLA!', 'Kabut asap kebakaran hutan sangat pekat! Nafasmu sesak dan langsung dilarikan ambulans ke Rumah Sakit! (Biaya perawatan -Rp 500.000)', '🔥😷');
    }

    setTimeout(() => {
      player.pos = 9;
      if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
      endTurnAuto();
    }, 1200);
    return;
  }

  // 2. RUMAH SAKIT
  else if (tile.type === 'hospital') {
    if (player.inHospital) {
      deductCashOrSell(player, 250000, 'Biaya Inap Rumah Sakit');
      player.inHospital = false;
      if (currentAppRole === 'mobile' && isMe) {
        addPersonalActivityLog('🏥 Selesai rawat inap RS. Bayar biaya Rp 250.000.');
        showBigAlert('Masa Pemulihan Selesai', 'Kamu telah dirawat di Rumah Sakit Umum dan kini diperbolehkan pulang. Bayar biaya inap Rp 250.000.', '🏥');
      }
    } else {
      if (currentAppRole === 'mobile' && isMe) {
        addPersonalActivityLog('🩺 Cek kesehatan di Rumah Sakit Umum. Kondisimu prima!');
        showBigAlert('Medical Checkup', 'Kamu mampir di Rumah Sakit Umum untuk cek kesehatan rutin. Kondisimu prima!', '🩺');
      }
    }
    handleNextTurn(rollAgain, player);
  }

  // 3. IHSG ANJLOK MERAH (-15%)
  else if (tile.type === 'ihsg') {
    const loss = Math.max(500000, Math.floor(player.cash * 0.15));
    deductCashOrSell(player, loss, 'Kerugian Saham IHSG');
    if (currentAppRole === 'mobile' && isMe) {
      addPersonalActivityLog(`📉 IHSG Anjlok Merah! Mengalami kerugian saham -${formatKoin(loss)}.`);
      showBigAlert('IHSG ANJLOK MERAH MERONA!', `Pasar saham terkoreksi tajam dan portofoliomu anjlok! Kerugian tunai kamu: -${formatKoin(loss)}!`, '📉');
    }
    handleNextTurn(rollAgain, player);
  }

  // 4. KARTU WARGA
  else if (tile.type === 'chance') {
    const card = CHANCE_CARDS_INDO[Math.floor(Math.random() * CHANCE_CARDS_INDO.length)];
    card.fn(player);
    if (currentAppRole === 'mobile' && isMe) {
      addPersonalActivityLog(`🎴 Kartu Warga (${card.title}): ${card.text}`);
      showBigAlert(`KARTU WARGA: ${card.title}`, card.text, '🎴');
    }
    handleNextTurn(rollAgain, player);
  }

  // 5. PAJAK / TILANG
  else if (tile.type === 'tax' || tile.type === 'jail') {
    const fee = tile.amount || 1500000;
    deductCashOrSell(player, fee, `Biaya Retribusi/Tilang ${tile.name}`);
    if (currentAppRole === 'mobile' && isMe) {
      addPersonalActivityLog(`🧾 Denda/Pajak (${tile.name}): Membayar retribusi sebesar -${formatKoin(fee)}.`);
      showBigAlert(`DENDA / BIAYA: ${tile.name}`, `Kamu wajib membayar biaya retribusi/pajak sebesar ${formatKoin(fee)}.`, '🧾');
    }
    handleNextTurn(rollAgain, player);
  }

  // 6. MACET TOTAL
  else if (tile.type === 'traffic') {
    player.skipTurns = 1;
    if (currentAppRole === 'mobile' && isMe) {
      addPersonalActivityLog('🚦 Terjebak Macet Total Pantura! Kehilangan 1 giliran melangkah.');
      showBigAlert('MACET TOTAL PANTURA!', 'Antrean kendaraan mengular 10 kilometer! Kamu terjebak dan kehilangan 1 giliran berikutnya.', '🚦');
    }
    handleNextTurn(rollAgain, player);
  }

  // 7. BANSOS / START
  else if (tile.type === 'bonus' || tile.type === 'start') {
    const bonus = tile.amount || 3000000;
    player.cash += bonus;
    if (currentAppRole === 'mobile' && isMe) {
      addPersonalActivityLog(`🎁 Menerima dana rezeki nomplok +${formatKoin(bonus)}!`);
      showBigAlert('REZEKI NOMPLOK!', `Selamat! Kamu menerima kucuran dana tunai sebesar +${formatKoin(bonus)}!`, '🎁');
    }
    handleNextTurn(rollAgain, player);
  }

  // 8. PROPERTI: BELI, UPGRADE, ATAU LANDMARK
  else if (tile.type === 'property') {
    // KASUS A: BELUM DIMILIKI SIAPA PUN -> BELI
    if (tile.owner === null || tile.owner === undefined) {
      pendingActionType = 'BUY';
      if (currentAppRole === 'mobile' && isMe) {
        document.getElementById('mobileActionTitle').textContent = `Beli ${tile.name}?`;
        document.getElementById('mobileActionDesc').textContent = `Wilayah: Pulau ${tile.island} | Harga Beli: ${formatKoin(tile.price)}`;
        document.getElementById('mobileBtnYes').textContent = `Beli (${formatKoin(tile.price)})`;
        document.getElementById('mobileActionPanel').classList.remove('hidden');
      } else {
        if (banner) banner.textContent = `Menunggu keputusan ${player.name} di HP...`;
      }
    }
    // KASUS B: MILIK SENDIRI -> BISA UPGRADE HINGGA LANDMARK
    else if (tile.owner === player.id) {
      if (tile.buildings < 3 && !tile.isLandmark) {
        pendingActionType = 'UPGRADE';
        const nextLevel = tile.buildings + 1;
        const upgradeCost = tile.build;
        const isNextLandmark = (nextLevel >= 3);
        const titleText = isNextLandmark ? `Jadikan LANDMARK di ${tile.name}?` : `Upgrade Bangunan (${'🏠'.repeat(nextLevel)})?`;

        if (currentAppRole === 'mobile' && isMe) {
          document.getElementById('mobileActionTitle').textContent = titleText;
          document.getElementById('mobileActionDesc').textContent = isNextLandmark ? 
            `👑 Landmark membuat aset ini TIDAK BISA DIBELI/DIAMBIL ALIH oleh siapa pun! Biaya: ${formatKoin(upgradeCost)}` : 
            `Menaikkan tarif sewa pengunjung. Biaya Bangun: ${formatKoin(upgradeCost)}`;
          document.getElementById('mobileBtnYes').textContent = isNextLandmark ? `Bangun Landmark` : `Upgrade (+🏠)`;
          document.getElementById('mobileActionPanel').classList.remove('hidden');
        } else {
          if (banner) banner.textContent = `${player.name} mendarat di aset sendiri (${tile.name})...`;
        }
      } else {
        // SUDAH LANDMARK
        if (currentAppRole === 'mobile' && isMe) {
          showBigAlert('👑 Aset Landmark Sultan!', `Properti ${tile.name} sudah berstatus LANDMARK maksimal! Tarif sewa sudah puncak dan tidak bisa diganggu gugat.`, '👑');
        }
        handleNextTurn(rollAgain, player);
      }
    }
    // KASUS C: MILIK LAWAN
    else {
      const owner = players[tile.owner];
      const isLandmark = tile.isLandmark || (tile.buildings >= 3);
      const rent = tile.rent * (tile.buildings + 1) * (isLandmark ? 2 : 1);

      // Bayar sewa
      deductCashOrSell(player, rent, `Sewa Penginapan di ${tile.name} kepada ${owner.name}`, owner);

      // JIKA SUDAH LANDMARK: TIDAK BISA DIAMBIL ALIH OLEH SIAPA PUN!
      if (isLandmark) {
        if (currentAppRole === 'mobile' && isMe) {
          showBigAlert('👑 MENGINAP DI LANDMARK!', `Kamu mampir di aset LANDMARK milik ${owner.name} (${tile.name}). Sewa seharga ${formatKoin(rent)}! Properti ini berstatus Landmark sehingga TIDAK DAPAT DIBELI/DIAMBIL ALIH.`, '👑');
        }
        handleNextTurn(rollAgain, player);
      } else {
        // BELUM LANDMARK: ADA OPSI AMBIL ALIH (TAKEOVER DENGAN 2X LIPAT HARGA)
        const takeoverPrice = (tile.price + (tile.build * tile.buildings)) * 2;
        pendingActionType = 'TAKEOVER';

        if (currentAppRole === 'mobile' && isMe) {
          document.getElementById('mobileActionTitle').textContent = `Ambil Alih ${tile.name}?`;
          document.getElementById('mobileActionDesc').textContent = `Properti ${owner.name} belum Landmark! Kamu bisa merebutnya seharga 2x lipat investasi: ${formatKoin(takeoverPrice)}`;
          document.getElementById('mobileBtnYes').textContent = `Rebut Aset (${formatKoin(takeoverPrice)})`;
          document.getElementById('mobileBtnNo').textContent = `Lewati Saja`;
          document.getElementById('mobileActionPanel').classList.remove('hidden');
        } else {
          handleNextTurn(rollAgain, player);
        }
      }
    }
  }

  if (currentAppRole === 'laptop') updateBoardTokensAndOwners();
}

// FUNGSI POTONG SALDO DENGAN PROTEKSI JUAL PROPERTI SAAT DARURAT (GABOLEH MINUS)
function deductCashOrSell(player, amount, reason, recipient = null) {
  if (player.cash >= amount) {
    player.cash -= amount;
    if (recipient) recipient.cash += amount;
    showNotification('Transaksi Berhasil', `${player.name} membayar ${formatKoin(amount)} untuk ${reason}.`, 'info', '💸');
  } else {
    // Saldo kurang! Harus jual properti atau bangkrut
    const shortage = amount - player.cash;
    if (recipient) recipient.cash += player.cash;
    player.cash = 0;

    const isMe = (player.id === myPlayerId);
    if (currentAppRole === 'mobile' && isMe) {
      showBigAlert(
        'DARURAT: Saldo Kamu Kurang!',
        `Kamu berhutang ${formatKoin(shortage)} untuk: ${reason}.\n\nKamu WAJIB menjual aset propertimu ke pasar untuk menutup tagihan! Jika tidak cukup atau memilih pasrah, kamu akan dinyatakan BANGKRUT!`,
        '🚨'
      );
      openEmergencySellModal(shortage);
    } else {
      showNotification('Saldo Pemain Habis!', `${player.name} kehabisan saldo untuk membayar ${reason}! Menunggu tindakan pemain di HP...`, 'danger', '⚠️', 6000);
    }
  }
}

function handleNextTurn(rollAgain, player) {
  if (rollAgain) {
    showNotification('Dadu Dobel 12!', `🎲 ${player.name} mendapat dadu 12 dan berhak melempar sekali lagi!`, 'info', '🎲', 5000);
    if (currentAppRole === 'laptop') {
      setTimeout(() => {
        sendWs({
          type: 'SYNC_STATE',
          activePlayerIdx: activePlayerIdx,
          isRolled: false,
          eventText: `🎲 ${player.name} melempar dadu dobel 12 dan jalan lagi!`
        });
      }, 700);
    }
  } else {
    setTimeout(() => {
      endTurnAuto();
    }, 1000);
  }
}

function endTurnAuto() {
  const nextIdx = (activePlayerIdx + 1) % players.length;
  sendWs({
    type: 'ACTION_END_TURN',
    nextPlayerIdx: nextIdx,
    roundNumber: (nextIdx === 0 ? roundNumber + 1 : roundNumber)
  });
}
