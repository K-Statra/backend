const express = require('express');
const Joi = require('joi');
const { Company } = require('../models/Company');
const { embed } = require('../providers/embeddings');
const { chat } = require('../providers/chat/openai');
const { logger } = require('../utils/logger');

const router = express.Router();

const searchSchema = Joi.object({
    q: Joi.string().trim().allow(''),
    limit: Joi.number().integer().min(1).max(50).default(6),
    industry: Joi.string().trim().allow(''),
    country: Joi.string().trim().allow(''),
    partnership: Joi.string().trim().allow(''),
    size: Joi.string().allow(''),
});

router.get('/search', async (req, res, next) => {
    try {
        const { q, limit, industry, country, partnership, size } = await searchSchema.validateAsync(req.query, { stripUnknown: true });

        let results = [];
        let aiResponse = null;

        if (q) {
            // 1. Vector Search (Retrieval)
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
                                limit: limit * 2,
                            },
                        },
                        {
                            $addFields: {
                                score: { $meta: 'vectorSearchScore' },
                            },
                        },
                    ];

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
            }

            // 2. RAG (Generation)
            if (results.length > 0) {
                try {
                    const context = results.map((c, i) =>
                        `${i + 1}. ${c.name} (${c.location?.country || 'Unknown'}): ${c.industry}, ${c.profileText?.substring(0, 150)}...`
                    ).join('\n');

                    const systemPrompt = `You are a helpful B2B matching assistant for K-Statra.
User is looking for Korean business partners.
Based on the provided company list, recommend the best matches for the user's query.
- Be polite and professional.
- Briefly explain why these companies are good matches.
- If the user asks in Korean, reply in Korean.
- Format the output as a concise recommendation message.`;

                    const userMessage = `User Query: "${q}"

Candidate Companies:
${context}

Please recommend these companies to the user.`;

                    aiResponse = await chat([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ]);

                } catch (ragErr) {
                    logger.warn('[partners] RAG generation failed', { error: ragErr.message });
                }
            }
        }

        // Fallback if vector search returned nothing
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

        res.json({
            data: results,
            aiResponse: aiResponse
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
