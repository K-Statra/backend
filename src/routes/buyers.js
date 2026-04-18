const express = require('express');
const mongoose = require('mongoose');
const Joi = require('joi');
const { Buyer } = require('../models/Buyer');
const { syncBuyerToGraph, removeFromGraph } = require('../services/graphSync');

const router = express.Router();

// 공통 검증 유틸
function validateBody(schema) {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.body, {
        abortEarly: false, stripUnknown: true, convert: true
      });
      // 중복 제거/트리밍
      if (value.tags) value.tags = [...new Set(value.tags.map(t => t.trim()).filter(Boolean))];
      if (value.industries) value.industries = [...new Set(value.industries.map(s => s.trim()).filter(Boolean))];
      if (value.needs) value.needs = [...new Set(value.needs.map(s => s.trim()).filter(Boolean))];
      req.body = value;
      next();
    } catch (err) { next(err); }
  };
}

function validateQuery(schema) {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.query, {
        abortEarly: false, stripUnknown: true, convert: true
      });
      req.query = value;
      next();
    } catch (err) { next(err); }
  };
}

function validateParams(schema) {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.params, {
        abortEarly: false, stripUnknown: true, convert: true
      });
      req.params = value;
      next();
    } catch (err) { next(err); }
  };
}

// 스키마 정의
const createBuyerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  country: Joi.string().trim().max(80).allow(''),
  industries: Joi.array().items(Joi.string().trim().min(1).max(50)).default([]),
  needs: Joi.array().items(Joi.string().trim().min(1).max(50)).default([]),
  tags: Joi.array().items(Joi.string().trim().min(1).max(30)).default([]),
  profileText: Joi.string().max(2000).allow('').optional()
});

const updateBuyerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  country: Joi.string().trim().max(80).allow(''),
  industries: Joi.array().items(Joi.string().trim().min(1).max(50)),
  needs: Joi.array().items(Joi.string().trim().min(1).max(50)),
  tags: Joi.array().items(Joi.string().trim().min(1).max(30)),
  profileText: Joi.string().max(2000).allow('')
}).min(1);

const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required()
});

const listQuerySchema = Joi.object({
  q: Joi.string().trim().allow(''),
  country: Joi.string().trim().allow(''),
  industry: Joi.string().trim().allow(''),
  tag: Joi.string().trim().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('updatedAt', 'name').default('updatedAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

// 목록
router.get('/', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { q, country, industry, tag, page, limit, sortBy, order } = req.query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;

    const filter = {};
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { profileText: { $regex: q, $options: 'i' } }
    ];
    if (country) filter.country = country;
    if (industry) filter.industries = industry;
    if (tag) filter.tags = tag;

    const sort = { [sortBy]: order === 'asc' ? 1 : -1 };
    const [items, total] = await Promise.all([
      Buyer.find(filter).sort(sort).skip((pageNum - 1) * limitNum).limit(limitNum).exec(),
      Buyer.countDocuments(filter)
    ]);

    return res.json({
      page: pageNum, limit: limitNum, total,
      totalPages: Math.ceil(total / limitNum),
      data: items
    });
  } catch (err) { next(err); }
});

// 생성
router.post('/', validateBody(createBuyerSchema), async (req, res, next) => {
  try {
    const doc = await Buyer.create(req.body);
    // Sync to Graph
    await syncBuyerToGraph(doc);
    return res.status(201).json(doc);
  } catch (err) { next(err); }
});

// 단건 조회
router.get('/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const doc = await Buyer.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    return res.json(doc);
  } catch (err) { next(err); }
});

// 부분 수정
router.patch('/:id',
  validateParams(idParamSchema),
  validateBody(updateBuyerSchema),
  async (req, res, next) => {
    try {
      const update = { ...req.body, updatedAt: new Date() };
      const doc = await Buyer.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
      if (!doc) return res.status(404).json({ message: 'Not found' });
      // Sync to Graph
      await syncBuyerToGraph(doc);
      return res.json(doc);
    } catch (err) { next(err); }
  }
);

// 삭제
router.delete('/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const doc = await Buyer.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    return res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;