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
    'Automotive / EV Parts': ['Mobility / Automation / Manufacturing', 'Industrial & Manufacturing', 'Mobility', 'Automotive', 'Car parts', 'EV'],
    'IT / AI / SaaS': ['IT / AI / SaaS', 'Tech & Electronics', 'Software'],
    'Healthcare / Bio / Medical': ['Healthcare / Bio / Medical', 'Health & Bio', 'Medical'],
    'Green Energy / Climate Tech / Smart City': ['Green Energy / Climate Tech / Smart City', 'Energy & Environment'],
    'Mobility / Automation / Manufacturing': ['Mobility / Automation / Manufacturing', 'Industrial & Manufacturing', 'Mobility'],
    'Beauty / Consumer Goods / Food': ['Beauty / Consumer Goods / Food', 'Beauty & Cosmetics', 'Food & Beverage', 'Consumer Goods'],
    'Content / Culture / Edutech': ['Content / Culture / Edutech', 'Content', 'Education'],
    'Fintech / Smart Finance': ['Fintech / Smart Finance', 'Finance'],
    'Other': ['Other', '(Unspecified)']
};

// --- PERFORMANCE CACHE ---
const EMBEDDING_CACHE = new Map();
const INTENT_CACHE = new Map();
const MAX_CACHE_SIZE = 500;

function getCachedEmbedding(text) {
    if (EMBEDDING_CACHE.has(text)) {
        console.log(`[Cache] Embedding Hit for: "${text.substring(0, 20)}..."`);
        return EMBEDDING_CACHE.get(text);
    }
    return null;
}

function setCachedEmbedding(text, vector) {
    if (EMBEDDING_CACHE.size >= MAX_CACHE_SIZE) {
        const firstKey = EMBEDDING_CACHE.keys().next().value;
        EMBEDDING_CACHE.delete(firstKey);
    }
    EMBEDDING_CACHE.set(text, vector);
}

function getCachedIntent(text) {
    if (INTENT_CACHE.has(text)) {
        console.log(`[Cache] Intent Hit for: "${text.substring(0, 20)}..."`);
        return INTENT_CACHE.get(text);
    }
    return null;
}

