// =========================================================================
// APPLICATION ENTRYPOINT & INITIALIZATION
// =========================================================================

// Inisialisasi awal tiles (dengan properti buildings: 0..3 dan isLandmark)
tiles = BOARD_DATA_36.map((t, idx) => ({
  ...t,
  index: idx,
  owner: null,
  buildings: 0,
  isLandmark: false
}));

// Auto-restore session dari Local Storage jika halaman di-refresh
window.addEventListener('DOMContentLoaded', () => {
  try {
    // Cek query parameters dari URL (jika ada)
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get('room');
    const urlRole = urlParams.get('role');

    if (urlRoom) {
      const roomInput = document.getElementById('joinRoomCode');
      if (roomInput) roomInput.value = urlRoom.toUpperCase();
      if (urlRole === 'mobile') {
        switchSetupTab('mobile');
      }
    }

    const raw = localStorage.getItem('monopoli_wni_session');
    if (!raw) return;
    const session = JSON.parse(raw);
    if (!session || !session.role || !session.roomCode) return;

    if (session.role === 'laptop') {
      console.log('Restoring Laptop Board Session:', session.roomCode);
      startBoardDisplayRoom(session.roomCode);
    } else if (session.role === 'mobile') {
      console.log('Restoring Mobile Player Session:', session.name, session.roomCode);
      joinAsMobilePlayer(session);
    }
  } catch (err) {
    console.error('Failed to restore session:', err);
  }
});
