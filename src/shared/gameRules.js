// =========================================================================
// MONOPOLI WNI PURE GAME RULES & CALCULATION LOGIC
// =========================================================================

const { BOARD_DATA_36, UMR_JAKARTA, GOBLIN_REWARD } = require('./constants');

/**
 * Buat array 36 tiles awal dengan status default
 */
function createInitialTiles() {
  return BOARD_DATA_36.map((t, idx) => ({
    ...t,
    index: idx,
    owner: null,
    buildings: 0,
    isLandmark: false
  }));
}

/**
 * Hitung harga sewa properti
 * Rumus: tile.rent * (tile.buildings + 1) * (isLandmark ? 2 : 1)
 */
function calculateRent(tile) {
  if (!tile || tile.type !== 'property') return 0;
  const buildings = tile.buildings || 0;
  const isLandmark = Boolean(tile.isLandmark || buildings >= 3);
  const baseRent = tile.rent || 0;
  return baseRent * (buildings + 1) * (isLandmark ? 2 : 1);
}

/**
 * Hitung harga ambil alih (takeover) properti lawan yang belum landmark
 * Rumus: 2x lipat dari total investasi awal (harga beli + biaya bangunan)
 */
function calculateTakeoverPrice(tile) {
  if (!tile || tile.type !== 'property') return 0;
  const price = tile.price || 0;
  const build = tile.build || 0;
  const buildings = tile.buildings || 0;
  return (price + (build * buildings)) * 2;
}

/**
 * Hitung harga jual properti kembali ke pasar (darurat)
 * Dihargai 80% dari total investasi (harga beli + total bangunan)
 */
function calculateSellPrice(tile) {
  if (!tile) return 0;
  const price = tile.price || 0;
  const build = tile.build || 0;
  const buildings = tile.buildings || 0;
  const totalInvested = price + (build * buildings);
  return Math.floor(totalInvested * 0.8);
}

/**
 * Cek apakah pemain dapat membeli properti
 */
function canBuyProperty(playerCash, price) {
  return typeof playerCash === 'number' && playerCash >= price;
}

/**
 * Cek apakah properti dapat diupgrade oleh pemilik
 */
function canUpgradeProperty(player, tile) {
  if (!player || !tile) return false;
  if (tile.type !== 'property') return false;
  if (tile.owner !== player.id) return false;
  if (tile.isLandmark || (tile.buildings && tile.buildings >= 3)) return false;
  return player.cash >= tile.build;
}

/**
 * Hitung kerugian IHSG (-15% dari saldo, minimal Rp 500.000)
 */
function calculateIhsgLoss(cash) {
  const currentCash = typeof cash === 'number' ? cash : 0;
  return Math.max(500000, Math.floor(currentCash * 0.15));
}

/**
 * Hitung biaya Rumah Sakit
 */
function getHospitalFee(inHospital) {
  return inHospital ? 250000 : 0;
}

/**
 * Hitung index pemain berikutnya
 */
function getNextPlayerIndex(currentIdx, totalPlayers) {
  if (!totalPlayers || totalPlayers <= 0) return 0;
  return (currentIdx + 1) % totalPlayers;
}

/**
 * Format mata uang Rupiah standar
 */
function formatRupiah(val) {
  if (val === null || val === undefined) return 'Rp 0';
  return 'Rp ' + Number(val).toLocaleString('id-ID');
}

/**
 * Format koin / saldo singkat (misal Rp 5,4 Jt)
 */
function formatKoin(val) {
  return formatRupiah(val);
}

/**
 * Format singkat untuk label petak papan (misal 5.4Jt, 800Rb)
 */
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

const gameRules = {
  createInitialTiles,
  calculateRent,
  calculateTakeoverPrice,
  calculateSellPrice,
  canBuyProperty,
  canUpgradeProperty,
  calculateIhsgLoss,
  getHospitalFee,
  getNextPlayerIndex,
  formatRupiah,
  formatKoin,
  formatRpShort
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameRules;
}
if (typeof window !== 'undefined') {
  window.GAME_RULES = gameRules;
  window.formatRupiah = formatRupiah;
  window.formatKoin = formatKoin;
  window.formatRpShort = formatRpShort;
}
