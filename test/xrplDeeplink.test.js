const assert = require('assert');

// Set minimal env required by provider
process.env.XRPL_DEST_ADDRESS = 'rEXAMPLEDESTADDRESS1234567890';

const { createInvoiceFor } = require('../src/providers/payments/xrpl');

(function testMemoHexIncludedWhenPresent() {
  const payment = {
    _id: { toString: () => '64f0a1b2c3d4e5f678901234' },
    amount: 1.5,
    currency: 'XRP',
    memo: '테스트 메모',
    quote: { amountQuote: 1.5 },
  };
  const inv = createInvoiceFor(payment);
  assert.ok(inv.deeplink.includes('ripple:'), 'deeplink uses ripple: scheme');
  assert.ok(inv.deeplink.includes('dt='), 'deeplink has destination tag');
  // UTF-8 -> hex of memo should appear as &memo=
  const memoHex = Buffer.from(payment.memo, 'utf8').toString('hex');
  assert.ok(inv.deeplink.includes(`memo=${memoHex}`), 'deeplink contains hex memo');
})();

(function testNoMemoParamWhenEmpty() {
  const payment = {
    _id: { toString: () => '64f0a1b2c3d4e5f678901235' },
    amount: 2,
    currency: 'XRP',
    memo: '',
  };
  const inv = createInvoiceFor(payment);
  assert.ok(!inv.deeplink.includes('memo='), 'no memo param when memo empty');
})();

