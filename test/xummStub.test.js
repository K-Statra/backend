const assert = require('assert');

const xumm = require('../src/providers/payments/xumm');

(function testXummStubInvoice() {
  const payment = {
    _id: { toString: () => '650000000000000000000001' },
    amount: 3.14,
    currency: 'RLUSD',
    memo: 'stub test',
    invoice: { destTag: 123456 },
  };
  const inv = xumm.createIssuedInvoice(payment, { code: 'RLUSD', issuer: 'rISSUER' });
  assert.ok(inv.providerRef, 'providerRef present');
  assert.ok(inv.deeplink && inv.deeplink.includes('xumm.app'), 'deeplink contains xumm link');
  assert.ok(inv.expiresAt instanceof Date, 'expiresAt is Date');
})();

