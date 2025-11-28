const assert = require('assert');
const { canTransition, isQuoteExpired, computeExpectedSignatureV1, cryptoSafeEqual } = require('../src/services/paymentsSecurity');

(function testTransitions() {
  assert.ok(canTransition('CREATED', 'PENDING'));
  assert.ok(!canTransition('PAID', 'PENDING'));
})();

(function testQuoteExpiry() {
  const now = Date.now();
  const docPast = { quote: { expiresAt: new Date(now - 1000).toISOString() } };
  const docFuture = { quote: { expiresAt: new Date(now + 60_000).toISOString() } };
  assert.strictEqual(isQuoteExpired(docPast), true);
  assert.strictEqual(isQuoteExpired(docFuture), false);
})();

(function testSignatureV1() {
  const secret = 's3cr3t';
  const ts = String(Date.now());
  const nonce = 'abc123';
  const body = Buffer.from('{"hello":"world"}', 'utf8');
  const sig = computeExpectedSignatureV1(secret, ts, nonce, body);
  // signature should be hex and timing compare equal to itself
  assert.match(sig, /^[0-9a-f]+$/i);
  assert.ok(cryptoSafeEqual(sig, sig));
})();

