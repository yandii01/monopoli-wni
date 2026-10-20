const test = require('node:test');
const assert = require('node:assert/strict');

const { formatRupiah, formatKoin, formatRpShort } = require('../src/shared/gameRules');

test('Currency Formatting Utilities', async (t) => {
  await t.test('formatRupiah formats Indonesian numbers with dot separator', () => {
    assert.equal(formatRupiah(5400000), 'Rp 5.400.000');
    assert.equal(formatRupiah(10000000), 'Rp 10.000.000');
    assert.equal(formatRupiah(0), 'Rp 0');
    assert.equal(formatRupiah(null), 'Rp 0');
    assert.equal(formatRupiah(undefined), 'Rp 0');
  });

  await t.test('formatKoin is an alias for formatRupiah', () => {
    assert.equal(formatKoin(2500000), 'Rp 2.500.000');
  });

  await t.test('formatRpShort formats large values compactly for board tags', () => {
    assert.equal(formatRpShort(5400000), '5.4Jt');
    assert.equal(formatRpShort(10000000), '10Jt');
    assert.equal(formatRpShort(800000), '800Rb');
    assert.equal(formatRpShort(1500000), '1.5Jt');
    assert.equal(formatRpShort(500), '500');
    assert.equal(formatRpShort(null), '0');
  });
});
