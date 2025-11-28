const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const { hmacSha256Hex } = require('../utils/crypto');
const { Payment } = require('../models/Payment');
const { AuditLog } = require('../models/AuditLog');
const { getProvider } = require('../providers/payments');
const { makeQuote } = require('../services/quote');
const { WebhookNonce } = require('../models/WebhookNonce');
const crypto = require('crypto');
const { computeRequestHash } = require('../services/paymentIdempotency');
const { canTransition, isQuoteExpired, computeExpectedSignatureV1, cryptoSafeEqual } = require('../services/paymentsSecurity');
const { buildPaymentGuide, computeExpiresInSec, normalizeLocale } = require('../services/paymentsUX');

const router = express.Router();

const { strictLimiter, globalLimiter } = require('../middleware/rateLimit');

// Use centralized limiters
const createLimiter = strictLimiter;
const webhookLimiter = strictLimiter; // Re-use strict or create specific if needed

function validateBody(schema) {
  return async (req, res, next) => {
    try {
      req.body = await schema.validateAsync(req.body, { abortEarly: false, stripUnknown: true, convert: true });
      next();
    } catch (err) { next(err); }
  };
}

function validateParams(schema) {
  return async (req, res, next) => {
    try {
      req.params = await schema.validateAsync(req.params, { abortEarly: false, stripUnknown: true, convert: true });
      next();
    } catch (err) { next(err); }
  };
}

const createPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().uppercase().valid('XRP', 'USD', 'KRW').default('XRP'),
  buyerId: Joi.string().hex().length(24).required(),
  companyId: Joi.string().hex().length(24).required(),
  memo: Joi.string().max(200).allow(''),
});

const idParamSchema = Joi.object({ id: Joi.string().hex().length(24).required() });

// Allowed status transitions moved to services/paymentsSecurity

