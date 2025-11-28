import { dict } from './i18n/dict'

export function normalizeLocale(loc) {
  const l = String(loc || '').toLowerCase()
  if (l.startsWith('ko')) return 'ko'
  if (l.startsWith('en')) return 'en'
  return 'ko'
}

export function computeExpiresInSec(expiresAt) {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / 1000))
}

export function buildGuideFromInvoice(invoice, localeInput) {
  const locale = normalizeLocale(localeInput)
  const t = dict[locale] || dict.ko
  const deeplink = invoice?.deeplink || ''
  const qr = invoice?.qr || deeplink
  const steps = []
  if (deeplink) steps.push({ key: 'payment.step.mobile_deeplink', default: t.guide_mobile })
  if (qr) steps.push({ key: 'payment.step.desktop_qr', default: t.guide_desktop })
  steps.push({ key: 'payment.step.expiry_notice', default: t.guide_expiry })
  return {
    title: t.payment_checkout_title,
    steps,
    texts: steps.map((s) => s.default),
    deeplink,
    qr,
    expiresInSec: computeExpiresInSec(invoice?.expiresAt),
    locale,
  }
}

