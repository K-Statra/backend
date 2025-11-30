const express = require('express');
const router = express.Router();
const { Company } = require('../models/Company');
const { embed } = require('../providers/embeddings');
const { chat } = require('../providers/chat/openai');
const { searchWeb } = require('../providers/search/tavily');

router.get('/search', async (req, res, next) => {
    try {
        const { q, limit = 10, industry, country, partnership, size } = req.query;

        console.log(`[Search] Query: "${q}"`);

        // 0. Intent Router (Agentic Decision)
        // Decide whether to use DB or Web based on the query domain.
        // Our DB is specialized in: Beauty, Consumer Goods, Food, Cosmetics.
        // If the query is clearly about something else (e.g., Automotive, Construction), skip DB.

        let forceWebSearch = false;
        if (q) {
            const routerPrompt = `
            You are a search router for a B2B matching platform specialized in "K-Beauty, Cosmetics, Food, and Consumer Goods".
            User Query: "${q}"
            
            Task: Determine if this query falls within our specialized domain.
            - If the query is about Beauty, Cosmetics, Skincare, Makeup, Food, Supplements, or general Consumer Goods, output "DB".
            - If the query is about Automotive, Machinery, Construction, IT, Electronics, or any other unrelated industry, output "WEB".
            - If unsure, output "DB".
            
            Output only one word: "DB" or "WEB".
            `;

            const decision = await chat(routerPrompt);
            console.log(`[Router] Decision: ${decision}`);

            if (decision && decision.trim().toUpperCase().includes('WEB')) {
                forceWebSearch = true;
            }
        }

        // 1. Try DB Search (Vector + Filter) - ONLY if Router says DB
        let dbResults = [];
        let vector = [];

        if (!forceWebSearch && q) {
            vector = await embed(q);
        }

        if (!forceWebSearch && vector.length > 0) {
            const pipeline = [
                {
                    $vectorSearch: {
                        index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                        path: 'embedding',
                        queryVector: vector,
                        numCandidates: 100,
                        limit: parseInt(limit)
                    }
                }
            ];

            const matchStage = {};
            if (industry) matchStage.industry = industry;
            if (country) matchStage['location.country'] = country;
            if (partnership) matchStage.tags = partnership;
            if (size) matchStage.sizeBucket = size;

            if (Object.keys(matchStage).length > 0) {
                pipeline.push({ $match: matchStage });
            }

            pipeline.push({
                $project: {
                    name: 1,
                    industry: 1,
                    location: 1,
                    profileText: 1,
                    website: 1,
                    tags: 1,
                    sizeBucket: 1,
                    matchRecommendation: 1,
                    matchAnalysis: 1,
                    score: { $meta: 'vectorSearchScore' }
                }
            });

            dbResults = await Company.aggregate(pipeline);
        }

        // 2. Evaluate DB Results
        // Fallback if Router forced Web OR if DB results are weak
        const shouldFallbackToWeb = forceWebSearch || dbResults.length < 3 || (dbResults[0] && dbResults[0].score < 0.85);

        if (shouldFallbackToWeb && q) {
            console.log(`[Search] Fallback triggered (Force: ${forceWebSearch}, Count: ${dbResults.length}), searching Web...`);
            const webResults = await searchWeb(q);
            const rawResults = webResults.results || [];
            const aiResponse = webResults.answer || "Here are the results found on the web.";

            const mappedWebResults = rawResults.map((item, index) => ({
                _id: `web_${index}`,
                name: item.title,
                industry: 'Web Result',
                location: { country: 'Global', city: '' },
                profileText: item.content,
                website: item.url,
                tags: ['Web'],
                matchRecommendation: 'Discovered via real-time web search.',
                matchAnalysis: [],
                score: item.score || 0.9
            }));

            return res.json({
                data: mappedWebResults,
                aiResponse: aiResponse,
                provider: 'tavily (fallback)'
            });
        }

        // 3. If DB results are good enough, return them
        // Fallback to Regex if vector search failed completely but we still want to try DB
        if (dbResults.length === 0) {
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

            dbResults = await Company.find(filter).limit(parseInt(limit)).lean();
            dbResults = dbResults.map(r => ({ ...r, score: 0.5 }));
        }

        // Generate AI Response for DB results
        let aiResponse = "";
        if (q && dbResults.length > 0) {
            const context = dbResults.slice(0, 5).map(c =>
                `- ${c.name} (${c.industry}, ${c.location.city}): ${c.profileText}`
            ).join('\n');

            const prompt = `
            User Query: "${q}"
            
            Based on the following candidate companies, provide a brief, helpful recommendation to the user.
            Explain why these specific companies might be good matches.
            
            Candidates:
            ${context}
            
            Response (in the same language as the query, keep it professional and concise):
            `;

            aiResponse = await chat(prompt);
        }

        res.json({
            data: dbResults,
            aiResponse: aiResponse,
            provider: 'db'
        });

    } catch (err) {
        console.error("Search Error:", err);
        next(err);
    }
});

module.exports = router;