// POST /payments — create a payment request (idempotent)
router.post('/', createLimiter, validateBody(createPaymentSchema), async (req, res, next) => {
  try {
    const idemKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key'] || req.body.idempotencyKey;
    if (!idemKey || String(idemKey).trim() === '') {
      return res.status(400).json({ message: 'Idempotency-Key header required' });
    }

    // Hash request content for safety against key reuse with different payload
    const requestHash = computeRequestHash(req.body);

    const existing = await Payment.findOne({ idempotencyKey: idemKey }).exec();
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return res.status(409).json({ message: 'Idempotency key conflict' });
      }
      return res.json(existing);
    }

    // Create payment in CREATED state + quote (if needed)
    const payment = await Payment.create({
      buyerId: req.body.buyerId,
      companyId: req.body.companyId,
      amount: req.body.amount,
      currency: req.body.currency,
      memo: req.body.memo || '',
      idempotencyKey: idemKey,
      requestHash,
      provider: process.env.PAYMENTS_PROVIDER || 'xrpl-testnet',
      status: 'CREATED',
      events: [{ type: 'CREATED', meta: { source: 'api' } }],
    });

    // Prepare quote if base currency is not XRP
    if (String(payment.currency).toUpperCase() !== 'XRP') {
      const q = makeQuote({ amount: payment.amount, baseCurrency: payment.currency });
      payment.quote = q;
    } else {
      // even for XRP, define a short-lived quote for uniformity
      const q = makeQuote({ amount: payment.amount, baseCurrency: 'XRP' });
      payment.quote = q;
    }

    // Provider invoice: generate deeplink/QR and set PENDING
    const provider = getProvider();
    const providerName = (process.env.PAYMENTS_PROVIDER || 'xrpl-testnet').toLowerCase();
    const curr = String(payment.currency || 'XRP').toUpperCase();
    // Graceful validation for not-yet-supported currencies per provider
    if (providerName.startsWith('xrpl') && curr !== 'XRP') {
      const allowIssued = String(process.env.ALLOW_ISSUED_XRPL || 'false').toLowerCase() === 'true';
      const code = String(process.env.XRPL_ISSUED_CURRENCY_CODE || '').toUpperCase();
      const issuer = process.env.XRPL_ISSUER_ADDRESS || '';
      if (!allowIssued || !code || !issuer || curr !== code) {
        return res.status(400).json({ message: 'Issued currencies like RLUSD are not enabled yet. Please use XRP for now.' });
      }
      // If configured, create a XUMM/Xaman payload invoice (stubbed).
      const useXumm = String(process.env.USE_XUMM_FOR_ISSUED || 'false').toLowerCase() === 'true';
      if (useXumm) {
        try {
          const xumm = require('../providers/payments/xumm');
          const inv = xumm.createIssuedInvoice(payment, { code, issuer });
          payment.providerRef = inv.providerRef;
          payment.invoice = { qr: inv.qr, deeplink: inv.deeplink, expiresAt: inv.expiresAt, destAddress: inv.destAddress, destTag: inv.destTag };
          payment.status = 'PENDING';
          payment.events.push({ type: 'PENDING', meta: { providerRef: payment.providerRef, currency: curr, code, issuer } });
          await payment.save();
          // Return consistent shape with guide
          const acceptLang = (req.headers['accept-language'] || '').toString();
          const guide = buildPaymentGuide(payment, normalizeLocale(acceptLang));
          const obj = payment.toObject({ virtuals: false });
          if (obj && obj.invoice) obj.invoice.expiresInSec = computeExpiresInSec(obj.invoice.expiresAt);
          return res.status(201).json({ payment: obj, guide });
        } catch (e) {
          // Fallback to placeholder if provider fails
        }
      }
      // Transitional placeholder invoice for issued currency
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      payment.providerRef = `xrpl_issued_${code}_${payment._id.toString()}`;
      payment.invoice = { qr: '', deeplink: '', expiresAt, destAddress: issuer, destTag: undefined };
      payment.memo = `Issued currency ${code} placeholder. See docs/payments.md for trust-line and wallet steps.`;
      payment.status = 'PENDING';
      payment.events.push({ type: 'PENDING', meta: { providerRef: payment.providerRef, currency: curr } });
      await payment.save();
      return res.status(201).json(payment);
    }
    if (providerName === 'stripe' && curr !== 'USD') {
      return res.status(400).json({ message: 'Only USD is supported with Stripe at the moment.' });
    }
    const inv = provider.createInvoiceFor(payment);
    payment.providerRef = inv.providerRef;
    payment.invoice = { qr: inv.qr, deeplink: inv.deeplink, expiresAt: inv.expiresAt, destAddress: inv.destAddress, destTag: inv.destTag };
    payment.status = 'PENDING';
    payment.events.push({ type: 'PENDING', meta: { providerRef: payment.providerRef } });
    await payment.save();

    try {
      await AuditLog.create({
        type: 'PAYMENT_CREATED',
        actor: 'api',
        entityType: 'Payment',
        entityId: payment._id.toString(),
        requestId: req.id,
        meta: { idempotencyKey: idemKey, provider: payment.provider },
      });
    } catch (_) { }

    // UX payload
    const acceptLang = (req.headers['accept-language'] || '').toString();
    const guide = buildPaymentGuide(payment, normalizeLocale(acceptLang));
    const obj = payment.toObject({ virtuals: false });
    if (obj && obj.invoice) obj.invoice.expiresInSec = computeExpiresInSec(obj.invoice.expiresAt);
    return res.status(201).json({ payment: obj, guide });
  } catch (err) {
    next(err);
  }
});
router.get('/summary', async (req, res, next) => {
  try {
    const payments = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalSent: { $sum: '$amount' },
          totalReceived: { $sum: '$amount' },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] } },
        },
      },
    ])
    const summary = payments[0] || { totalSent: 0, totalReceived: 0, pending: 0, completed: 0 }
    res.json({
      totalSent: summary.totalSent,
      totalReceived: summary.totalReceived,
      pendingTransactions: summary.pending,
      completedTransactions: summary.completed,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/recent', async (req, res, next) => {
  try {
    const docs = await Payment.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('amount currency status memo createdAt companyId')
      .populate('companyId', 'name')
      .lean()
    res.json(
      docs.map((doc) => ({
        id: doc._id,
        company: doc.companyId?.name || 'Unknown',
        amount: doc.amount,
        currency: doc.currency,
        status: doc.status,
        memo: doc.memo,
        createdAt: doc.createdAt,
      }))
    )
  } catch (err) {
    next(err)
  }
})
// GET /payments/:id — get payment status
router.get('/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const doc = await Payment.findById(req.params.id).exec();
    if (!doc) return res.status(404).json({ message: 'Not found' });
    return res.json(doc);
  } catch (err) { next(err); }
});

