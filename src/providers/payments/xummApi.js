const axios = require('axios');

function ensureConfig() {
  const key = process.env.XUMM_API_KEY || '';
  const secret = process.env.XUMM_API_SECRET || '';
  const base = process.env.XUMM_API_BASE || 'https://xumm.app/api/v1';
  if (!key || !secret) throw new Error('XUMM API credentials missing');
  return { key, secret, base };
}

async function createIssuedPaymentPayload({ amount, code, issuer, destination, destTag, memo, expiresMinutes = 15 }) {
  const { key, secret, base } = ensureConfig();
  const url = `${base.replace(/\/$/, '')}/platform/payload`;
  const txjson = {
    TransactionType: 'Payment',
    Destination: destination,
    Amount: { currency: String(code), value: String(amount), issuer: String(issuer) },
  };
  if (destTag != null) txjson.DestinationTag = Number(destTag);
  if (memo) {
    txjson.Memos = [
      {
        Memo: {
          MemoData: Buffer.from(String(memo)).toString('hex'),
        },
      },
    ];
  }
  const body = { txjson, options: { expire: expiresMinutes } };
  const headers = { 'X-API-Key': key, 'X-API-Secret': secret };
  const resp = await axios.post(url, body, { headers, timeout: 10000 });
  const data = resp.data || {};
  return {
    uuid: data.uuid || '',
    next: (data.next && (data.next.always || data.next.alwaysURL)) || '',
  };
}

module.exports = { createIssuedPaymentPayload };

