const crypto = require('crypto');

function toUint32FromHex(hex) {
  const buf = Buffer.from(hex.slice(0, 8), 'hex');
  return buf.readUInt32BE(0);
}

function deriveDestinationTag(paymentId) {
  const h = crypto.createHash('sha256').update(String(paymentId)).digest('hex');
  // avoid 0 tag to reduce confusion
  const v = toUint32FromHex(h) >>> 0;
  return v === 0 ? 1 : v;
}

function ensureConfig() {
  const url = process.env.XRPL_RPC_URL || 'wss://s.altnet.rippletest.net:51233';
  const dest = process.env.XRPL_DEST_ADDRESS;
  if (!dest) {
    throw new Error('XRPL_DEST_ADDRESS is required');
  }
  return { url, dest };
}

async function withClient(fn) {
  const { url } = ensureConfig();
  const { Client } = require('xrpl');
  const client = new Client(url);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try { await client.disconnect(); } catch (_) {}
  }
}

function createInvoiceFor(payment) {
  const { dest } = ensureConfig();
  if (String(payment.currency).toUpperCase() !== 'XRP') {
    throw new Error('Only XRP currency is supported for now');
  }
  const destTag = deriveDestinationTag(payment._id.toString());
  const amount = payment?.quote?.amountQuote || payment.amount;
  // Encode memo (optional) as hex per common wallet expectations
  const rawMemo = String(payment?.memo || '').trim();
  const memoHex = rawMemo ? Buffer.from(rawMemo, 'utf8').toString('hex') : '';
  const memoParam = memoHex ? `&memo=${memoHex}` : '';
  // Use ripple: scheme (widely supported). XUMM/Xaman generally accepts ripple: URIs
  const url = `ripple:${dest}?amount=${amount}&dt=${destTag}${memoParam}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  return {
    providerRef: `xrpl_inv_${payment._id.toString()}`,
    deeplink: url,
    qr: url,
    destAddress: dest,
    destTag,
    expiresAt,
  };
}

async function refreshPaymentStatus(payment) {
  const { dest } = ensureConfig();
  const tag = payment?.invoice?.destTag;
  if (!tag) return { changed: false };

  const isXrp = String(payment.currency || 'XRP').toUpperCase() === 'XRP';
  const amountDrops = isXrp ? require('xrpl').xrpToDrops(payment.amount) : null;
  const issuedCode = String(process.env.XRPL_ISSUED_CURRENCY_CODE || '').toUpperCase();
  const issuer = process.env.XRPL_ISSUER_ADDRESS || '';
  const result = await withClient(async (client) => {
    const resp = await client.request({
      command: 'account_tx',
      account: dest,
      ledger_index_min: -1,
      ledger_index_max: -1,
      forward: false,
      limit: 200,
    });

    const tx = (resp.result.transactions || []).find((t) => {
      const tx = t.tx;
      const meta = t.meta;
      if (!tx || tx.TransactionType !== 'Payment') return false;
      if (tx.Destination !== dest) return false;
      if (tx.DestinationTag !== tag) return false;
      if (!t.validated) return false;
      // delivered_amount may be string (drops) or object for issued currencies
      const delivered = meta?.delivered_amount;
      if (typeof delivered === 'string') {
        if (!isXrp) return false;
        return BigInt(delivered) >= BigInt(amountDrops);
      }
      if (delivered && typeof delivered === 'object') {
        // Issued currency settlement
        const cc = String(delivered.currency || '').toUpperCase();
        const iss = String(delivered.issuer || '');
        if (!issuedCode || !issuer) return false;
        if (cc !== issuedCode || iss !== issuer) return false;
        const val = parseFloat(String(delivered.value || '0'));
        return isFinite(val) && val >= Number(payment.amount || 0);
      }
      return false;
    });

    if (tx) {
      return { paid: true, txHash: tx.tx.hash };
    }
    return { paid: false };
  });

  if (result.paid) {
    return {
      changed: true,
      status: 'PAID',
      txHash: result.txHash,
    };
  }
  return { changed: false };
}

module.exports = { createInvoiceFor, refreshPaymentStatus };
