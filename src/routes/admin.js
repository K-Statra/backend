const express = require('express');
const Joi = require('joi');
const { Payment } = require('../models/Payment');
const { AuditLog } = require('../models/AuditLog');
const { MatchLog } = require('../models/MatchLog');
const { Company } = require('../models/Company');
const { Buyer } = require('../models/Buyer');
const mongoose = require('mongoose');

const router = express.Router();

function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN || '';
  const provided = req.headers['x-admin-token'];
  if (!token || !provided || provided !== token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

function validateQuery(schema) {
  return async (req, res, next) => {
    try {
      req.query = await schema.validateAsync(req.query, { abortEarly: false, stripUnknown: true, convert: true });
      next();
    } catch (err) { next(err); }
  };
}

const listPaymentsQuery = Joi.object({
  status: Joi.string().valid('CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'),
  buyerId: Joi.string().hex().length(24),
  companyId: Joi.string().hex().length(24),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

router.get('/payments', requireAdmin, validateQuery(listPaymentsQuery), async (req, res, next) => {
  try {
    const { status, buyerId, companyId, from, to, page, limit } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (buyerId) filter.buyerId = buyerId;
    if (companyId) filter.companyId = companyId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      Payment.countDocuments(filter),
    ]);
    res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data: items });
  } catch (err) { next(err); }
});

const statsQuery = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  buyerId: Joi.string().hex().length(24),
  companyId: Joi.string().hex().length(24),
});

router.get('/payments/stats', requireAdmin, validateQuery(statsQuery), async (req, res, next) => {
  try {
    const { buyerId, companyId } = req.query;
    const now = new Date();
    const defaultSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const from = req.query.from ? new Date(req.query.from) : defaultSince;
    const to = req.query.to ? new Date(req.query.to) : now;

    const match = { createdAt: { $gte: from } };
    if (to) match.createdAt.$lte = to;
    if (buyerId) match.buyerId = new mongoose.Types.ObjectId(buyerId);
    if (companyId) match.companyId = new mongoose.Types.ObjectId(companyId);

    const [byStatusAgg, byCurrencyAgg, byCurrencyStatusAgg] = await Promise.all([
      Payment.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Payment.aggregate([{ $match: match }, { $group: { _id: '$currency', count: { $sum: 1 } } }]),
      Payment.aggregate([{ $match: match }, { $group: { _id: { currency: '$currency', status: '$status' }, count: { $sum: 1 } } }]),
    ]);

    const byStatus = byStatusAgg.reduce((a, x) => ((a[String(x._id || 'UNKNOWN').toUpperCase()] = x.count), a), {});
    const byCurrency = byCurrencyAgg.reduce((a, x) => ((a[String(x._id || 'UNKNOWN').toUpperCase()] = x.count), a), {});
    const byCurrencyStatus = {};
    for (const row of byCurrencyStatusAgg) {
      const cur = String(row._id?.currency || 'UNKNOWN').toUpperCase();
      const st = String(row._id?.status || 'UNKNOWN').toUpperCase();
      byCurrencyStatus[cur] = byCurrencyStatus[cur] || {};
      byCurrencyStatus[cur][st] = (byCurrencyStatus[cur][st] || 0) + row.count;
    }

    res.json({ since: from.toISOString(), until: to.toISOString(), byStatus, byCurrency, byCurrencyStatus });
  } catch (err) { next(err); }
});

const matchLogQuery = Joi.object({
  buyerId: Joi.string().hex().length(24),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

router.get('/matches', requireAdmin, validateQuery(matchLogQuery), async (req, res, next) => {
  try {
    const { buyerId, page, limit } = req.query;
    const filter = {};
    if (buyerId) filter.buyerId = buyerId;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      MatchLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('buyerId', 'name').exec(),
      MatchLog.countDocuments(filter),
    ]);
    res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data: items });
  } catch (err) { next(err); }
});

router.get('/stats', requireAdmin, async (req, res, next) => {
  try {
    const [companies, buyers, payments, matches] = await Promise.all([
      Company.countDocuments({}),
      Buyer.countDocuments({}),
      Payment.countDocuments({}),
      MatchLog.countDocuments({}),
    ]);
    res.json({ companies, buyers, payments, matches });
  } catch (err) { next(err); }
});

const auditQuery = Joi.object({
  entityType: Joi.string().default('Payment'),
  entityId: Joi.string().required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

router.get('/audit', requireAdmin, validateQuery(auditQuery), async (req, res, next) => {
  try {
    const { entityType, entityId, page, limit } = req.query;
    const skip = (page - 1) * limit;
    const filter = { entityType, entityId };
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data: items });
  } catch (err) { next(err); }
});

// GET /admin/payments/export - CSV export with same filters as list
router.get('/payments/export', requireAdmin, validateQuery(listPaymentsQuery), async (req, res, next) => {
  try {
    const { status, buyerId, companyId, from, to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (buyerId) filter.buyerId = buyerId;
    if (companyId) filter.companyId = companyId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const items = await Payment.find(filter).sort({ createdAt: -1 }).limit(5000).exec();
    const header = ['_id', 'buyerId', 'companyId', 'amount', 'currency', 'status', 'provider', 'providerRef', 'createdAt'];
    const lines = [header.join(',')];
    for (const p of items) {
      const row = [
        p._id?.toString() || '',
        p.buyerId?.toString() || '',
        p.companyId?.toString() || '',
        String(p.amount ?? ''),
        String(p.currency ?? ''),
        String(p.status ?? ''),
        String(p.provider ?? ''),
        String(p.providerRef ?? ''),
        p.createdAt ? new Date(p.createdAt).toISOString() : '',
      ];
      const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
      lines.push(row.map(esc).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
    return res.send(lines.join('\n') + '\n');
  } catch (err) { next(err); }
});

// GET /admin/embedding - report current embedding provider/config status
router.get('/embedding', requireAdmin, async (req, res) => {
  try {
    const emb = require('../providers/embeddings');
    const provider = emb?.provider || String(process.env.EMBEDDINGS_PROVIDER || 'mock');
    const matchUseEmbedding = String(process.env.MATCH_USE_EMBEDDING || 'false').toLowerCase().trim() === 'true';
    const configured = provider === 'openai'
      ? Boolean(process.env.OPENAI_API_KEY)
      : provider === 'huggingface'
        ? Boolean(process.env.HF_API_TOKEN)
        : true;
    res.json({ provider, matchUseEmbedding, configured });
  } catch (e) {
    res.json({ provider: 'unknown', matchUseEmbedding: false, configured: false });
  }
});

module.exports = router;
