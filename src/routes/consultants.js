const express = require('express')
const Joi = require('joi')
const mongoose = require('mongoose')
const { ConsultantRequest } = require('../models/ConsultantRequest')

const router = express.Router()

const createSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  email: Joi.string().trim().email().max(200).required(),
  details: Joi.string().allow('').max(4000),
  serviceType: Joi.string().trim().max(120).default('matching-assistant'),
  locale: Joi.string().trim().max(12).allow(''),
  source: Joi.string().trim().max(60).default('partner-search'),
  buyerId: Joi.string().hex().length(24).allow('', null),
  buyerName: Joi.string().trim().max(200).allow(''),
  searchTerm: Joi.string().trim().max(200).allow(''),
  filters: Joi.object().unknown(true).default({}),
})

router.post('/requests', async (req, res, next) => {
  try {
    const payload = await createSchema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    })

    const doc = {
      ...payload,
      filters: payload.filters || {},
    }
    if (payload.buyerId) {
      doc.buyerId = new mongoose.Types.ObjectId(payload.buyerId)
    }

    const created = await ConsultantRequest.create(doc)
    res.status(201).json({
      id: created._id,
      status: created.status,
      message: 'Request received',
    })
  } catch (err) {
    if (err.isJoi || err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation error',
        details: err.details ? err.details.map((d) => ({ message: d.message, path: d.path })) : [],
      })
    }
    return next(err)
  }
})

module.exports = router