function setCachedIntent(text, intentData) {
    if (INTENT_CACHE.size >= MAX_CACHE_SIZE) {
        const firstKey = INTENT_CACHE.keys().next().value;
        INTENT_CACHE.delete(firstKey);
    }
    INTENT_CACHE.set(text, intentData);
}
// -------------------------


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

        // --- OPTIMIZED PARALLEL PIPELINE ---
        let forceWebSearch = false;
        let predictedIndustry = null;
        let extractedKeyword = q;
        let tavilyQuery = q;
        let detectedIntent = 'company';
        let intentData = null;
        let aiResponse = '';
        let vector = [];
        let dbResults = [];

        // [QUERY TRANSFORMER] Converts Korean buyer/seller queries into targeted English B2B searches.
        function buildTavilyQuery(originalQuery, intent) {
            const qL = originalQuery.toLowerCase();
            const regionMap = [
                { kr: '미국', en: 'USA' }, { kr: '캐나다', en: 'Canada' }, { kr: '멕시코', en: 'Mexico' },
                { kr: '브라질', en: 'Brazil' }, { kr: '칠레', en: 'Chile' }, { kr: '아르헨티나', en: 'Argentina' },
                { kr: '영국', en: 'UK' }, { kr: '독일', en: 'Germany' }, { kr: '프랑스', en: 'France' },
                { kr: '이탈리아', en: 'Italy' }, { kr: '스페인', en: 'Spain' }, { kr: '일본', en: 'Japan' },
                { kr: '중국', en: 'China' }, { kr: '베트남', en: 'Vietnam' }, { kr: '태국', en: 'Thailand' },
                { kr: '인도네시아', en: 'Indonesia' }, { kr: '인니', en: 'Indonesia' }, { kr: '사우디', en: 'Saudi Arabia' },
                { kr: 'uae', en: 'UAE' }, { kr: '콜롬비아', en: 'Colombia' }, { kr: '남아공', en: 'South Africa' }, { kr: '남아프리카', en: 'South Africa' },
                { kr: '페루', en: 'Peru' }, { kr: '케냐', en: 'Kenya' }
            ];
            const productMap = [
                { kr: '자동차부품', en: 'automotive parts' }, { kr: '자동차 부품', en: 'automotive parts' },
                { kr: '타이어', en: 'tires' }, { kr: '엔진', en: 'engine parts' }, { kr: '배터리', en: 'EV battery' }
            ];

            let regionEn = '';
            for (const r of regionMap) { if (qL.includes(r.kr.toLowerCase())) { regionEn = r.en; break; } }
            let productEn = '';
            for (const p of productMap) { if (qL.includes(p.kr.toLowerCase())) { productEn = p.en; break; } }

            const head = regionEn ? `${regionEn} ` : '';
            const prod = productEn ? `${productEn} ` : '';

            if (intent === 'buyer') {
                return `${head}${prod}importer distributor buyer B2B company "contact" -software -crm -erp -platform -capterra -linkedin -yelp -facebook -twitter -instagram -pinterest -expo -exhibition -fair -event -conference -tradekey -volza -zoominfo -alibaba -kompass -thomasnet -globalsources -dnb -indiamart`;
            } else if (intent === 'seller') {
                return `${head}${prod}exporter supplier manufacturer factory B2B -importer -buyer -software -crm -erp -platform -capterra -linkedin -yelp -facebook -twitter -instagram -pinterest -expo -exhibition -fair -event -conference -tradekey -volza -zoominfo -alibaba -kompass -thomasnet -globalsources -dnb -indiamart`;
            }
            // General Company Intent Fallback (Prevent news articles by enforcing B2B and excluding news terms)
            if (head || prod) {
                return `${head}${prod}B2B company "contact" -news -article -journal -software -crm -erp -platform -capterra -linkedin -yelp -facebook -twitter -instagram -pinterest -expo -exhibition -fair -event -conference -tradekey -volza -zoominfo -alibaba -kompass -thomasnet -globalsources -dnb -indiamart`;
            }
            return originalQuery;
        }

        const cleanQuery = (text) => {
            if (!text) return '';
            return text.replace(/(recommend me|please find|show me|find me|how about|search for|찾아줘|추천해줘|알려줘|보여줘)/gi, '').trim();
        };

        const strippedQ = q ? cleanQuery(q) : null;
        const automotiveKeywords = ['자동차', '부품', 'automotive', 'car parts', 'ev', 'machinery', 'parts', '배터리', 'battery'];
        const regionKeywords = [
            '미국', '미구', '캐나다', '멕시코', '브라질', '칠레', '아르헨티나', '콜롬비아', '페루', '영국', '독일', '프랑스', '이탈리아', '스페인', '일본', '중국', '인도', '베트남', '태국', '인도네시아', '인니', '사우디', 'uae', '남아공', '남아프리카', '케냐', 'usa', 'uk', 'germany', 'france', 'italy', 'spain', 'japan', 'china', 'india', 'vietnam', 'thailand', 'indonesia', 'colombia', 'peru', 'chile', 'mexico', 'south africa', 'kenya'
        ];
        const buyerKeywords = ['수입업체', '수입사', '수입상', '바이어', '구매자', '해외바이어', 'importer', 'buyer', 'distributor'];
        const sellerKeywords = ['수출업체', '수출사', '수출상', '공급업체', '공급사', '제조업체', 'exporter', 'supplier', 'manufacturer'];

        const qLower = q ? q.toLowerCase() : '';
        const hasRegion = regionKeywords.some(kw => qLower.includes(kw.toLowerCase()));
        const isAutomotive = automotiveKeywords.some(kw => qLower.includes(kw.toLowerCase()));
        const hasBuyerIntent = buyerKeywords.some(kw => qLower.includes(kw.toLowerCase()));
        const hasSellerIntent = sellerKeywords.some(kw => qLower.includes(kw.toLowerCase()));

        if (hasBuyerIntent) detectedIntent = 'buyer';
        else if (hasSellerIntent) detectedIntent = 'seller';

        // 0.1 Parallel Kick-off: Intent Extraction + Embedding
        const cachedIntentData = (q && hasRegion && (hasBuyerIntent || hasSellerIntent)) ? getCachedIntent(q) : null;
        const intentPromise = (q && hasRegion && (hasBuyerIntent || hasSellerIntent) && !cachedIntentData) ? 
            Promise.race([extractSearchIntent(q), new Promise((_, reject) => setTimeout(() => reject(new Error('LLM Timeout')), 4000))]) : 
            Promise.resolve(cachedIntentData);

        const cachedVector = strippedQ ? getCachedEmbedding(strippedQ) : null;
        const embeddingPromise = (strippedQ && !cachedVector) ? embed(strippedQ) : Promise.resolve(cachedVector);

        console.time('[Search] Parallel Tasks');
        const [resolvedIntentData, resolvedVector] = await Promise.all([intentPromise, embeddingPromise]);
        console.timeEnd('[Search] Parallel Tasks');

        intentData = resolvedIntentData;
        vector = resolvedVector;

        if (q && resolvedIntentData && !cachedIntentData) {
            setCachedIntent(q, resolvedIntentData);
        }

        if (strippedQ && resolvedVector && !cachedVector) {
            setCachedEmbedding(strippedQ, resolvedVector);
        }

        // 0.2 Routing Logic based on resolved intent
        if (intentData) {
            forceWebSearch = true;
            tavilyQuery = intentData.webQuery || buildTavilyQuery(q, detectedIntent);
            extractedKeyword = intentData.subject || q;
            predictedIndustry = intentData.subject || null;
        } else if (q && hasRegion && isAutomotive) {
            forceWebSearch = true;
            tavilyQuery = buildTavilyQuery(q, detectedIntent);
        } else if (q && hasRegion) {
            forceWebSearch = true;
            tavilyQuery = buildTavilyQuery(q, detectedIntent);
        }

        if (!forceWebSearch && vector && vector.length > 0) {
            console.time('[Search] DB Vector Query');
            console.log(`[Search] Running Vector Search... Index: ${process.env.ATLAS_VECTOR_INDEX || 'vector_index'}`);

            const vectorFilter = {};
            if (industry) {
                if (INDUSTRY_MAPPING[industry]) {
                    vectorFilter.industry = { $in: INDUSTRY_MAPPING[industry] };
                } else {
                    vectorFilter.industry = industry;
                }
            }
            if (country) vectorFilter['location.country'] = country;
            if (partnership) vectorFilter.tags = partnership;
            // Note: sizeBucket might not be in the vector filter index according to atlas_vector_index.json

            const pipeline = [
                {
                    $vectorSearch: {
                        index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                        path: 'embedding',
                        queryVector: vector,
                        numCandidates: 100,
                        limit: parseInt(limit) * 2,
                        ...(Object.keys(vectorFilter).length > 0 ? { filter: vectorFilter } : {})
                    }
                }
            ];

            const matchStage = {};
            // Post-filtering for non-vector-index fields
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

        // 1.5. Fallback to Text Search ($text) instead of Regex
        // This ensures we find data even if embeddings are missing (e.g., Mock Data or newly ingested DART data)
        if (!forceWebSearch && dbResults.length === 0 && extractedKeyword) {
            console.log(`[Search] Vector search yielded 0 results. Triggering Text Search Fallback for: "${extractedKeyword}"`);
            const filter = { $text: { $search: extractedKeyword } };

            if (industry) {
                if (INDUSTRY_MAPPING[industry]) filter.industry = { $in: INDUSTRY_MAPPING[industry] };
                else filter.industry = industry;
            }
            if (country) filter['location.country'] = country;
            if (partnership) filter.tags = partnership;
            if (size) filter.sizeBucket = size;

            console.log(`[Search] Text Search Filter:`, JSON.stringify(filter));

            try {
                dbResults = await Company.find(filter)
                    .select({ score: { $meta: 'textScore' }, name: 1, industry: 1, location: 1, profileText: 1, website: 1, tags: 1, sizeBucket: 1, dart: 1, matchRecommendation: 1, matchAnalysis: 1 })
                    .sort({ score: { $meta: 'textScore' } })
                    .limit(parseInt(limit))
                    .lean();

                // Normalize scores to be in a similar range to vector search (0.5 - 1.0)
                dbResults = dbResults.map(r => ({
                    ...r,
                    score: Math.min(1.0, 0.5 + (r.score / 10)) // Heuristic normalization
                }));
                console.log(`[Search] Text search returned ${dbResults.length} results.`);
            } catch (textErr) {
                console.error(`[Search] Text search error:`, textErr.message);
                dbResults = [];
            }
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

                // [RELEVANCE FIX] CROSS-SECTOR PENALTY: Ensure product intent matches result content
                if (typeof isAutomotive !== 'undefined' && isAutomotive) {
                    const autoTerms = ['auto', 'vehicle', 'car', 'part', 'truck', 'engine', 'motor', 'tire', 'battery', 'accessory', 'mechanical', 'spare'];
                    const fullText = (item.title + ' ' + item.content).toLowerCase();
                    const hasMatch = autoTerms.some(t => fullText.includes(t));
                    
                    if (!hasMatch) {
                        console.log(`[Search] Penalizing cross-sector result (No Auto context): ${item.title}`);
                        score -= 0.6; // Heavy penalty
                    }
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

            // [DATA ACCUMULATION] Save discoveries to DB in background (non-blocking)
            if (mappedWebResults.length > 0) {
                console.log(`[Search] Accumulating ${mappedWebResults.length} web results to DB...`);
                mappedWebResults.forEach(item => {
                    // Normalize name slightly to avoid obvious duplicates
                    Company.findOneAndUpdate(
                        { name: item.name },
                        { 
                            $set: {
                                name: item.name,
                                industry: (predictedIndustry && item.industry === 'Web Result') ? predictedIndustry : item.industry,
                                location: item.location,
                                profileText: item.profileText,
                                website: item.website,
                                dataSource: 'Tavily Web Search',
                                tags: item.tags,
                                updatedAt: new Date()
                            }
                        },
                        { upsert: true, setDefaultsOnInsert: true }
                    ).catch(err => console.error(`[Search] DB Accumulation Error for ${item.name}: ${err.message}`));
                });
            }

            return res.json({
                data: mappedWebResults,
                aiResponse: aiResponse,
                provider: 'tavily',
                debug: {
                    searchType: 'WEB',
                    count: mappedWebResults.length,
                    intent: detectedIntent,
                    forceWebSearch: true,
                    tavilyQuery
                }
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
            provider: forceWebSearch ? 'tavily' : 'db',
            debug: {
                searchType,
                count: hybridResults.length,
                graphUsed: !!(useGraph && req.query.buyerId),
                intent: detectedIntent,
                forceWebSearch,
                tavilyQuery: tavilyQuery || null,
                isAutomotive: typeof isAutomotive !== 'undefined' ? isAutomotive : false
            }
        });

    } catch (err) {
        console.error("Search Error:", err);
        next(err);
    }
});

module.exports = router;
