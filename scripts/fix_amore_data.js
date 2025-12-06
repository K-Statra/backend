require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra')
    .then(async () => {
        console.log('MongoDB Connected');

        // Update Amorepacific to match the frontend filters exactly
        const update = {
            industry: 'Beauty / Consumer Goods / Food', // Matches the filter value
            $addToSet: { tags: 'Supplier' } // Matches "Supplier / Vendor" filter which likely sends "Supplier" or checks for it
        };

        // Wait, let's check what the "Supplier / Vendor" filter sends.
        // In PartnerSearch.jsx: { value: 'Supplier', label: 'Supplier / Vendor' }
        // So it sends "Supplier".

        const result = await Company.findOneAndUpdate(
            { name: '아모레퍼시픽' },
            update,
            { new: true }
        );

        if (result) {
            console.log('Updated Amorepacific:');
            console.log('Industry:', result.industry);
            console.log('Tags:', result.tags);
        } else {
            console.log('Company not found');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
