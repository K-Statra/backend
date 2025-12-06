require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra')
    .then(async () => {
        console.log('MongoDB Connected');

        const samsung = {
            name: '삼성전자', // Korean name to ensure DART match
            industry: 'Electronics',
            offerings: ['Semiconductors', 'Consumer Electronics'],
            location: { country: 'South Korea' }
        };

        await Company.findOneAndUpdate(
            { name: '삼성전자' },
            samsung,
            { upsert: true, new: true }
        );

        console.log('Seeded "삼성전자"');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
