const { sha256Hex, hmacSha256Hex } = require('../utils/crypto');

function canTransition(from, to) {
  const allowed = {
    CREATED: ['PENDING', 'CANCELLED'],
    PENDING: ['PAID', 'FAILED', 'CANCELLED'],
    FAILED: [],
    PAID: [],
    CANCELLED: [],
  };
  return (allowed[from] || []).includes(to);
}

function isQuoteExpired(doc) {
  if (!doc || !doc.quote || !doc.quote.expiresAt) return false;
  return new Date(doc.quote.expiresAt).getTime() < Date.now();
}

function computeExpectedSignatureV1(secret, ts, nonce, bodyBuffer) {
  if (!secret) throw new Error('secret required');
  const bodyHash = sha256Hex(bodyBuffer);
  const signed = Buffer.from(`${ts}.${nonce}.${bodyHash}`, 'utf8');
  return hmacSha256Hex(secret, signed);
}

function cryptoSafeEqual(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return require('crypto').timingSafeEqual(bufA, bufB);
}

module.exports = { canTransition, isQuoteExpired, computeExpectedSignatureV1, cryptoSafeEqual };

