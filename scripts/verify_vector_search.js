require('dotenv').config({ path: 'd:\\k-statra-project\\.env' });
const mongoose = require('mongoose');
const { embed } = require('../src/providers/embeddings');
const { Company } = require('../src/models/Company');

async function verifyVectorSearch() {
    console.log('🔍 Verifying Vector Search Configuration...');

    // 1. Check Environment Variables
    if (process.env.EMBEDDINGS_PROVIDER !== 'openai') {
        console.warn('⚠️  EMBEDDINGS_PROVIDER is not set to "openai". Current:', process.env.EMBEDDINGS_PROVIDER);
    }
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY is missing!');
        process.exit(1);
    }

    // 2. Connect to MongoDB
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB Connection Failed:', err.message);
        process.exit(1);
    }

    // 3. Generate Embedding
    const queryText = "software development and IT consulting";
    console.log(`\n🧠 Generating embedding for query: "${queryText}"...`);
    let vector;
    try {
        vector = await embed(queryText);
        console.log(`✅ Embedding generated! Dimensions: ${vector.length}`);
        if (vector.length !== 1536) {
            console.error(`❌ Dimension mismatch! Expected 1536, got ${vector.length}. Check your embedding provider.`);
            // We continue anyway to see if Atlas complains
        }
    } catch (err) {
        console.error('❌ Embedding generation failed:', err.message);
        process.exit(1);
    }

    // 4. Perform Vector Search
    console.log('\n🚀 Executing Vector Search on "companies" collection...');
    try {
        const results = await Company.aggregate([
            {
                $vectorSearch: {
                    index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                    path: 'embedding',
                    queryVector: vector,
                    numCandidates: 50,
                    limit: 3,
                },
            },
            {
                $project: {
                    name: 1,
                    industry: 1,
                    score: { $meta: 'vectorSearchScore' },
                },
            },
        ]);

        if (results.length === 0) {
            console.warn('⚠️  Search completed but returned 0 results. (This might be normal if collection is empty or index is building)');
        } else {
            console.log('✅ Search successful! Top results:');
            results.forEach((r, i) => {
                console.log(`   ${i + 1}. ${r.name} (${r.industry}) - Score: ${r.score}`);
            });
        }
    } catch (err) {
        console.error('❌ Vector Search Failed:', err.message);
        console.error('   Hint: Check if "vector_index" exists and is active in Atlas.');
    } finally {
        await mongoose.disconnect();
    }
}

verifyVectorSearch();
