require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');
const { embed } = require('../src/providers/embeddings');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra')
    .then(async () => {
        console.log('MongoDB Connected');

        const query = "I'm American K-beauty producs importer. Recommend me Korea K-beauty producs exporter";
        const filters = {
            industry: 'Beauty / Consumer Goods / Food',
            'location.country': 'South Korea',
            tags: 'Supplier'
        };

        console.log(`Query: "${query}"`);
        console.log('Filters:', JSON.stringify(filters));

        const vector = await embed(query);
        console.log(`Vector generated (Length: ${vector.length})`);

        const pipeline = [
            {
                $vectorSearch: {
                    index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
                    path: 'embedding',
                    queryVector: vector,
                    numCandidates: 100,
                    limit: 10
                }
            },
            {
                $match: filters
            },
            {
                $project: {
                    name: 1,
                    industry: 1,
                    location: 1,
                    tags: 1,
                    score: { $meta: 'vectorSearchScore' }
                }
            }
        ];

        try {
            const results = await Company.aggregate(pipeline);
            console.log(`Found ${results.length} results:`);
            results.forEach(r => console.log(`- ${r.name} (Score: ${r.score})`));
        } catch (err) {
            console.error('Search Failed:', err);
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
