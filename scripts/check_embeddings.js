require('dotenv').config();
const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');

(async () => {
    try {
        await connectDB();
        const count = await Company.countDocuments({ embedding: { $exists: true, $not: { $size: 0 } } });
        console.log('Companies with embeddings:', count);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
