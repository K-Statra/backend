const crypto = require('crypto');

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hmacSha256Hex(secret, payloadBuffer) {
  return crypto.createHmac('sha256', secret).update(payloadBuffer).digest('hex');
}

module.exports = { sha256Hex, hmacSha256Hex };

