const assert = require('assert');
const { computeRequestHash } = require('../src/services/paymentIdempotency');

(function testSamePayloadSameHash() {
  const body = { buyerId: 'a'.repeat(24), companyId: 'b'.repeat(24), amount: 1, currency: 'XRP', memo: '' };
  const h1 = computeRequestHash(body);
  const h2 = computeRequestHash({ ...body });
  assert.strictEqual(h1, h2, 'hash should be stable for same payload');
})();

(function testDifferentPayloadDifferentHash() {
  const base = { buyerId: 'a'.repeat(24), companyId: 'b'.repeat(24), amount: 1, currency: 'XRP', memo: '' };
  const h1 = computeRequestHash(base);
  const h2 = computeRequestHash({ ...base, amount: 2 });
  assert.notStrictEqual(h1, h2, 'hash should change when amount changes');
})();

