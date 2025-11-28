// XUMM/Xaman payload provider (skeleton)
// For issued currencies (e.g., RLUSD on XRPL), prefer creating a payload
// and directing the user to approve it in the wallet.
//
// This is a network-free stub that fabricates a payload URL based on payment id.
// Replace createIssuedInvoice with real XUMM SDK/API calls in production.

function ensureConfig() {
  const key = process.env.XUMM_API_KEY || ''
  const secret = process.env.XUMM_API_SECRET || ''
  // Do not throw to allow running without network/API; warn via return
  return { key, secret }
}

function createIssuedInvoice(payment, { code, issuer }) {
  const cfg = ensureConfig()
  try {
    // If API credentials exist, attempt to create a real payload
    if (cfg.key && cfg.secret) {
      const api = require('./xummApi')
      const dest = process.env.XRPL_DEST_ADDRESS || ''
      const destTag = payment?.invoice?.destTag
      return api
        .createIssuedPaymentPayload({
          amount: payment.amount,
          code,
          issuer,
          destination: dest,
          destTag,
          memo: payment.memo || undefined,
          expiresMinutes: 15,
        })
        .then((p) => {
          const deeplink = p.next || `https://xumm.app/detect?payload=${encodeURIComponent(p.uuid || 'unknown')}`
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
          return {
            providerRef: p.uuid || `payload_${code}_${payment._id?.toString()}`,
            deeplink,
            qr: deeplink,
            destAddress: dest,
            destTag,
            expiresAt,
            meta: { code, issuer },
          }
        })
    }
  } catch (_) {
    // fall through to stub
  }
  const id = payment?._id?.toString() || `${Date.now()}`
  const payloadId = `stub_${code}_${id}`
  const deeplink = `https://xumm.app/detect?payload=${encodeURIComponent(payloadId)}`
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  return {
    providerRef: payloadId,
    deeplink,
    qr: deeplink,
    destAddress: process.env.XRPL_DEST_ADDRESS || '',
    destTag: payment?.invoice?.destTag,
    expiresAt,
    meta: { code, issuer },
  }
}

module.exports = { createIssuedInvoice }
