// =========================================================================
// UTILITY FUNCTIONS: FORMATTING, TOASTS, ALERTS, FULLSCREEN
// =========================================================================

function formatRupiah(val) {
  if (val === null || val === undefined) return 'Rp 0';
  return 'Rp ' + Number(val).toLocaleString('id-ID');
}

function formatKoin(val) {
  return formatRupiah(val);
}

function formatRpShort(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Number(val);
  if (num >= 1000000) {
    const jt = num / 1000000;
    return (jt % 1 === 0 ? jt : jt.toFixed(1)) + 'Jt';
  } else if (num >= 1000) {
    return Math.floor(num / 1000) + 'Rb';
  }
  return num.toString();
}

function showNotification(title, message, type = 'info', icon = '🔔', durationMs = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, durationMs);
}

function showBigAlert(title, desc, icon = '⚠️') {
  const box = document.getElementById('mobileBigAlertBox');
  if (!box) return;
  document.getElementById('alertBigIcon').textContent = icon;
  document.getElementById('alertBigTitle').textContent = title;
  document.getElementById('alertBigDesc').textContent = desc;
  box.classList.remove('hidden');
}

function closeBigAlert() {
  const box = document.getElementById('mobileBigAlertBox');
  if (box) box.classList.add('hidden');
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

function handleMobilePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 90;
      canvas.width = size;
      canvas.height = size;
      const minDim = Math.min(img.width, img.height);
      const startX = (img.width - minDim) / 2;
      const startY = (img.height - minDim) / 2;
      ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
      myMobilePhoto = canvas.toDataURL('image/jpeg', 0.85);

      const preview = document.getElementById('mobilePhotoPreview');
      if (preview) {
        preview.innerHTML = `<img src="${myMobilePhoto}">`;
      }
      showNotification('Foto Berhasil!', 'Foto profilmu akan tampil di pion atas peta laptop.', 'success', '📸');
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}
