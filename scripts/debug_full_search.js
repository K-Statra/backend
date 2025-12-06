require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');
const { embed } = require('../src/providers/embeddings');
const { chat } = require('../src/providers/chat/openai');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra')
    .then(async () => {
        console.log('MongoDB Connected');

        const q = "I'm American K-beauty producs importer. Recommend me Korea K-beauty producs exporter";
        const filters = {
            industry: 'Beauty / Consumer Goods / Food',
            country: 'South Korea',
            partnership: 'Supplier'
        };

        console.log(`[Debug] Query: "${q}"`);
        console.log(`[Debug] Filters:`, filters);

        // 1. Router Logic
        let forceWebSearch = false;
        const routerPrompt = `
            You are a search router for a B2B matching platform specialized in "K-Beauty, Cosmetics, Food, and Consumer Goods".
            User Query: "${q}"
            
            Task: Determine if this query falls within our specialized domain.
            - If the query is about Beauty, Cosmetics, Skincare, Makeup, Food, Supplements, or general Consumer Goods, output "DB".
            - If the query is about Automotive, Machinery, Construction, IT, Electronics, or any other unrelated industry, output "WEB".
            - If unsure, output "DB".
            
            Output only one word: "DB" or "WEB".
        `;

        try {
            const decision = await chat(routerPrompt);
            console.log(`[Debug] Router Decision: ${decision}`);
            if (decision && decision.trim().toUpperCase().includes('WEB')) {
                forceWebSearch = true;
                console.log('[Debug] Force Web Search: TRUE');
            } else {
                console.log('[Debug] Force Web Search: FALSE');
            }
        } catch (err) {
            console.error('[Debug] Router Error:', err.message);
        }

        // 2. Vector Search Logic
        if (!forceWebSearch) {
            const vector = await embed(q);
            console.log(`[Debug] Vector Length: ${vector.length}`);

            if (vector.length > 0) {
                const pipeline = [
                    {
                        $vectorSearch: {
                            index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                            path: 'embedding',
                            queryVector: vector,
                            numCandidates: 100,
                            limit: 10
                        }
                    }
                ];

                const matchStage = {};
                if (filters.industry) matchStage.industry = filters.industry;
                if (filters.country) matchStage['location.country'] = filters.country;
                if (filters.partnership) matchStage.tags = filters.partnership;

                console.log('[Debug] Match Stage:', JSON.stringify(matchStage));

                if (Object.keys(matchStage).length > 0) {
                    pipeline.push({ $match: matchStage });
                }

                pipeline.push({
                    $project: { name: 1, industry: 1, tags: 1, score: { $meta: 'vectorSearchScore' } }
                });

                const results = await Company.aggregate(pipeline);
                console.log(`[Debug] DB Results Found: ${results.length}`);
                results.forEach(r => console.log(`- ${r.name} (${r.industry}) Tags: ${r.tags}`));
            }
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
