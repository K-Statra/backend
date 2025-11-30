require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');
const { embed } = require('../src/providers/embeddings');
const { chat } = require('../src/providers/chat/openai');

async function run() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const count = await Company.countDocuments();
        console.log(`Total companies in DB: ${count}`);

        const q = "나는 k-뷰티 상품을 수출하는 한국의 작은 스타트업이야. 미국에 수출하고 싶어. 특히 LA지역에 관심이 많아. 한국 K-뷰티 상품을 수입하는 수입업자나 디스트리뷰터를 추천해 줘";
        console.log(`\nQuery: ${q}`);

        console.log('\n1. Generating embedding...');
        const vector = await embed(q);
        console.log(`Vector generated. Length: ${vector.length}`);

        if (vector.length === 0) {
            console.error('Vector generation failed (empty). Check OPENAI_API_KEY.');
            return;
        }

        console.log('\n2. Running Vector Search...');
        const pipeline = [
            {
                $vectorSearch: {
                    index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                    path: 'embedding',
                    queryVector: vector,
                    numCandidates: 100,
                    limit: 10,
                },
            },
            {
                $addFields: {
                    score: { $meta: 'vectorSearchScore' },
                },
            },
        ];

        const results = await Company.aggregate(pipeline);
        console.log(`Vector search found ${results.length} results.`);

        if (results.length > 0) {
            console.log('Top result:', results[0].name, results[0].score);

            console.log('\n3. Running RAG...');
            const context = results.map((c, i) =>
                `${i + 1}. ${c.name} (${c.location?.country || 'Unknown'}): ${c.industry}, ${c.profileText?.substring(0, 150)}...`
            ).join('\n');

            const systemPrompt = `You are a helpful B2B matching assistant.`;
            const userMessage = `User Query: "${q}"\n\nCandidate Companies:\n${context}\n\nRecommend these companies.`;

            const aiResponse = await chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ]);
            console.log('\nAI Response:', aiResponse ? 'Generated successfully' : 'Failed');
            if (aiResponse) console.log(aiResponse.substring(0, 100) + '...');
        } else {
            console.log('No vector search results found. Checking if companies have embeddings...');
            const sample = await Company.findOne({ embedding: { $exists: true, $not: { $size: 0 } } });
            if (sample) {
                console.log('Found a company with embeddings:', sample.name);
            } else {
                console.log('NO companies with embeddings found in DB!');
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
