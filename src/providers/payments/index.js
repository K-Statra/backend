const xrplProvider = require('./xrpl');
const stubProvider = require('./xrplTestnet');
let stripeProvider = null;
try { stripeProvider = require('./stripe'); } catch (_) { stripeProvider = null; }

function getProvider() {
  const name = (process.env.PAYMENTS_PROVIDER || 'xrpl-testnet').toLowerCase();
  if (name.startsWith('xrpl')) return xrplProvider;
  if (name === 'stripe' && stripeProvider) return stripeProvider;
  return stubProvider;
}

module.exports = { getProvider };
