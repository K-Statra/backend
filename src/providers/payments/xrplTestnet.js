// XRPL Testnet provider stub
// Generates a fake invoice/QR and deeplink suitable for testing flow,
// without making external calls.

function createInvoiceFor(payment) {
  const id = payment._id.toString();
  const deeplink = `xrpltestnet://pay?amount=${payment.amount}&currency=${payment.currency}&ref=${id}`;
  const qr = `QR|xrpl|amount=${payment.amount}|currency=${payment.currency}|ref=${id}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  return { providerRef: `invoice_${id}`, deeplink, qr, expiresAt };
}

module.exports = { createInvoiceFor };

