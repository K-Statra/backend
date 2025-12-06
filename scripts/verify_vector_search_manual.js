require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');
const { embed } = require('../src/providers/embeddings');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra')
    .then(async () => {
        console.log('MongoDB Connected');

        const query = "K-beauty cosmetics";
        console.log(`Query: "${query}"`);

        const vector = await embed(query);
        console.log(`Vector generated (Length: ${vector.length})`);

        try {
            const results = await Company.aggregate([
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
            ]);

            console.log('Vector Search Results:');
            results.forEach(r => console.log(`- ${r.name} (Score: ${r.score})`));

            if (results.length === 0) {
                console.log('No results found. Index might be missing or empty.');
            }

        } catch (err) {
            console.error('Vector Search Failed:', err.message);
            console.log('Suggestion: Check if "vector_index" exists in MongoDB Atlas.');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
