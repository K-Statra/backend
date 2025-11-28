// Stripe provider stub (fiat USD) for future integration
// Notes:
// - In production, use Stripe SDK to create Checkout Session / PaymentIntent
// - Webhook verification must use Stripe signature scheme

function ensureConfig() {
  const key = process.env.STRIPE_API_KEY || ''
  // We don't throw here to allow running in dev without network
  return { key }
}

function createInvoiceFor(payment) {
  ensureConfig()
  const amount = payment.amount
  const currency = (payment.currency || 'USD').toUpperCase()
  const id = payment._id?.toString() || 'payment'
  // Placeholder session URL (replace with real after Stripe integration)
  const sessionUrl = `https://checkout.stripe.com/pay/test_${id}`
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  return {
    providerRef: `stripe_${id}`,
    deeplink: sessionUrl,
    qr: sessionUrl,
    destAddress: '',
    destTag: undefined,
    expiresAt,
    amount,
    currency,
  }
}

async function refreshPaymentStatus(payment) {
  // In a real integration, retrieve Checkout Session / PaymentIntent
  // and map to our statuses. Here we return unchanged.
  return { changed: false }
}

module.exports = { createInvoiceFor, refreshPaymentStatus }

