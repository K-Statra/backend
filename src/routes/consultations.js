const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { Consultation } = require('../models/Consultation');
const { Company } = require('../models/Company');
const { Buyer } = require('../models/Buyer');

const router = express.Router();

const createSchema = Joi.object({
  buyerId: Joi.string().hex().length(24).required(),
  companyId: Joi.string().hex().length(24).required(),
  reqType: Joi.string().valid('ONLINE', 'OFFLINE').default('OFFLINE'),
  date: Joi.date().iso().required(),
  timeSlot: Joi.string().required(),
  message: Joi.string().allow('').max(4000)
});

// Create Consultation Request
router.post('/', async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body, { stripUnknown: true });

    // Validate if buyer and company exist
    const buyer = await Buyer.findById(payload.buyerId);
    const company = await Company.findById(payload.companyId);

    if (!buyer || !company) {
      return res.status(404).json({ message: 'Buyer or Company not found' });
    }

    let meetingLink = undefined;
    let boothNumber = undefined;

    if (payload.reqType === 'ONLINE') {
        const roomName = `K-Statra-Meeting-${crypto.randomBytes(6).toString('hex')}`;
        meetingLink = `https://meet.jit.si/${roomName}`;
    } else {
        boothNumber = `Booth-${Math.floor(Math.random() * 900) + 100}`;
    }

    const doc = await Consultation.create({
      ...payload,
      buyerName: buyer.name,
      companyName: company.name,
      boothNumber,
      meetingLink
    });

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// List Consultations for a specific buyer or company
router.get('/', async (req, res, next) => {
  try {
    const { buyerId, companyId } = req.query;
    const filter = {};
    if (buyerId) filter.buyerId = buyerId;
    if (companyId) filter.companyId = companyId;

    const docs = await Consultation.find(filter).sort({ date: 1, timeSlot: 1 }).lean();
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// Update Status (eg. Set to COMPLETED or CONFIRMED)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'PAYMENT_PENDING'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const doc = await Consultation.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
