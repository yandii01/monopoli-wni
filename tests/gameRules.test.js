const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BOARD_DATA_36,
  GRID_COORDINATES_36,
  CHANCE_CARDS_INDO,
  UMR_JAKARTA,
  GOBLIN_REWARD,
  GOBLIN_VALID_TILES
} = require('../src/shared/constants');

const {
  createInitialTiles,
  calculateRent,
  calculateTakeoverPrice,
  calculateSellPrice,
  canBuyProperty,
  canUpgradeProperty,
  calculateIhsgLoss,
  getHospitalFee,
  getNextPlayerIndex
} = require('../src/shared/gameRules');

test('Board & Coordinates Integrity', async (t) => {
  await t.test('has exactly 36 tiles and 36 grid coordinates', () => {
    assert.equal(BOARD_DATA_36.length, 36);
    assert.equal(GRID_COORDINATES_36.length, 36);
  });

  await t.test('covers all 5 Indonesian archipelago regions', () => {
    const islands = new Set(BOARD_DATA_36.map(t => t.island));
    assert.ok(islands.has('Jawa'));
    assert.ok(islands.has('Sumatra'));
    assert.ok(islands.has('Kalimantan'));
    assert.ok(islands.has('Sulawesi'));
    assert.ok(islands.has('Papua'));
  });

  await t.test('corner tiles are positioned at 0, 9, 18, and 27', () => {
    assert.equal(BOARD_DATA_36[0].type, 'start');
    assert.equal(BOARD_DATA_36[9].type, 'hospital');
    assert.equal(BOARD_DATA_36[18].type, 'jail');
    assert.equal(BOARD_DATA_36[27].type, 'traffic');
  });

  await t.test('createInitialTiles creates 36 unowned tiles with default states', () => {
    const tiles = createInitialTiles();
    assert.equal(tiles.length, 36);
    tiles.forEach((t, i) => {
      assert.equal(t.index, i);
      assert.equal(t.owner, null);
      assert.equal(t.buildings, 0);
      assert.equal(t.isLandmark, false);
    });
  });
});

test('Rent Calculations', async (t) => {
  const warungMadura = {
    name: 'Warung Madura',
    type: 'property',
    price: 2500000,
    rent: 800000,
    build: 1500000,
    buildings: 0,
    isLandmark: false
  };

  await t.test('calculates base rent with 0 buildings', () => {
    const rent = calculateRent(warungMadura);
    assert.equal(rent, 800000);
  });

  await t.test('calculates rent with 1 building (2x base rent)', () => {
    const rent = calculateRent({ ...warungMadura, buildings: 1 });
    assert.equal(rent, 1600000);
  });

  await t.test('calculates rent with 2 buildings (3x base rent)', () => {
    const rent = calculateRent({ ...warungMadura, buildings: 2 });
    assert.equal(rent, 2400000);
  });

  await t.test('calculates rent with Landmark (level 3 + 2x multiplier = 8x base rent)', () => {
    const rent = calculateRent({ ...warungMadura, buildings: 3, isLandmark: true });
    // Formula: 800,000 * (3 + 1) * 2 = 6,400,000
    assert.equal(rent, 6400000);
  });

  await t.test('returns 0 for non-property tiles', () => {
    assert.equal(calculateRent({ type: 'start' }), 0);
    assert.equal(calculateRent({ type: 'tax', amount: 1000000 }), 0);
  });
});

test('Takeover & Sell Valuation Rules', async (t) => {
  const scbd = {
    name: 'Gedung SCBD Jakarta',
    type: 'property',
    price: 6500000,
    build: 3500000,
    buildings: 1,
    isLandmark: false
  };

  await t.test('takeover price is 2x of total investment', () => {
    // Total invested = 6.5M + 3.5M * 1 = 10M -> 2x = 20M
    const takeoverPrice = calculateTakeoverPrice(scbd);
    assert.equal(takeoverPrice, 20000000);
  });

  await t.test('emergency sell price is 80% of total investment', () => {
    // Total invested = 6.5M + 3.5M * 1 = 10M -> 80% = 8M
    const sellPrice = calculateSellPrice(scbd);
    assert.equal(sellPrice, 8000000);
  });

  await t.test('canBuyProperty checks cash sufficiency accurately', () => {
    assert.equal(canBuyProperty(5000000, 4000000), true);
    assert.equal(canBuyProperty(4000000, 4000000), true);
    assert.equal(canBuyProperty(3999999, 4000000), false);
  });

  await t.test('canUpgradeProperty enforces owner, building cap, and cash requirements', () => {
    const player = { id: 0, cash: 5000000 };
    const ownedTile = { type: 'property', owner: 0, build: 3000000, buildings: 1, isLandmark: false };

    // Valid upgrade
    assert.equal(canUpgradeProperty(player, ownedTile), true);

    // Insufficient cash
    assert.equal(canUpgradeProperty({ id: 0, cash: 2000000 }, ownedTile), false);

    // Not the owner
    assert.equal(canUpgradeProperty({ id: 1, cash: 5000000 }, ownedTile), false);

    // Already a landmark
    assert.equal(canUpgradeProperty(player, { ...ownedTile, isLandmark: true }), false);
    assert.equal(canUpgradeProperty(player, { ...ownedTile, buildings: 3 }), false);
  });
});

test('Financial & Event Dynamics', async (t) => {
  await t.test('calculateIhsgLoss deducts 15% with a minimum of Rp 500.000', () => {
    assert.equal(calculateIhsgLoss(10000000), 1500000); // 15% of 10M
    assert.equal(calculateIhsgLoss(2000000), 500000);   // 15% is 300k -> clamped to 500k min
    assert.equal(calculateIhsgLoss(0), 500000);         // 0 cash -> clamped to 500k min
  });

  await t.test('getHospitalFee charges Rp 250.000 when patient is in hospital', () => {
    assert.equal(getHospitalFee(true), 250000);
    assert.equal(getHospitalFee(false), 0);
  });

  await t.test('Goblin reward is set to Rp 10.000.000 and valid tiles exclude corners', () => {
    assert.equal(GOBLIN_REWARD, 10000000);
    assert.ok(!GOBLIN_VALID_TILES.includes(0));
    assert.ok(!GOBLIN_VALID_TILES.includes(9));
    assert.ok(!GOBLIN_VALID_TILES.includes(18));
    assert.ok(!GOBLIN_VALID_TILES.includes(27));
  });

  await t.test('getNextPlayerIndex correctly rotates through players', () => {
    assert.equal(getNextPlayerIndex(0, 4), 1);
    assert.equal(getNextPlayerIndex(1, 4), 2);
    assert.equal(getNextPlayerIndex(2, 4), 3);
    assert.equal(getNextPlayerIndex(3, 4), 0);
  });

  await t.test('Starting cash equals UMR DKI Jakarta (Rp 5.400.000)', () => {
    assert.equal(UMR_JAKARTA, 5400000);
  });

  await t.test('Chance cards list is valid and non-empty', () => {
    assert.ok(CHANCE_CARDS_INDO.length >= 8);
    CHANCE_CARDS_INDO.forEach(card => {
      assert.ok(card.title && card.title.length > 0);
      assert.ok(card.text && card.text.length > 0);
      assert.equal(typeof card.fn, 'function');
    });
  });
});
