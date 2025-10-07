const express = require('express');
const { Company } = require('../models/Company');
const router = express.Router();

// 회사 생성 (POST /companies)
router.post('/', async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const doc = await Company.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 회사 목록 (GET /companies?industry=IT&tag=b2b&q=Acme)
router.get('/', async (req, res) => {
  const { industry, tag, q } = req.query;
  const cond = {};
  if (industry) cond.industry = industry;
  if (tag) cond.tags = tag;
  if (q) cond.name = new RegExp(q, 'i');
  try {
    const list = await Company.find(cond).limit(50).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
