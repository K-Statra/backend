const { getProvider } = require('../providers/payments');
const { Payment } = require('../models/Payment');
const { logger } = require('../utils/logger');

let timer = null;

async function pollOnce(limit = 10) {
  const provider = getProvider();
  if (!provider.refreshPaymentStatus) return;
  const pendings = await Payment.find({ status: 'PENDING' }).sort({ createdAt: -1 }).limit(limit).exec();
  for (const p of pendings) {
    try {
      const result = await provider.refreshPaymentStatus(p);
      if (result.changed) {
        if (result.status) p.status = result.status;
        if (result.txHash) p.providerRef = result.txHash;
        p.events.push({ type: p.status, meta: { poller: true } });
        await p.save();
        logger.info(`[payments] updated ${p._id} -> ${p.status}`);
      }
    } catch (err) {
      logger.warn(`[payments] poll error for ${p._id}: ${err.message}`);
    }
  }
}

function startPaymentPoller() {
  const interval = Number(process.env.PAYMENTS_POLL_INTERVAL_MS || 15000);
  const batch = Number(process.env.PAYMENTS_POLL_BATCH || 10);
  if (timer) return;
  timer = setInterval(() => {
    pollOnce(batch).catch((err) => logger.warn(`[payments] pollOnce error: ${err.message}`));
  }, interval);
  logger.info(`[payments] poller started interval=${interval}ms batch=${batch}`);
}

module.exports = { startPaymentPoller };

