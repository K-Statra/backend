require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra';

async function generateReport() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Korean vs Foreign Companies
        const countryStats = await Company.aggregate([
            {
                $project: {
                    isKorean: {
                        $cond: {
                            if: {
                                $or: [
                                    { $eq: ["$location.country", "Korea"] },
                                    { $eq: ["$location.country", "South Korea"] },
                                    { $eq: ["$location.country", "Republic of Korea"] },
                                    { $eq: ["$location.country", "KR"] }
                                ]
                            },
                            then: "Korean",
                            else: "Foreign"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$isKorean",
                    count: { $sum: 1 }
                }
            }
        ]);

        console.log('\n--- Company Distribution by Origin ---');
        let totalCompanies = 0;
        countryStats.forEach(stat => {
            totalCompanies += stat.count;
        });

        countryStats.forEach(stat => {
            const percentage = ((stat.count / totalCompanies) * 100).toFixed(2);
            console.log(`${stat._id}: ${stat.count} (${percentage}%)`);
        });
        console.log(`Total Companies: ${totalCompanies}`);


        // 2. Industry Distribution
        const industryStats = await Company.aggregate([
            {
                $group: {
                    _id: "$industry",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        console.log('\n--- Industry Distribution ---');
        industryStats.forEach(stat => {
            const industryName = stat._id || "Unknown/Unclassified";
            const percentage = ((stat.count / totalCompanies) * 100).toFixed(2);
            console.log(`${industryName}: ${stat.count} (${percentage}%)`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

generateReport();
