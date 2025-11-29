const express = require('express');
const Joi = require('joi');
const { Company } = require('../models/Company');
const { embed } = require('../providers/embeddings');
const { logger } = require('../utils/logger');

const router = express.Router();

const searchSchema = Joi.object({
    q: Joi.string().trim().allow(''),
    limit: Joi.number().integer().min(1).max(50).default(10),
    industry: Joi.string().trim().allow(''),
    country: Joi.string().trim().allow(''),
    partnership: Joi.string().trim().allow(''),
    size: Joi.string().allow(''),
});

router.get('/search', async (req, res, next) => {
    try {
        const { q, limit, industry, country, partnership, size } = await searchSchema.validateAsync(req.query, { stripUnknown: true });

        let results = [];

        if (q) {
            // Vector Search
            try {
                const vector = await embed(q);
                if (vector) {
                    const pipeline = [
                        {
                            $vectorSearch: {
                                index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                                path: 'embedding',
                                queryVector: vector,
                                numCandidates: 100,
                                limit: limit * 2, // Fetch more for post-filtering
                            },
                        },
                        {
                            $addFields: {
                                score: { $meta: 'vectorSearchScore' },
                            },
                        },
                    ];

                    // Post-filter
                    const match = {};
                    if (industry) match.industry = industry;
                    if (country) match['location.country'] = country;
                    if (partnership) match.tags = partnership;
                    if (size) match.sizeBucket = size;

                    if (Object.keys(match).length > 0) {
                        pipeline.push({ $match: match });
                    }

                    pipeline.push({ $limit: limit });

                    results = await Company.aggregate(pipeline);
                }
            } catch (err) {
                logger.warn('[partners] vector search failed', { error: err.message });
                // Fallback to regex if vector search fails
            }
        }

        // Fallback to standard search if no q or vector search failed/returned no results (optional, but good for robustness)
        if (results.length === 0) {
            const filter = {};
            if (q) {
                filter.$or = [
                    { name: { $regex: q, $options: 'i' } },
                    { profileText: { $regex: q, $options: 'i' } }
                ];
            }
            if (industry) filter.industry = industry;
            if (country) filter['location.country'] = country;
            if (partnership) filter.tags = partnership;
            if (size) filter.sizeBucket = size;

            results = await Company.find(filter).limit(limit).lean();
            // Add dummy score for consistency
            results = results.map(r => ({ ...r, score: 0.5 }));
        }

        res.json({ data: results });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
