require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra';

async function verifyIntegration() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        // 1. Verify 'Korean' Filter Logic
        console.log('\n--- Verifying "Korean" Company Filter ---');
        const koreanFilter = {
            $or: [
                { "location.country": "Korea" },
                { "location.country": "South Korea" },
                { "location.country": "Republic of Korea" },
                { "location.country": "KR" }
            ]
        };
        const koreanCount = await Company.countDocuments(koreanFilter);
        console.log(`Total Korean Companies found with filter: ${koreanCount}`);

        const koreanSample = await Company.findOne(koreanFilter).select('name location.country');
        if (koreanSample) {
            console.log(`Sample Korean Company: ${koreanSample.name} (${koreanSample.location.country})`);
        }

        // 2. Verify 'Foreign' Filter Logic
        console.log('\n--- Verifying "Foreign" Company Filter ---');
        const foreignFilter = {
            "location.country": {
                $nin: ["Korea", "South Korea", "Republic of Korea", "KR"]
            }
        };
        const foreignCount = await Company.countDocuments(foreignFilter);
        console.log(`Total Foreign Companies found with filter: ${foreignCount}`);


        // 3. Verify Combined Filter (Korean + IT / AI / SaaS)
        const targetDesc = "IT / AI / SaaS";
        console.log(`\n--- Verifying Combined Filter: Korean + ${targetDesc} ---`);
        const combinedFilter = {
            ...koreanFilter,
            industry: targetDesc
        };
        const combinedCount = await Company.countDocuments(combinedFilter);
        console.log(`Companies matching Korean + ${targetDesc}: ${combinedCount}`);

        const combinedSample = await Company.findOne(combinedFilter).select('name location.country industry');
        if (combinedSample) {
            console.log(`Sample match: ${combinedSample.name} | Country: ${combinedSample.location.country} | Industry: ${combinedSample.industry}`);
        } else {
            console.log("No matches found for combined filter.");
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

verifyIntegration();
