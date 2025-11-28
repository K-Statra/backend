const { sha256Hex } = require('../utils/crypto');

function computeRequestHash(body) {
  const payload = {
    buyerId: body?.buyerId,
    companyId: body?.companyId,
    amount: body?.amount,
    currency: body?.currency,
    memo: body?.memo || '',
  };
  return sha256Hex(JSON.stringify(payload));
}

module.exports = { computeRequestHash };

