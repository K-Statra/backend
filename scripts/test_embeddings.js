require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
const { Buyer } = require('../src/models/Buyer');
const { embed } = require('../src/providers/embeddings');
const { scoreCompany } = require('../src/services/matchScore');

async function run() {
    try {
        await connectDB();

        console.log('1. Creating test entities...');
        const company = await Company.create({
            name: 'Vector Tech',
            industry: 'AI',
            profileText: 'We specialize in artificial intelligence and machine learning.',
            tags: ['AI', 'ML'],
        });

        const buyer = await Buyer.create({
            name: 'AI Seeker',
            industries: ['AI'],
            needs: ['Machine Learning'],
            profileText: 'Looking for AI solutions.',
        });

        console.log('2. Generating embeddings...');
        // Manually trigger embedding generation logic (similar to scripts/embed_text.js)
        const companyText = [company.name, company.profileText, ...company.tags].join(' ');
        const buyerText = [buyer.name, buyer.profileText, ...buyer.needs].join(' ');

        company.embedding = await embed(companyText);
        buyer.embedding = await embed(buyerText);

        await company.save();
        await buyer.save();

        console.log(`   Company embedding len: ${company.embedding.length}`);
        console.log(`   Buyer embedding len: ${buyer.embedding.length}`);

        if (company.embedding.length === 0 || buyer.embedding.length === 0) {
            throw new Error('Embeddings were not generated');
        }

        console.log('3. Testing Match Score (Without Embedding)...');
        process.env.MATCH_USE_EMBEDDING = 'false';
        const score1 = scoreCompany(buyer, company);
        console.log(`   Score 1: ${score1.score.toFixed(2)}`);

        console.log('4. Testing Match Score (With Embedding)...');
        process.env.MATCH_USE_EMBEDDING = 'true';
        process.env.MATCH_EMBEDDING_WEIGHT = '0.5';
        const score2 = scoreCompany(buyer, company);
        console.log(`   Score 2: ${score2.score.toFixed(2)}`);
        console.log(`   Reasons: ${score2.reasons.join(', ')}`);

        if (score2.score <= score1.score) {
            throw new Error('Embedding should increase score for similar text');
        }

        console.log('5. Cleanup...');
        await Company.findByIdAndDelete(company._id);
        await Buyer.findByIdAndDelete(buyer._id);

        console.log('SUCCESS: Text embedding integration verified.');
    } catch (err) {
        console.error('FAILED:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

run();
