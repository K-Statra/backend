function computeExpiresInSec(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

const MESSAGES = {
  ko: {
    title: '결제 안내',
    mobile_deeplink: '모바일 지갑에서 딥링크를 열어 결제를 승인하세요.',
    desktop_qr: '데스크톱 사용자는 지갑 앱으로 QR을 스캔하여 결제하세요.',
    expiry_notice: '결제 유효시간 내에 완료되지 않으면 만료됩니다.',
  },
  en: {
    title: 'Payment Guide',
    mobile_deeplink: 'Open the deeplink in your mobile wallet to approve the payment.',
    desktop_qr: 'On desktop, scan the QR with your wallet app to pay.',
    expiry_notice: 'Payment will expire if not completed within the validity period.',
  },
};

function normalizeLocale(loc) {
  const l = String(loc || '').toLowerCase();
  if (l.startsWith('ko')) return 'ko';
  if (l.startsWith('en')) return 'en';
  return process.env.PAYMENTS_GUIDE_DEFAULT_LOCALE || 'ko';
}

function buildPaymentGuide(payment, localeInput) {
  const deeplink = payment?.invoice?.deeplink || '';
  const qr = payment?.invoice?.qr || deeplink;
  const expiresInSec = computeExpiresInSec(payment?.invoice?.expiresAt);
  const locale = normalizeLocale(localeInput);
  const dict = MESSAGES[locale] || MESSAGES.ko;

  const steps = [];
  if (deeplink)
    steps.push({
      key: 'payment.step.mobile_deeplink',
      default: dict.mobile_deeplink,
    });
  if (qr)
    steps.push({
      key: 'payment.step.desktop_qr',
      default: dict.desktop_qr,
    });
  steps.push({
    key: 'payment.step.expiry_notice',
    default: dict.expiry_notice,
  });

  const texts = steps.map((s) => s.default);

  return {
    title: dict.title,
    steps,
    texts,
    deeplink,
    qr,
    expiresInSec,
    locale,
  };
}

module.exports = { buildPaymentGuide, computeExpiresInSec, normalizeLocale };
