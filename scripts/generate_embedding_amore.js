require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');
const { embed, provider } = require('../src/providers/embeddings');

console.log(`Using Embedding Provider: ${provider}`);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra')
    .then(async () => {
        console.log('MongoDB Connected');

        const company = await Company.findOne({ name: '아모레퍼시픽' });
        if (!company) {
            console.error('Amorepacific not found!');
            process.exit(1);
        }

        console.log(`Company: ${company.name}`);
        console.log(`Current Embedding Length: ${company.embedding ? company.embedding.length : 0}`);

        if (!company.embedding || company.embedding.length === 0) {
            console.log('Generating embedding...');
            // Create a text representation for embedding
            const textToEmbed = `${company.name} ${company.industry} ${company.offerings.join(' ')} ${company.tags.join(' ')} ${company.profileText || ''}`;

            try {
                const vector = await embed(textToEmbed);
                if (vector && vector.length > 0) {
                    company.embedding = vector;
                    await company.save();
                    console.log(`Successfully generated and saved embedding (Length: ${vector.length})`);
                } else {
                    console.error('Failed to generate embedding: Empty vector returned');
                }
            } catch (err) {
                console.error('Error generating embedding:', err);
            }
        } else {
            console.log('Embedding already exists.');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
