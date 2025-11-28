const mongoose = require('mongoose');
const express = require('express');
const Joi = require('joi');
const { Company } = require('../models/Company');

const router = express.Router();
const DEFAULT_COMPANY_IMAGE_URL = process.env.DEFAULT_COMPANY_IMAGE_URL || 'https://placehold.co/320x160?text=K-Statra';

function ensurePlaceholderImage(doc) {
  if (!doc) return;
  if (!Array.isArray(doc.images) || doc.images.length === 0) {
    doc.images = [
      {
        url: DEFAULT_COMPANY_IMAGE_URL,
        caption: 'Default image',
        alt: doc.name || 'K-Statra default image',
        tags: [],
      },
    ];
  }
}

/**
 * 공통 Body 검증 미들웨어
 */
function validateBody(schema) {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      // 중복 제거 & 공백 정리
      if (value.tags) {
        value.tags = [...new Set(value.tags.map(t => t.trim()).filter(Boolean))];
      }
      if (value.offerings) {
        value.offerings = value.offerings.map(o => o.trim()).filter(Boolean);
      }
      if (value.needs) {
        value.needs = value.needs.map(n => n.trim()).filter(Boolean);
      }
      if (typeof value.videoUrl === 'string') {
        value.videoUrl = value.videoUrl.trim();
      }

      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * 공통 Query 검증 미들웨어
 */
function validateQuery(schema) {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });
      req.query = value;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * 공통 Params(id 등) 검증 미들웨어
 */
function validateParams(schema) {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.params, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });
      req.params = value;
      next();
    } catch (err) {
      next(err);
    }
  };
}

const videoUrlSchema = Joi.string()
  .uri({ scheme: ['http', 'https'] })
  .max(500)
  .allow('')
  .messages({
    'string.uri': 'videoUrl must be a valid http/https link'
  });
// POST 생성 스키마
const createCompanySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  industry: Joi.string().trim().max(100).optional(),
  offerings: Joi.array().items(
    Joi.string().trim().min(1).max(50)
  ).default([]),
  needs: Joi.array().items(
    Joi.string().trim().min(1).max(50)
  ).default([]),
  tags: Joi.array().items(
    Joi.string().trim().min(1).max(30)
  ).default([]),
  profileText: Joi.string().max(2000).allow('').optional(),
  videoUrl: videoUrlSchema.default('')
  // embedding은 클라이언트에서 받지 않음
});

// PATCH 수정 스키마(부분 업데이트 허용, 최소 1개 필드 필요)
const updateCompanySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  industry: Joi.string().trim().max(100),
  offerings: Joi.array().items(
    Joi.string().trim().min(1).max(50)
  ),
  needs: Joi.array().items(
    Joi.string().trim().min(1).max(50)
  ),
  tags: Joi.array().items(
    Joi.string().trim().min(1).max(30)
  ),
  profileText: Joi.string().max(2000).allow(''),
  videoUrl: videoUrlSchema
}).min(1);

// ID 파라미터 검증
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required()
});

// GET 목록 쿼리 스키마 (검색 + 페이지네이션 + 정렬 + 자연정렬)
const listQuerySchema = Joi.object({
  q: Joi.string().trim().allow(''),
  industry: Joi.string().trim(),
  tag: Joi.string().trim(),
  country: Joi.string().trim().allow(''),
  size: Joi.string().valid('1-10', '11-50', '51-200', '201-1000', '1000+'),
  partnership: Joi.string().trim().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('updatedAt', 'name', 'nameNumeric').default('updatedAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

// 목록 (검색 + 페이지네이션 + 정렬)
router.get('/', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { q, industry, tag, country, size, partnership, page, limit, sortBy, order } = req.query;

    // 안전한 숫자 변환 + 기본값 보장
    const pageNum = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number.isFinite(Number(limit)) && Number(limit) > 0 && Number(limit) <= 100 ? Number(limit) : 10;

    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { profileText: { $regex: q, $options: 'i' } }
      ];
    }
    if (industry) filter.industry = industry;
    if (tag) filter.tags = tag;
    if (country) filter['location.country'] = country;
    if (size) filter.sizeBucket = size;
    if (partnership) filter.tags = partnership;

    const skip = (pageNum - 1) * limitNum;

    // 정렬 구성 (nameNumeric은 collation으로 자연정렬)
    const sortField = sortBy === 'nameNumeric' ? 'name' : sortBy;
    const sort = { [sortField]: order === 'asc' ? 1 : -1 };

    let findQuery = Company.find(filter).sort(sort).skip(skip).limit(limitNum);
    if (sortBy === 'nameNumeric') {
      // MongoDB 자연 정렬: 문자열 내 숫자를 숫자처럼 정렬
      findQuery = findQuery.collation({ locale: 'en', numericOrdering: true });
    }

    const [items, total] = await Promise.all([
      findQuery.exec(),
      Company.countDocuments(filter)
    ]);

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      data: items
    });
  } catch (err) {
    next(err);
  }
});

// 생성
router.post('/', validateBody(createCompanySchema), async (req, res, next) => {
  try {
    const doc = await Company.create(req.body);
    const hadImages = Array.isArray(doc.images) && doc.images.length > 0;
    ensurePlaceholderImage(doc);
    if (!hadImages) {
      await doc.save();
    }
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// 부분 수정(PATCH)
router.patch('/:id',
  validateParams(idParamSchema),
  validateBody(updateCompanySchema),
  async (req, res, next) => {
    try {
      const update = { ...req.body, updatedAt: new Date() };
      const doc = await Company.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true
      });
      if (!doc) {
        return res.status(404).json({ message: 'Company not found' });
      }
      res.json(doc);
    } catch (err) {
      next(err);
    }
  }
);

// 삭제(DELETE)
router.delete('/:id',
  validateParams(idParamSchema),
  async (req, res, next) => {
    try {
      const doc = await Company.findByIdAndDelete(req.params.id);
      if (!doc) {
        return res.status(404).json({ message: 'Company not found' });
      }
      // 본문 없는 성공
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

//단건 조회 라우트(GET /companies/:id)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    const doc = await Company.findById(id);
    if (!doc) {
      return res.status(404).json({ message: 'Not found' });
    }
    return res.json(doc);
  } catch (err) {
    console.error('GET /companies/:id error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;









