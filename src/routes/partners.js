const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Company } = require('../models/Company');
const { embed } = require('../providers/embeddings');
const { chat } = require('../providers/chat/openai');
const { searchWeb } = require('../providers/search/tavily');

const INDUSTRY_MAPPING = {
    'IT / AI / SaaS': ['IT / AI / SaaS', 'Tech & Electronics', 'Software'],
    'Healthcare / Bio / Medical': ['Healthcare / Bio / Medical', 'Health & Bio', 'Medical'],
    'Green Energy / Climate Tech / Smart City': ['Green Energy / Climate Tech / Smart City', 'Energy & Environment'],
    'Mobility / Automation / Manufacturing': ['Mobility / Automation / Manufacturing', 'Industrial & Manufacturing', 'Mobility'],
    'Beauty / Consumer Goods / Food': ['Beauty / Consumer Goods / Food', 'Beauty & Cosmetics', 'Food & Beverage', 'Consumer Goods'],
    'Content / Culture / Edutech': ['Content / Culture / Edutech', 'Content', 'Education'],
    'Fintech / Smart Finance': ['Fintech / Smart Finance', 'Finance'],
    'Other': ['Other', '(Unspecified)']
};


// DEBUG ENDPOINT
router.get('/debug', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
        const docCount = await Company.countDocuments();

        let embeddingStatus = 'Not Tested';
        let embeddingError = null;
        try {
            const v = await embed('test');
            embeddingStatus = `Success (Length: ${v.length})`;
        } catch (e) {
            embeddingStatus = 'Failed';
            embeddingError = e.message;
        }

        res.json({
            status: 'ok',
            version: '1.2-debug-fix', // Verify deployment
            env: {
                ATLAS_VECTOR_INDEX: process.env.ATLAS_VECTOR_INDEX || '(not set)',
                OPENAI_API_KEY_EXISTS: !!process.env.OPENAI_API_KEY,
                MONGO_URI_CONFIGURED: !!process.env.MONGODB_URI,
                NODE_ENV: process.env.NODE_ENV
            },
            db: {
                status: dbStatus,
                companyCount: docCount
            },
            embedding: {
                status: embeddingStatus,
                error: embeddingError
            },
            sampleData: await Company.find({}, { name: 1, industry: 1, profileText: 1 }).limit(5).lean(),
            industryStats: await Company.aggregate([
                { $group: { _id: "$industry", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),
            embeddingCount: await Company.countDocuments({ embedding: { $exists: true, $not: { $size: 0 } } })
        });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

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

            const decision = await chat([{ role: 'user', content: routerPrompt }]);
            console.log(`[Router] Decision: ${decision}`);

            if (decision && decision.trim().toUpperCase().includes('WEB')) {
                forceWebSearch = true;
            }
        }

        // 1. Try DB Search (Vector + Filter) - ONLY if Router says DB
        let dbResults = [];
        let vector = [];

        if (!forceWebSearch && q) {
            try {
                vector = await embed(q);
                console.log(`[Search] Generated embedding for "${q}", length: ${vector.length}`);
            } catch (embedError) {
                console.error("[Search] Embedding generation failed:", embedError);
                // Fallback will handle this since vector will be empty/undefined
            }
        }

        if (!forceWebSearch && vector && vector.length > 0) {
            console.log(`[Search] Running Vector Search... Index: ${process.env.ATLAS_VECTOR_INDEX || 'vector_index'}`);

            const pipeline = [
                {
                    $vectorSearch: {
                        index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                        path: 'embedding',
                        queryVector: vector,
                        numCandidates: 100,
                        limit: parseInt(limit) * 2 // Fetch more candidates to allow for post-filtering
                    }
                }
            ];

            const matchStage = {};
            if (industry) {
                if (INDUSTRY_MAPPING[industry]) {
                    // Use $in for mapped industries
                    matchStage.industry = { $in: INDUSTRY_MAPPING[industry] };
                } else {
                    // Direct match
                    matchStage.industry = industry;
                }
            }
            if (country) matchStage['location.country'] = country;
            if (partnership) matchStage.tags = partnership;
            if (size) matchStage.sizeBucket = size;

            // Log the match stage for debugging
            console.log(`[Search] Match Filters:`, JSON.stringify(matchStage));

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

            // Limit final results
            pipeline.push({ $limit: parseInt(limit) });

            try {
                dbResults = await Company.aggregate(pipeline);
                console.log(`[Search] Vector search returned ${dbResults.length} results.`);
            } catch (aggError) {
                console.error("[Search] Vector search aggregation failed:", aggError);
                // Fallback will trigger if dbResults is empty
            }
        }

        // 1.5. Fallback to Regex if Vector Search returned nothing or failed
        // This ensures we find data even if embeddings are missing (e.g., Mock Data)
        if (!forceWebSearch && dbResults.length === 0 && q) {
            console.log(`[Search] Vector search yielded 0 results. Triggering Regex Fallback for: "${q}"`);
            const filter = {};
            filter.$or = [
                { name: { $regex: q, $options: 'i' } },
                { profileText: { $regex: q, $options: 'i' } },
                { tags: { $regex: q, $options: 'i' } }, // Also search tags
                { industry: { $regex: q, $options: 'i' } } // Also search industry
            ];

            if (industry) {
                if (INDUSTRY_MAPPING[industry]) {
                    filter.industry = { $in: INDUSTRY_MAPPING[industry] };
                } else {
                    filter.industry = industry;
                }
            }
            if (country) filter['location.country'] = country;
            if (partnership) filter.tags = partnership;
            if (size) filter.sizeBucket = size;

            console.log(`[Search] Regex Filter:`, JSON.stringify(filter));

            dbResults = await Company.find(filter).limit(parseInt(limit)).lean();
            console.log(`[Search] Regex search returned ${dbResults.length} results.`);

            // Assign a "fake" high score so it doesn't trigger web fallback immediately
            dbResults = dbResults.map(r => ({ ...r, score: 0.85 }));
        }

        // 1.8. Browsing Mode (No Query, Only Filters)
        if (!forceWebSearch && !q && (industry || country || partnership || size)) {
            console.log(`[Search] Browsing mode (Filters only)`);
            const filter = {};
            if (industry) {
                if (INDUSTRY_MAPPING[industry]) {
                    filter.industry = { $in: INDUSTRY_MAPPING[industry] };
                } else {
                    filter.industry = industry;
                }
            }
            if (country) filter['location.country'] = country;
            if (partnership) filter.tags = partnership;
            if (size) filter.sizeBucket = size;

            dbResults = await Company.find(filter).limit(parseInt(limit)).sort({ createdAt: -1 }).lean();
            // Assign default score
            dbResults = dbResults.map(r => ({ ...r, score: 1.0 }));
        }

        // 1.9. Default "Show All" Mode (No Query, No Filters)
        if (!forceWebSearch && !q && dbResults.length === 0) {
            console.log(`[Search] Default mode (Show All)`);
            dbResults = await Company.find({}).sort({ createdAt: -1 }).limit(parseInt(limit)).lean();
            dbResults = dbResults.map(r => ({ ...r, score: 1.0 }));
        }

        // 2. Evaluate DB Results
        // Fallback if Router forced Web OR if DB results are truly empty
        // (Relaxed condition: Only go to web if we have ZERO DB results)
        const shouldFallbackToWeb = forceWebSearch || dbResults.length === 0;

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

            aiResponse = await chat([{ role: 'user', content: prompt }]);
        }

        // Determine if result came from Vector or Regex
        // We know it fell back to regex if we are here and forceWebSearch is false
        // But wait, the previous code structure is a bit linear. 
        // Let's rely on the fact that if 'score' is 0.85 (Regex) or 1.0 (Browsable) vs others.
        // Or simply set a header based on logic flow.
        const searchType = dbResults.length > 0 && dbResults[0].score === 0.85 ? 'REGEX' :
            dbResults.length > 0 && dbResults[0].score === 1.0 ? 'BROWSE' : 'VECTOR';

        res.set('X-Search-Type', searchType);

        res.json({
            data: dbResults,
            aiResponse: aiResponse,
            provider: 'db',
            debug: {
                searchType,
                count: dbResults.length
            }
        });

    } catch (err) {
        console.error("Search Error:", err);
        next(err);
    }
});

module.exports = router;
