require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
const { embed } = require('../src/providers/embeddings');

async function debugVectorSearch() {
    try {
        await connectDB();

        const query = "K-beauty suppliers in Korea";
        console.log(`Embedding query: "${query}"...`);
        const vector = await embed(query);

        console.log(`Vector generated (length: ${vector.length})`);

        const pipeline = [
            {
                $vectorSearch: {
                    index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                    path: 'embedding',
                    queryVector: vector,
                    numCandidates: 100,
                    limit: 5
                }
            },
            {
                $project: {
                    name: 1,
                    score: { $meta: 'vectorSearchScore' }
                }
            }
        ];

        console.log('Running aggregation...');
        const results = await Company.aggregate(pipeline);

        console.log('Results:', results);

        if (results.length === 0) {
            console.log('No results found. Possible causes:');
            console.log('1. Index "vector_index" does not exist in Atlas.');
            console.log('2. Index definition does not match "embedding" field dimensions (1536).');
            console.log('3. Data has not been indexed yet (takes a few minutes).');
        }

        process.exit(0);
    } catch (err) {
        console.error('Vector Search Failed:', err);
        process.exit(1);
    }
}

debugVectorSearch();
