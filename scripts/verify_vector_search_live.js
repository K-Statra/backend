require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
const { embed } = require('../src/providers/embeddings');

async function run() {
    try {
        await connectDB();
        console.log('Connected to DB');

        const provider = process.env.EMBEDDINGS_PROVIDER || 'mock';
        console.log(`Using Embeddings Provider: ${provider}`);

        // 1. Create a dummy company with embedding
        const testName = `VectorTest_${Date.now()}`;
        console.log(`Creating test company: ${testName}`);

        const embedding = await embed('Artificial Intelligence and Machine Learning');
        if (!embedding || embedding.length === 0) {
            throw new Error('Failed to generate embedding');
        }
        console.log(`Generated embedding of length: ${embedding.length}`);

        const company = await Company.create({
            name: testName,
            industry: 'Technology',
            profileText: 'We specialize in AI and ML.',
            tags: ['AI', 'Vector'],
            embedding: embedding
        });
        console.log(`Created company with ID: ${company._id}`);

        // 2. Run Vector Search
        console.log('Running $vectorSearch aggregation...');
        const indexName = process.env.ATLAS_VECTOR_INDEX || 'vector_index';
        console.log(`Using Index Name: ${indexName}`);

        const pipeline = [
            {
                $vectorSearch: {
                    index: indexName,
                    path: 'embedding',
                    queryVector: embedding,
                    numCandidates: 10,
                    limit: 1
                }
            },
            {
                $project: {
                    name: 1,
                    score: { $meta: 'vectorSearchScore' }
                }
            }
        ];

        const results = await Company.aggregate(pipeline);
        console.log(`Found ${results.length} results`);

        if (results.length > 0) {
            console.log('Top result:', results[0]);
            if (results[0]._id.toString() === company._id.toString()) {
                console.log('SUCCESS: Found the newly created company!');
            } else {
                console.log('WARNING: Found a result, but not the one we just created (might be due to eventual consistency or mock embeddings).');
            }
        } else {
            console.log('WARNING: No results found. Index might be building or misconfigured.');
        }

        // Cleanup
        await Company.findByIdAndDelete(company._id);
        console.log('Cleanup done.');

    } catch (err) {
        console.error('FAILED:', err.message);
        if (err.message.includes('PlanExecutor error')) {
            console.error('HINT: This usually means the Vector Search Index does not exist or is misconfigured in Atlas.');
        }
    } finally {
        await mongoose.disconnect();
    }
}

run();
