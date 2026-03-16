const express = require('express');
const router = express.Router(); // Restart Trigger: 01-05 13:20
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
        let predictedIndustry = null;
        let extractedKeyword = q; // Default to full query
        let tavilyQuery = q; // Optimized query for Tavily web search

        // [QUERY TRANSFORMER] Converts Korean buyer queries into targeted English B2B company searches.
        // e.g. "멕시코의 자동차부품 수입업체를 추천해 줘" → "Mexico automotive parts importer distributor company B2B"
        function buildTavilyQuery(originalQuery) {
            const qL = originalQuery.toLowerCase();

            const regionMap = [
                { kr: '아프리카', en: 'Africa' }, { kr: '중남미', en: 'Latin America' },
                { kr: '중동', en: 'Middle East' }, { kr: '동남아', en: 'Southeast Asia' },
                { kr: '유럽', en: 'Europe' }, { kr: '미국', en: 'USA' },
                { kr: '일본', en: 'Japan' }, { kr: '중국', en: 'China' },
                { kr: '인도', en: 'India' }, { kr: '브라질', en: 'Brazil' },
                { kr: '멕시코', en: 'Mexico' }, { kr: '베트남', en: 'Vietnam' },
                { kr: '태국', en: 'Thailand' }, { kr: '인도네시아', en: 'Indonesia' },
                { en: 'africa' }, { en: 'latin america' }, { en: 'middle east' },
                { en: 'southeast asia' }, { en: 'europe' }, { en: 'brazil' }, { en: 'mexico' },
                { en: 'vietnam' }, { en: 'thailand' }, { en: 'indonesia' },
            ];

            const productMap = [
                { kr: '자동차부품', en: 'automotive parts' }, { kr: '자동차 부품', en: 'automotive parts' },
                { kr: '화장품', en: 'cosmetics beauty' }, { kr: '뷰티', en: 'beauty cosmetics' },
                { kr: '식품', en: 'food products' }, { kr: '의류', en: 'clothing apparel' },
                { kr: '전자', en: 'electronics' }, { kr: '기계', en: 'machinery equipment' },
                { kr: '철강', en: 'steel metal' }, { kr: '섬유', en: 'textile fabric' },
                { kr: '화학', en: 'chemical' }, { kr: '의료기기', en: 'medical devices' },
                { kr: '건설', en: 'construction materials' }, { kr: '반도체', en: 'semiconductor' },
                { en: 'auto part' }, { en: 'cosmetic' }, { en: 'electronic' },
            ];

            let regionEn = '';
            for (const r of regionMap) {
                const key = r.kr || r.en;
                if (qL.includes(key.toLowerCase())) { regionEn = r.en || key; break; }
            }

            let productEn = '';
            for (const p of productMap) {
                const key = p.kr || p.en;
                if (qL.includes(key.toLowerCase())) { productEn = p.en || key; break; }
            }

            const isBuyer = ['수입업체', '수입상', '바이어', '구매자', 'importer', 'buyer'].some(k => qL.includes(k));
            const buyerType = isBuyer ? 'importer distributor buyer' : 'company';

            if (regionEn && productEn) return `${regionEn} ${productEn} ${buyerType} company B2B contact`;
            if (regionEn) return `${regionEn} ${buyerType} company Korea import B2B`;
            if (productEn) return `${productEn} ${buyerType} international company`;
            return originalQuery; // Fallback to original
        }

        if (q) {
            // [SMART ROUTER] Lightweight keyword-based intent detector.
            const regionKeywords = [
                '아프리카', '중남미', '중동', '동남아', '유럽', '미국', '일본', '중국', '인도', '브라질', '멕시코',
                '베트남', '태국', '인도네시아',
                'africa', 'latin america', 'middle east', 'southeast asia', 'europe', 'usa', 'america',
                'japan', 'china', 'india', 'brazil', 'mexico', 'vietnam', 'thailand', 'indonesia'
            ];
            const buyerIntentKeywords = [
                '수입업체', '수입사', '수입상', '바이어', '구매자', '해외바이어', '해외구매자',
                'importer', 'importers', 'buyer', 'buyers', 'purchaser', 'distributor'
            ];

            const qLower = q.toLowerCase();
            const hasRegion = regionKeywords.some(kw => qLower.includes(kw.toLowerCase()));
            const hasBuyerIntent = buyerIntentKeywords.some(kw => qLower.includes(kw.toLowerCase()));

            if (hasBuyerIntent) {
                forceWebSearch = true;
                tavilyQuery = buildTavilyQuery(q);
                console.log(`[Search] FOREIGN BUYER INTENT — Tavily query: "${tavilyQuery}"`);
            }

            extractedKeyword = q;
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

            // [SMART ROUTING] If AI predicted a specific industry (e.g. "Beauty & Cosmetics" for "Amorepacific"),
            // and the user didn't manually select one, ENFORCE it to remove noise (e.g. Food, Medical).
            if (!matchStage.industry && predictedIndustry) {
                console.log(`[Search] Applying Predicted Industry Filter: "${predictedIndustry}"`);
                // Use mapping if available to cover sub-categories or variations
                if (INDUSTRY_MAPPING[predictedIndustry]) {
                    matchStage.industry = { $in: INDUSTRY_MAPPING[predictedIndustry] };
                } else {
                    matchStage.industry = predictedIndustry;
                }
            }

            // [FIX] Exclude purely financial/investment firms from general vector search
            // This prevents "Pacific Fund" from matching "Amore Pacific"
            if (!matchStage.industry) {
                matchStage.industry = { $not: { $regex: /Investment|Fund|Asset|Capital/i } };
                // Also filter by NAME because many have "Unspecified" industry but clearly have "Fund" in name
                matchStage.name = { $not: { $regex: /Investment|Fund|Asset|Capital/i } };
            } else if (typeof matchStage.industry === 'string') {
                // If industry is already set (e.g. "Beauty"), we don't need to exclude, 
                // assuming "Beauty" doesn't overlap with "Fund".
            }

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
                    score: { $meta: 'vectorSearchScore' },
                    dart: 1,
                    culturalTraits: 1
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
        // This ensures we find data even if embeddings are missing (e.g., Mock Data or newly ingested DART data)
        if (!forceWebSearch && dbResults.length === 0 && extractedKeyword) {
            console.log(`[Search] Vector search yielded 0 results. Triggering Regex Fallback using keyword: "${extractedKeyword}"`);
            const filter = {};

            // Create a smart regex that looks for the extracted keyword instead of the full conversational sentence
            const regexQuery = { $regex: extractedKeyword, $options: 'i' };

            filter.$or = [
                { name: regexQuery },
                { nameEn: regexQuery },
                { profileText: regexQuery },
                { tags: regexQuery },
                { industry: regexQuery }
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

            // We no longer exclude investment/funds aggressively here because DART contains valid companies across all sectors.
            // We rely on the search term or user filters to narrow it down.

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
            console.log(`[Search] Tavily query: "${tavilyQuery}"`);
            const webResults = await searchWeb(tavilyQuery);

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
        /*
        // [OPTIMIZED] Commented out synchronous AI summary generation to prevent timeout.
        if (q && dbResults.length > 0) {
            const context = dbResults.slice(0, 5).map(c =>
                `- ${c.name} (${c.industry}, ${c.location.city}): ${c.profileText}`
            ).join('\n');

            const prompt = \`
            User Query: "${q}"
            
            Based on the following candidate companies, provide a brief, helpful recommendation to the user.
            Explain why these specific companies might be good matches.
            
            Candidates:
            \${context}
            
            Response (in the same language as the query, keep it professional and concise):
            \`;

            aiResponse = await chat([{ role: 'user', content: prompt }]);
        }
        */

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
