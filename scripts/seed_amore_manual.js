require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra')
    .then(async () => {
        console.log('MongoDB Connected');

        const amoreData = {
            fiscalYear: '2023',
            reportType: '11011',
            isIFRS: true,
            source: 'Open DART (Manual Seed)',
            lastUpdated: new Date(),
            revenueConsolidated: 3674000000000, // ~3.67T
            operatingProfitConsolidated: 108200000000, // ~108B
            netIncomeConsolidated: 152000000000 // ~152B
        };

        await Company.findOneAndUpdate(
            { name: '아모레퍼시픽' },
            {
                $set: {
                    dart: amoreData,
                    revenue: amoreData.revenueConsolidated
                }
            },
            { upsert: true, new: true }
        );

        console.log('Manually seeded financial data for "아모레퍼시픽"');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
