const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
require('dotenv').config();

async function verify() {
    try {
        await connectDB();
        const count = await Company.countDocuments({});
        console.log(`Total Companies in DB: ${count}`);

        const samsung = await Company.findOne({ name: 'Samsung Electronics' });
        if (samsung) {
            console.log('Samsung Electronics found.');
            console.log('DART Code:', samsung.dartCorpCode);
            console.log('Tags:', samsung.tags);
        } else {
            console.log('WARNING: Samsung Electronics not found (Name mismatch?)');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

verify();
