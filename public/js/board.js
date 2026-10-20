// =========================================================================
// BOARD DISPLAY RENDERING & 3D DICE
// =========================================================================

function renderLaptopGlobalHistoryUI() {
  const listEl = document.getElementById('boardGlobalHistoryList');
  if (!listEl) return;
  if (globalActivityLogs.length === 0) {
    listEl.innerHTML = '<div class="board-history-item">Menunggu pemain bergabung dan melempar dadu...</div>';
    return;
  }
  listEl.innerHTML = globalActivityLogs.map(item => `
    <div class="board-history-item">${item}</div>
  `).join('');
}

function build36GridTiles() {
  const boardGrid = document.getElementById('boardGrid36');
  if (!boardGrid) return;
  const old = boardGrid.querySelectorAll('.tile-slot');
  old.forEach(el => el.remove());

  tiles.forEach((t, i) => {
    const coords = GRID_COORDINATES_36[i];
    const el = document.createElement('div');
    el.className = `tile-slot ${[0, 9, 18, 27].includes(i) ? 'corner' : ''}`;
    el.id = `boardTile36_${i}`;
    el.style.gridRow = coords.row;
    el.style.gridColumn = coords.col;

    let priceTag = '';
    if (t.type === 'property') priceTag = formatRpShort(t.price);
    else if (t.type === 'tax') priceTag = '-' + formatRpShort(t.amount);
    else if (t.type === 'karhutla') priceTag = 'ASAP & RS!';
    else if (t.type === 'hospital') priceTag = 'Rawat Inap';
    else if (t.type === 'jail') priceTag = 'Razia / Penjara';
    else if (t.type === 'ihsg') priceTag = 'Saham -15%';
    else if (t.type === 'bonus') priceTag = '+' + formatRpShort(t.amount);
    else if (t.type === 'start') priceTag = '+Gaji UMR';

    el.innerHTML = `
      <div class="tile-region-stripe" style="background:${t.color}"></div>
      <div class="tile-emoji-icon">${t.emoji}</div>
      <div class="tile-title" title="${t.name}">${t.name}</div>
      <div class="tile-tag-label" id="tileTag_${i}">${priceTag}</div>
      <div class="tile-token-rack" id="tokenRack_${i}"></div>
    `;

    boardGrid.appendChild(el);
  });
}

function updateBoardTokensAndOwners() {
  tiles.forEach((t, i) => {
    const tileDiv = document.getElementById(`boardTile36_${i}`);
    if (!tileDiv) return;

    let ownerTag = tileDiv.querySelector('.tile-owner-badge');
    if (t.owner !== null && t.owner !== undefined) {
      const ownerPlayer = players[t.owner];
      if (ownerPlayer) {
        if (!ownerTag) {
          ownerTag = document.createElement('div');
          ownerTag.className = 'tile-owner-badge';
          tileDiv.insertBefore(ownerTag, tileDiv.querySelector('.tile-token-rack'));
        }
        ownerTag.style.background = ownerPlayer.color;
        
        // Cek Landmark (Level 3 / Max)
        if (t.isLandmark || t.buildings >= 3) {
          ownerTag.className = 'tile-owner-badge landmark';
          ownerTag.innerHTML = `👑 LANDMARK`;
        } else {
          ownerTag.className = 'tile-owner-badge';
          ownerTag.innerHTML = `${ownerPlayer.emoji} ${'🏠'.repeat(t.buildings) || 'Tanah'}`;
        }

        // Update tag sewa
        const tagEl = document.getElementById(`tileTag_${i}`);
        if (tagEl) {
          const rentVal = t.rent * (t.buildings + 1) * (t.isLandmark ? 2 : 1);
          tagEl.textContent = `Sewa ${formatRpShort(rentVal)}`;
        }
      }
    } else {
      if (ownerTag) ownerTag.remove();
      const tagEl = document.getElementById(`tileTag_${i}`);
      if (tagEl && t.type === 'property') {
        tagEl.textContent = formatRpShort(t.price);
      }
    }

    // Token pemain di petak
    const rack = document.getElementById(`tokenRack_${i}`);
    if (rack) {
      rack.innerHTML = '';
      players.filter(p => p.alive && p.pos === i).forEach(p => {
        const pin = document.createElement('div');
        pin.className = 'player-pin';
        pin.id = `playerPin_${p.id}`;
        pin.style.borderColor = p.color;
        pin.title = p.name;
        if (p.photo) {
          pin.innerHTML = `<img src="${p.photo}" alt="${p.name}">`;
        } else {
          pin.style.background = p.color;
          pin.innerHTML = p.emoji;
        }
        rack.appendChild(pin);
      });
    }

    // Indikator Goblin Pembawa Emas
    let goblinBadge = tileDiv.querySelector('.goblin-badge');
    if (activeGoblinTile === i) {
      tileDiv.classList.add('has-goblin');
      if (!goblinBadge) {
        goblinBadge = document.createElement('div');
        goblinBadge.className = 'goblin-badge';
        goblinBadge.innerHTML = '👺 +10JT';
        tileDiv.appendChild(goblinBadge);
      }
    } else {
      tileDiv.classList.remove('has-goblin');
      if (goblinBadge) goblinBadge.remove();
    }
  });

  renderBoardFooterPlayers();
}

