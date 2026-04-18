const express = require('express');
const Joi = require('joi');
const { Buyer } = require('../models/Buyer');
const { Company } = require('../models/Company');
const { MatchLog } = require('../models/MatchLog');
const { MatchFeedback } = require('../models/MatchFeedback');
const { logger } = require('../utils/logger');

const router = express.Router();

// 공통 Query 검증
function validateQuery(schema) {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      req.query = value;
      next();
    } catch (err) {
      next(err);
    }
  };
}

const listQuerySchema = Joi.object({
  buyerId: Joi.string().hex().length(24).required(),
  limit: Joi.number().integer().min(1).max(50).default(10),
});

const feedbackBodySchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comments: Joi.string().max(2000).allow(''),
  locale: Joi.string().max(12).allow('', null),
  source: Joi.string().max(60).allow('', null),
});

// 유틸
const toSet = (arr) =>
  new Set((arr || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean));

const intersectCount = (aSet, bSet) => {
  let c = 0;
  for (const x of aSet) if (bSet.has(x)) c++;
  return c;
};

// Cosine similarity for numeric vectors (0..1). Returns 0 if invalid.
function cosineSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0)
    return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
  if (!Number.isFinite(sim)) return 0;
  return Math.max(0, Math.min(1, sim));
}

// Imported from services
const { scoreCompany } = require('../services/matchScore');
const { generateMatchReasoning } = require('../services/llm');
const { getGraphScores } = require('../services/graphScore');

// GET /matches
router.get(
  '/',
  validateQuery(listQuerySchema),
  async (req, res, next) => {
    try {
      const { buyerId, limit } = req.query;

      const buyer = await Buyer.findById(buyerId);
      if (!buyer) return res.status(404).json({ message: 'Buyer not found' });

      let candidates = [];
      const useAtlasVector = process.env.MATCH_USE_ATLAS_VECTOR === 'true';
      const hasEmbedding = buyer.embedding && buyer.embedding.length > 0;

      if (useAtlasVector && hasEmbedding) {
        // MongoDB Atlas Vector Search
        // Requires a search index named 'vector_index' (or configured name)
        try {
          candidates = await Company.aggregate([
            {
              $vectorSearch: {
                index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                path: 'embedding',
                queryVector: buyer.embedding,
                numCandidates: 100,
                limit: 50,
              },
            },
            {
              $addFields: {
                vectorScore: { $meta: 'vectorSearchScore' },
              },
            },
          ]);
        } catch (aggErr) {
          logger.warn('[matches] vector search failed, falling back to standard query', { error: aggErr.message });
          candidates = await Company.find({}).sort({ updatedAt: -1 }).limit(200).lean();
        }
      } else {
        // Standard / Local fallback
        candidates = await Company.find({}).sort({ updatedAt: -1 }).limit(200).lean();
      }

      // 3. Batch Graph Scoring
      const candidateIds = candidates.map(c => c._id.toString());
      let graphScores = {};
      try {
        graphScores = await getGraphScores(buyerId, candidateIds);
      } catch (gErr) {
        logger.warn('[matches] graph scoring failed', { error: gErr.message });
      }

      const graphWeight = Number(process.env.GRAPH_SCORE_WEIGHT || 0.3);

      const scored = candidates
        .map((c) => {
          const { score: baseScore, reasons } = scoreCompany(buyer, c);
          const gScore = graphScores[c._id.toString()] || 0;
          
          let finalScore = baseScore;
          if (gScore > 0) {
            const graphContribution = gScore * graphWeight;
            finalScore += graphContribution;
            reasons.push(`graph relationship score +${graphContribution.toFixed(1)}`);
          }

          return { company: c, score: finalScore, reasons };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, Number(limit));

      // AI Enhancement for top match
      if (process.env.LLM_PROVIDER && scored.length > 0) {
        const topMatch = scored[0];
        try {
          // Async but await here to ensure it's in response. 
          // For production, might want parallel or background, but for now linear is fine.
          const reasoning = await generateMatchReasoning(buyer, topMatch.company);
          topMatch.ai_reasoning = reasoning;
        } catch (err) {
          logger.warn('[matches] AI reasoning failed', { error: err.message });
        }
      }

      // Persist a lightweight log of the query
      try {
        await MatchLog.create({
          buyerId: buyer._id,
          params: { limit: Number(limit) },
          results: scored.map((r) => ({
            companyId: r.company._id,
            score: r.score,
            reasons: r.reasons.slice(0, 5),
          })),
        });
      } catch (logErr) {
        // non-blocking
        try {
          logger.warn('[matches] failed to log match result', {
            requestId: req.id,
            buyerId: buyer._id?.toString(),
            error: logErr.message,
          });
        } catch (_) { }
      }

      return res.json({
        query: { buyerId, limit: Number(limit) },
        count: scored.length,
        data: scored,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:companyId/feedback', async (req, res, next) => {
  try {
    const params = await Joi.object({
      companyId: Joi.string().hex().length(24).required(),
    }).validateAsync(req.params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    const payload = await feedbackBodySchema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    const company = await Company.findById(params.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const doc = await MatchFeedback.create({
      companyId: company._id,
      rating: payload.rating,
      comments: payload.comments || '',
      locale: payload.locale || '',
      source: payload.source || 'partner-search',
    });

    return res.status(201).json({ message: 'Feedback saved', id: doc._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.scoreCompany = scoreCompany;
