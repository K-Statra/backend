const mongoose = require('mongoose');
require('dotenv').config();
const { Company } = require('../src/models/Company');

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const company = await Company.findOne({ name: '아모레퍼시픽' });
        if (company) {
            console.log('Company Found:', company.name);
            console.log('DART Data:', JSON.stringify(company.dart, null, 2));
        } else {
            console.log('Company not found');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
})();
