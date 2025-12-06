require('dotenv').config();
const { chat } = require('../src/providers/chat/openai');
const { embed } = require('../src/providers/embeddings');
const { Company } = require('../src/models/Company');
const { connectDB } = require('../src/config/db');

async function debugRouteLogic() {
    try {
        await connectDB();
        const q = "recommend me K-beaty suppliers in Korea";
        console.log(`Query: "${q}"`);

        // 1. Test Intent Router
        const routerPrompt = `
            You are a search router for a B2B matching platform specialized in "K-Beauty, Cosmetics, Food, and Consumer Goods".
            User Query: "${q}"
            
            Task: Determine if this query falls within our specialized domain.
            - If the query is about Beauty, Cosmetics, Skincare, Makeup, Food, Supplements, or general Consumer Goods, output "DB".
            - If the query is about Automotive, Machinery, Construction, IT, Electronics, or any other unrelated industry, output "WEB".
            - If unsure, output "DB".
            
            Output only one word: "DB" or "WEB".
            `;

        console.log('Asking Router...');
        const decision = await chat([{ role: 'user', content: routerPrompt }]);
        console.log(`[Router] Decision: ${decision}`);

        if (decision && decision.trim().toUpperCase().includes('WEB')) {
            console.log('Router forced WEB search. This might be the issue if web search is not configured or fails.');
        } else {
            console.log('Router chose DB. Proceeding to Vector Search...');
            const vector = await embed(q);
            const results = await Company.aggregate([
                {
                    $vectorSearch: {
                        index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                        path: 'embedding',
                        queryVector: vector,
                        numCandidates: 100,
                        limit: 5
                    }
                }
            ]);
            console.log(`DB Results found: ${results.length}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugRouteLogic();
