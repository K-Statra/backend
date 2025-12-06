require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');

const { connectDB } = require('../src/config/db');

connectDB()
    .then(async () => {
        // console.log('MongoDB Connected'); // Handled by db.js

        // Unset dart field for all companies except maybe Samsung if we want to keep it (but safer to just re-fetch)
        const result = await Company.updateMany(
            {},
            { $unset: { dart: "" } }
        );

        console.log(`Cleaned up dart data. Modified count: ${result.modifiedCount}`);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
