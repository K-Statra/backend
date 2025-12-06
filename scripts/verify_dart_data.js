const mongoose = require('mongoose');
require('dotenv').config();
const { Company } = require('../src/models/Company');

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('DB Connected');

        const company = await Company.findOne({ name: '아모레퍼시픽' });
        if (company) {
            console.log('Company Found:', company.name);
            console.log('DART Data:', company.dart);
            if (company.dart && company.dart.revenueConsolidated) {
                console.log('Verification SUCCESS: DART data exists.');
            } else {
                console.log('Verification FAILED: DART data missing or incomplete.');
            }
        } else {
            console.log('Verification FAILED: Company not found.');
        }
    } catch (err) {
        console.error('Verification Error:', err);
    } finally {
        await mongoose.disconnect();
    }
})();
