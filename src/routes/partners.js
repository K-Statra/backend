const express = require('express');
const router = express.Router(); // Restart Trigger: 01-05 13:20
const mongoose = require('mongoose');
const { Company } = require('../models/Company');
const { embed } = require('../providers/embeddings');
const { chat } = require('../providers/chat/openai');
const { searchWeb } = require('../providers/search/tavily');
const { getGraphScores } = require('../services/graphScore');
const { extractSearchIntent } = require('../services/llm');

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
        let detectedIntent = 'company'; // 'buyer', 'seller', or 'company'
        let intentData = null; // Added for scope
        let aiResponse = ''; // Added to fix ReferenceError

        // [QUERY TRANSFORMER] Converts Korean buyer/seller queries into targeted English B2B searches.
        function buildTavilyQuery(originalQuery, intent) {
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

            if (intent === 'buyer') {
                const head = regionEn ? `${regionEn} ` : '';
                const prod = productEn ? `${productEn} ` : '';
                // Stronger negative keywords to filter manufacturers
                return `${head}${prod}importer distributor buyer B2B company -supplier -seller -manufacturer -factory -exporter -producer contact`;
            } else if (intent === 'seller') {
                const head = regionEn ? `${regionEn} ` : '';
                const prod = productEn ? `${productEn} ` : '';
                return `${head}${prod}exporter supplier manufacturer factory B2B -importer`;
            }

            return originalQuery;
        }

        if (q) {
            const regionKeywords = [
                '아프리카', '중남미', '중동', '동남아', '유럽', '미구', '미국', '일본', '중국', '인도', '브라질', '멕시코',
                '베트남', '태국', '인도네시아', '남아공', '남아프리카', '호주', '캐나다', '독일', '영국', '프랑스', '러시아',
                'africa', 'latin america', 'middle east', 'southeast asia', 'europe', 'usa', 'america',
                'japan', 'china', 'india', 'brazil', 'mexico', 'vietnam', 'thailand', 'indonesia', 'south africa',
                'australia', 'canada', 'germany', 'uk', 'france', 'russia'
            ];
            const koreaKeywords = ['한국', '국내', '남한', '코리아', 'korea', 'south korea'];

            const buyerKeywords = [
                '수입업체', '수입사', '수입상', '바이어', '구매자', '해외바이어', '해외구매자',
                'importer', 'importers', 'buyer', 'buyers', 'purchaser', 'distributor'
            ];
            const sellerKeywords = [
                '수출업체', '수출사', '수출상', '공급업체', '공급사', '제조업체', '제조사',
                'exporter', 'exporters', 'supplier', 'suppliers', 'manufacturer', 'seller'
            ];

            const qLower = q.toLowerCase();
            const hasRegion = regionKeywords.some(kw => qLower.includes(kw.toLowerCase()));
            const isKorea = koreaKeywords.some(kw => qLower.includes(kw.toLowerCase()));
            const hasBuyerIntent = buyerKeywords.some(kw => qLower.includes(kw.toLowerCase()));
            const hasSellerIntent = sellerKeywords.some(kw => qLower.includes(kw.toLowerCase()));
            
            console.log(`[Search Router] Query: "${q}"`);
            console.log(`[Search Router] hasRegion: ${hasRegion}, isKorea: ${isKorea}, hasBuyer: ${hasBuyerIntent}, hasSeller: ${hasSellerIntent}`);

            if (hasBuyerIntent) detectedIntent = 'buyer';
            else if (hasSellerIntent) detectedIntent = 'seller';

            // ROUTER LOGIC:
            // 1. If Foreign Region + (Buyer or Seller Intent) -> Use LLM to generate precise query
            // 2. Else If explicit Korea search -> ALWAYS DB
            // 3. Else -> DB
            if (hasRegion && (hasBuyerIntent || hasSellerIntent)) {
                forceWebSearch = true;
                try {
                    console.time('[Search] LLM Intent Extraction');
                    // Reduced timeout for production stability
                    const intentPromise = extractSearchIntent(q);
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('LLM Timeout')), 5000));
                    
                    intentData = await Promise.race([intentPromise, timeoutPromise]);
                    console.timeEnd('[Search] LLM Intent Extraction');

                    if (intentData?.webQuery) {
                        tavilyQuery = intentData.webQuery;
                        console.log(`[Search] LLM OPTIMIZED INTENT: "${tavilyQuery}" for ${intentData.country}`);
                    } else {
                        tavilyQuery = buildTavilyQuery(q, detectedIntent);
                    }
                } catch (err) {
                    console.error(`[Search] Intent extraction error/timeout: ${err.message}`);
                    tavilyQuery = buildTavilyQuery(q, detectedIntent);
                }
                console.log(`[Search] FOREIGN ${detectedIntent.toUpperCase()} INTENT to "${tavilyQuery}"`);
            } else if (isKorea) {
                forceWebSearch = false;
                console.log(`[Search] KOREAN CONTEXT DETECTED — Routing to Domestic DB.`);
            }

            extractedKeyword = q;
        }

        // 1. Try DB Search (Vector + Filter) - ONLY if Router says DB
        let dbResults = [];
        let vector = [];

        if (!forceWebSearch && q) {
            // Simple cleaner to strip filler words for better embedding focus
            const cleanQuery = (text) => {
                return text.replace(/(recommend me|please find|show me|find me|how about|search for|찾아줘|추천해줘|알려줘|보여줘)/gi, '').trim();
            };
            const strippedQ = cleanQuery(q) || q;

            try {
                console.time(`[Search] Embedding: ${strippedQ.substring(0, 20)}`);
                vector = await embed(strippedQ);
                console.timeEnd(`[Search] Embedding: ${strippedQ.substring(0, 20)}`);
                console.log(`[Search] Generated embedding for stripped query, length: ${vector.length}`);
            } catch (embedError) {
                console.error("[Search] Embedding generation failed:", embedError);
            }
        }

        if (!forceWebSearch && vector && vector.length > 0) {
            console.time('[Search] DB Vector Query');
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
                console.timeEnd('[Search] DB Vector Query');
                console.log(`[Search] Vector search returned ${dbResults.length} initial candidates.`);
            } catch (searchError) {
                console.error("[Search] Vector search error:", searchError);
                console.timeEnd('[Search] DB Vector Query');
                dbResults = [];
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
            console.log(`[Search] Default mode (Show All) - Fast fetch without sort`);
            // Avoid heavy sort on 130k+ docs for default load if possible
            dbResults = await Company.find({}).limit(parseInt(limit)).lean();
            dbResults = dbResults.map(r => ({ ...r, score: 1.0 }));
        }

        // 2. Evaluate DB Results
        // Fallback if Router forced Web OR if DB results are truly empty
        // (Relaxed condition: Only go to web if we have ZERO DB results)
        const shouldFallbackToWeb = forceWebSearch || dbResults.length === 0;

        if (shouldFallbackToWeb && q) {
            console.log(`[Search] Fallback triggered (Force: ${forceWebSearch}, Count: ${dbResults.length}), searching Web...`);
            console.log(`[Search] Tavily query: "${tavilyQuery}"`);
            
            let webResults = { results: [] };
            try {
                console.time('[Search] Tavily Fetch');
                const tavilyPromise = searchWeb(tavilyQuery);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Tavily Timeout')), 7000));
                
                webResults = await Promise.race([tavilyPromise, timeoutPromise]);
                console.timeEnd('[Search] Tavily Fetch');
            } catch (webErr) {
                console.error(`[Search] Tavily error/timeout: ${webErr.message}`);
            }

            const rawResults = webResults.results || [];
            aiResponse = webResults.answer || "Here are the results found on the web.";

            let mappedWebResults = rawResults.map((item, index) => {
                let score = item.score || 0.9;
                const title = (item.title || "").toLowerCase();
                const content = (item.content || "").toLowerCase();

                // RE-SCORING LOGIC per user requirements
                if (detectedIntent === 'buyer') {
                    // Penalty for manufacturers/exporters/suppliers when looking for buyers
                    const buyerPenalties = ['supplier', 'seller', 'manufacturer', 'factory', 'exporter', 'producer', 'industrial', 'plant'];
                    if (buyerPenalties.some(p => title.includes(p))) score -= 0.4;
                    if (buyerPenalties.some(p => content.includes(p))) score -= 0.2;

                    // Boost for importers
                    const boosTerms = ['importer', 'distributor', 'buyer', 'procurement', 'purchasing', 'trading'];
                    if (boosTerms.some(b => title.includes(b))) score += 0.2;
                    if (boosTerms.some(b => content.includes(b))) score += 0.1;

                    // Extra penalty for phrases like "we supply" or "manufacturer of"
                    if (content.includes('manufacture of') || content.includes('supply of') || content.includes('products from')) score -= 0.2;
                } else if (detectedIntent === 'seller') {
                    // Boost for sellers/suppliers
                    if (title.includes('supplier') || title.includes('exporter') || title.includes('manufacturer')) score += 0.1;
                    // Penalty for pure importers
                    if (title.includes('importer only')) score -= 0.2;
                }

                return {
                    _id: `web_${index}`,
                    name: item.title,
                    industry: 'Web Result',
                    location: { country: 'Global', city: '' },
                    profileText: item.content,
                    website: item.url,
                    tags: ['Web'],
                    matchRecommendation: `Discovered via real-time web search for ${detectedIntent}.`,
                    matchAnalysis: [],
                    score: Math.min(1.0, Math.max(0.1, score))
                };
            });

            // Soften country filter: Penalize instead of hard-filtering to handle short snippets
            if (intentData?.country) {
                const countryLower = intentData.country.toLowerCase();
                mappedWebResults = mappedWebResults.map(item => {
                    const content = (item.profileText || '').toLowerCase();
                    const name = (item.name || '').toLowerCase();
                    const matchesCountry = content.includes(countryLower) || name.includes(countryLower);
                    
                    if (!matchesCountry) {
                        console.log(`[Search] Penalizing non-explicit country match: ${item.name}`);
                        return { ...item, score: item.score * 0.7 }; // Lower score but don't hide
                    }
                    return item;
                });
            }

            // Sort by new score
            mappedWebResults.sort((a, b) => b.score - a.score);


            return res.json({
                data: mappedWebResults,
                aiResponse: aiResponse,
                provider: 'tavily (fallback)'
            });
        }

        // --- 3. Neo4j Graph Re-ranking (Hybrid Scoring) ---
        // If we have a buyer context and DB results, try to fetch graph scores.
        const useGraph = process.env.NEO4J_URI && dbResults.length > 0;
        let hybridResults = dbResults;

        if (useGraph) {
            // Attempt to identify buyer for personalized graph ranking
            const buyerId = req.query.buyerId; 
            
            if (buyerId && mongoose.Types.ObjectId.isValid(buyerId)) {
                console.log(`[Search] Calculating Graph Scores for Buyer: ${buyerId}`);
                const companyIds = dbResults.map(r => r._id.toString());
                
                let graphScores = {};
                try {
                    const graphPromise = getGraphScores(buyerId, companyIds);
                    const graphTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Graph Timeout')), 5000));
                    graphScores = await Promise.race([graphPromise, graphTimeout]);
                    console.log(`[Search] Graph scoring completed with ${Object.keys(graphScores).length} hits.`);
                } catch (gErr) {
                    console.error(`[Search] Graph scoring error/timeout: ${gErr.message}`);
                    graphScores = {}; // Fallback to no graph scores
                }

                const weight = Number(process.env.GRAPH_SCORE_WEIGHT || 0.3);
                
                hybridResults = dbResults.map(r => {
                    const gScore = graphScores[r._id.toString()] || 0;
                    const vScore = r.score || 0; // Vector score
                    
                    // Normalize scores for hybrid combination
                    // Scale graph score to 0..1 range (approx) assuming max ~6 points match
                    const normGraph = Math.min(1.0, gScore / 6.0);
                    
                    const compositeScore = (vScore * (1 - weight)) + (normGraph * weight);
                    
                    return {
                        ...r,
                        graphScore: gScore,
                        vectorScore: vScore,
                        score: compositeScore
                    };
                });

                // Re-sort by hybrid score
                hybridResults.sort((a, b) => b.score - a.score);
                console.log(`[Search] Hybrid ranking applied to ${hybridResults.length} items.`);
            }
        }

        // Determine if result came from Vector or Regex
        const firstResult = hybridResults[0];
        const searchType = hybridResults.length > 0 && 
            (firstResult.vectorScore === 0.85 || (firstResult.score === 0.85 && !firstResult.vectorScore)) ? 'REGEX' :
            hybridResults.length > 0 && 
            (firstResult.vectorScore === 1.0 || (firstResult.score === 1.0 && !firstResult.vectorScore)) ? 'BROWSE' : 'VECTOR';

        res.set('X-Search-Type', searchType);

        res.json({
            data: hybridResults,
            aiResponse: aiResponse,
            provider: 'db',
            debug: {
                searchType,
                count: hybridResults.length,
                graphUsed: !!(useGraph && req.query.buyerId)
            }
        });

    } catch (err) {
        console.error("Search Error:", err);
        next(err);
    }
});

module.exports = router;