function renderBoardFooterPlayers() {
  const strip = document.getElementById('boardPlayersStrip');
  if (!strip) return;

  if (players.length === 0) {
    strip.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:18px;">Menunggu pemain join via HP...</div>';
    return;
  }

  strip.innerHTML = players.map((p, idx) => {
    const isCurrent = (idx === activePlayerIdx);
    const isOffline = (p.isConnected === false);
    const missedBadge = (p.consecutiveMissedTurns > 0) ? `<span style="font-size:10px; color:var(--accent-red); font-weight:800;">(AFK ${p.consecutiveMissedTurns}/3)</span>` : '';
    const statusNote = isOffline ? `<span style="font-size:10px; color:#f59e0b; font-weight:800;">(DC: sisa ${p.reconnectAttemptsLeft || 0}x)</span>` : '';

    return `
      <div class="player-mini-card ${isCurrent ? 'active-turn' : ''} ${isOffline ? 'disconnected' : ''}">
        <div style="width:40px; height:40px; border-radius:50%; border:2.5px solid ${p.color}; overflow:hidden; display:grid; place-items:center; flex-shrink:0;">
          ${p.photo ? `<img src="${p.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-size:20px;">${p.emoji}</span>`}
        </div>
        <div style="flex:1; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:13px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${p.name} ${p.inHospital ? '🏥' : ''} ${p.inJail ? '🚨' : ''}
            </div>
            ${isCurrent ? '<span style="font-size:10px; color:var(--accent-green); font-weight:900;">JALAN</span>' : ''}
          </div>
          <div style="font-size:12px; font-weight:900; color:var(--accent-gold); margin-top:2px;">
            ${formatKoin(p.cash)}
          </div>
          <div style="display:flex; gap:6px; align-items:center; margin-top:2px;">
            ${missedBadge}
            ${statusNote}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const roundBadge = document.getElementById('boardRoundBadge');
  if (roundBadge) roundBadge.textContent = `Putaran ${roundNumber}`;
}

function setBoardDice(d1, d2) {
  const cube1 = document.getElementById('dice1');
  const cube2 = document.getElementById('dice2');
  if (!cube1 || !cube2) return;

  const r1 = DICE_ROTATIONS[d1];
  const r2 = DICE_ROTATIONS[d2];
  if (r1) cube1.style.transform = `rotateX(${r1.x}deg) rotateY(${r1.y}deg)`;
  if (r2) cube2.style.transform = `rotateX(${r2.x}deg) rotateY(${r2.y}deg)`;
}