// POST /payments/:id/refresh — manually refresh status from provider
router.post('/:id/refresh', validateParams(idParamSchema), strictLimiter, async (req, res, next) => {
  try {
    const { getProvider } = require('../providers/payments');
    const provider = getProvider();
    const doc = await Payment.findById(req.params.id).exec();
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'PENDING') return res.json(doc);
    // Reject refresh transition to PAID if quote expired
    if (isQuoteExpired(doc)) {
      return res.status(409).json({ message: 'Quote expired. Please create a new payment.' });
    }
    if (!provider.refreshPaymentStatus) return res.json(doc);
    const result = await provider.refreshPaymentStatus(doc);
    if (result.changed) {
      if (result.status) doc.status = result.status;
      if (result.txHash) doc.providerRef = result.txHash;
      doc.events.push({ type: doc.status, meta: { manual: true } });
      await doc.save();
    }
    return res.json(doc);
  } catch (err) { next(err); }
});

// POST /payments/webhook — provider callback with HMAC signature
// Headers:
// - X-Signature-Version: v1 (recommended) or omitted (legacy)
// - X-Signature: sha256=<hex>
// - X-Signature-Timestamp: unix ms (v1)
// - X-Signature-Nonce: random string (v1)
router.post(
  '/webhook',
  webhookLimiter,
  express.raw({ type: '*/*' }),
  async (req, res) => {
    const secret = process.env.PAYMENTS_WEBHOOK_SECRET || '';
    if (!secret) return res.status(500).json({ message: 'Webhook secret not configured' });

    const sigHeader = req.headers['x-signature'];
    const version = (req.headers['x-signature-version'] || '').toString().toLowerCase();
    if (!sigHeader || typeof sigHeader !== 'string' || !sigHeader.startsWith('sha256=')) {
      return res.status(400).json({ message: 'Invalid signature header' });
    }
    let expected;
    if (version === 'v1') {
      const ts = req.headers['x-signature-timestamp'];
      const nonce = req.headers['x-signature-nonce'];
      if (!ts || !nonce) return res.status(400).json({ message: 'Missing signature timestamp/nonce' });
      // Optionally reject stale timestamps (5 min)
      const skewOk = Math.abs(Date.now() - Number(ts)) <= 5 * 60 * 1000;
      if (!skewOk) return res.status(401).json({ message: 'Signature timestamp expired' });
      // Nonce reuse prevention (TTL 10 min)
      const key = `${ts}.${nonce}`;
      try {
        await WebhookNonce.create({ key });
      } catch (_) {
        return res.status(409).json({ message: 'Replay detected' });
      }
      expected = computeExpectedSignatureV1(secret, ts, nonce, req.body);
    } else {
      // legacy: HMAC over raw body
      expected = hmacSha256Hex(secret, req.body);
    }
    const provided = sigHeader.slice('sha256='.length);
    if (!cryptoSafeEqual(expected, provided)) {
      return res.status(401).json({ message: 'Signature verification failed' });
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch (_) {
      return res.status(400).json({ message: 'Invalid JSON payload' });
    }

    // Expected minimal payload: { paymentId, event: 'PAID'|'FAILED'|'CANCELLED', providerRef? }
    const { paymentId, event, providerRef, meta } = payload || {};
    if (!paymentId || !event) {
      return res.status(400).json({ message: 'Missing paymentId or event' });
    }

    const doc = await Payment.findById(paymentId).exec();
    if (!doc) return res.status(404).json({ message: 'Payment not found' });

    const upperEvent = String(event).toUpperCase();
    // Map webhook event to status
    const nextStatus = upperEvent === 'PAID' ? 'PAID' : upperEvent === 'FAILED' ? 'FAILED' : upperEvent === 'CANCELLED' ? 'CANCELLED' : null;
    if (!nextStatus) return res.status(400).json({ message: 'Unsupported event' });
    if (!canTransition(doc.status, nextStatus)) {
      return res.status(409).json({ message: `Invalid transition ${doc.status} -> ${nextStatus}` });
    }

    // If quote expired, reject transition to PAID
    if (nextStatus === 'PAID' && isQuoteExpired(doc)) {
      return res.status(409).json({ message: 'Quote expired. Please create a new payment.' });
    }

    if (providerRef) doc.providerRef = providerRef;
    doc.status = nextStatus;
    doc.events.push({ type: nextStatus, meta: meta || {} });
    await doc.save();

    try {
      await AuditLog.create({
        type: `PAYMENT_${nextStatus}`,
        actor: 'provider',
        entityType: 'Payment',
        entityId: doc._id.toString(),
        requestId: req.id,
        meta: { providerRef: doc.providerRef, event: upperEvent },
      });
    } catch (_) { }

    return res.json({ ok: true });
  }
);

// GET /payments/currencies - list allowed currencies (backend-configured)
router.get('/currencies', async (req, res) => {
  try {
    const raw = process.env.PAYMENTS_ALLOWED_CURRENCIES || '';
    const list = String(raw)
      .split(',')
      .map((s) => String(s).trim().toUpperCase())
      .filter(Boolean);
    const unique = Array.from(new Set(list));
    res.json({ currencies: unique });
  } catch (e) {
    res.json({ currencies: [] });
  }
});

module.exports = router;

// POST /payments/xumm/webhook - XUMM payload callback (skeleton)
// Expected body: { uuid, status, paymentId? }
// Security: HMAC header X-Xumm-Signature: sha256=<hex> over raw body using XUMM_WEBHOOK_SECRET
router.post(
  '/xumm/webhook',
  webhookLimiter,
  express.raw({ type: '*/*' }),
  async (req, res) => {
    const secret = process.env.XUMM_WEBHOOK_SECRET || '';
    if (!secret) return res.status(500).json({ message: 'Webhook secret not configured' });
    const sigHeader = req.headers['x-xumm-signature'];
    if (!sigHeader || typeof sigHeader !== 'string' || !sigHeader.startsWith('sha256=')) {
      return res.status(400).json({ message: 'Invalid signature header' });
    }
    const expected = hmacSha256Hex(secret, req.body);
    const provided = sigHeader.slice('sha256='.length);
    if (!cryptoSafeEqual(expected, provided)) {
      return res.status(401).json({ message: 'Signature verification failed' });
    }
    let payload;
    try { payload = JSON.parse(req.body.toString('utf8')); } catch (_) {
      return res.status(400).json({ message: 'Invalid JSON payload' });
    }
    const uuid = payload?.uuid || '';
    const status = String(payload?.status || '').toUpperCase();
    const paymentId = payload?.paymentId || '';
    if (!uuid && !paymentId) return res.status(400).json({ message: 'Missing uuid or paymentId' });
    // Find payment by providerRef or explicit id
    let doc = null;
    if (paymentId) {
      doc = await Payment.findById(paymentId).exec();
    }
    if (!doc && uuid) {
      doc = await Payment.findOne({ providerRef: uuid }).exec();
    }
    if (!doc) return res.status(404).json({ message: 'Payment not found' });
    // Observability: record raw XUMM event regardless of transition
    try {
      await AuditLog.create({
        type: 'XUMM_EVENT',
        actor: 'xumm',
        entityType: 'Payment',
        entityId: (doc && doc._id ? doc._id.toString() : paymentId || 'unknown'),
        requestId: req.id,
        meta: { uuid, status },
      });
    } catch (_) { }

    // Map status
    const next = status === 'SIGNED' || status === 'COMPLETED' ? 'PAID'
      : status === 'REJECTED' || status === 'CANCELLED' ? 'CANCELLED' : null;
    if (!next) return res.json({ ok: true });
    if (!canTransition(doc.status, next)) return res.status(409).json({ message: `Invalid transition ${doc.status} -> ${next}` });
    doc.status = next;
    doc.events.push({ type: next, meta: { source: 'xumm', uuid } });
    await doc.save();
    try {
      await AuditLog.create({
        type: `PAYMENT_${next}`,
        actor: 'xumm',
        entityType: 'Payment',
        entityId: doc._id.toString(),
        requestId: req.id,
        meta: { uuid },
      });
    } catch (_) { }
    return res.json({ ok: true });
  }
);

