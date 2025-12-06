const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
require('dotenv').config();

async function verify() {
    try {
        await connectDB();
        const company = await Company.findOne({ name: '아모레퍼시픽' });
        if (!company) {
            console.error('FAILED: Company "아모레퍼시픽" not found.');
            process.exit(1);
        }
        console.log('SUCCESS: Found company:', company.name);
        console.log('Industry:', company.industry);
        console.log('Tags:', company.tags);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

verify();
