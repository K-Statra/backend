require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');

const { connectDB } = require('../src/config/db');

connectDB()
    .then(async () => {
        // console.log('MongoDB Connected'); // Handled by db.js

        const amore = {
            name: '아모레퍼시픽',
            industry: 'Cosmetics',
            offerings: ['Skincare', 'Makeup', 'Beauty Products'],
            location: { country: 'South Korea', city: 'Seoul' },
            tags: ['K-Beauty', 'Cosmetics', 'Skincare']
        };

        await Company.findOneAndUpdate(
            { name: '아모레퍼시픽' },
            amore,
            { upsert: true, new: true }
        );

        console.log('Seeded "아모레퍼시픽"');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
