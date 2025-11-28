// Simple quote service using env-provided static rates
// PAYMENTS_RATES_JSON example: {"USD":0.02,"KRW":0.000015}
// meaning: 1 unit of currency equals X XRP

function getRates() {
  try {
    if (process.env.PAYMENTS_RATES_JSON) {
      return JSON.parse(process.env.PAYMENTS_RATES_JSON);
    }
  } catch (_) {}
  return { USD: 0.02, KRW: 0.000015 }; // defaults for dev/testing
}

function makeQuote({ amount, baseCurrency }) {
  const cur = String(baseCurrency || 'XRP').toUpperCase();
  if (cur === 'XRP') {
    return {
      baseCurrency: 'XRP',
      quoteCurrency: 'XRP',
      rate: 1,
      amountQuote: amount,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
  }
  const rates = getRates();
  const rate = Number(rates[cur]);
  if (!rate || !isFinite(rate) || rate <= 0) {
    throw new Error(`No rate configured for ${cur}`);
  }
  const amountQuote = Number(amount) * rate;
  return {
    baseCurrency: cur,
    quoteCurrency: 'XRP',
    rate,
    amountQuote,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  };
}

module.exports = { makeQuote };

