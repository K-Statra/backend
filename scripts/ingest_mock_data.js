const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');

// 1. [EXTRACT] Simulated Raw Data from Public Data Portal (e.g., XML converted to JSON)
// Real public data often has obscure field names like 'bzMnNo' (Business Number) or 'koreanNm'.
const MOCK_RAW_DATA = [
    {
        "bzMnNo": "123-45-67890",
        "koreanNm": "태양광 솔루션 코리아",
        "engNm": "Solar Solution Korea Co., Ltd.",
        "indutyNm": "Electronic Components",
        "addr": "Seoul, Gangnam-gu, Teheran-ro 123",
        "hmpgUrl": "http://www.solarkorea.example.com",
        "mainProd": "Solar Panel, Inverter, ESS"
    },
    {
        "bzMnNo": "987-65-43210",
        "koreanNm": "퓨어 네이처 코스메틱",
        "engNm": "Pure Nature Cosmetic",
        "indutyNm": "Cosmetics / Beauty",
        "addr": "Gyeonggi-do, Seongnam-si, Pangyo-ro 456",
        "hmpgUrl": "https://purenature.example.com",
        "mainProd": "Organic Serum, Facial Mask, Toner"
    },
    {
        "bzMnNo": "555-12-34567",
        "koreanNm": "메카트로닉스 시스템",
        "engNm": "Mechatronics Systems Inc.",
        "indutyNm": "Machinery / Automation",
        "addr": "Busan, Sasang-gu, Sasang-ro 789",
        "hmpgUrl": "", // Missing website is common in public data
        "mainProd": "Robot Arm, Conveyor Belt, PLC"
    }
];

// 2. [TRANSFORM] Clean and Map to K-Statra Schema
function transformData(rawData) {
    return rawData.map(item => {
        return {
            name: item.engNm || item.koreanNm, // Prefer English name for global buyers
            industry: mapIndustry(item.indutyNm),
            location: {
                country: "South Korea",
                city: extractCity(item.addr),
                address: item.addr
            },
            website: item.hmpgUrl || "",
            description: `Specializes in ${item.mainProd}. Verified exporter via Public Data Portal.`,
            tags: item.mainProd.split(',').map(t => t.trim()),
            // Metadata for verification
            dataSource: 'public_data_mock',
            verificationStatus: 'verified', // Because it came from a government source
            businessNumber: item.bzMnNo
        };
    });
}

function mapIndustry(rawIndustry) {
    // Simple mapper
    if (rawIndustry.includes('Cosmetic')) return 'Beauty / Consumer Goods / Food';
    if (rawIndustry.includes('Electronic')) return 'Green Energy / Climate Tech / Smart City';
    if (rawIndustry.includes('Machinery')) return 'Mobility / Automation / Manufacturing';
    return 'Other';
}

function extractCity(address) {
    if (address.includes('Seoul')) return 'Seoul';
    if (address.includes('Gyeonggi')) return 'Gyeonggi';
    if (address.includes('Busan')) return 'Busan';
    return 'South Korea';
}

// 3. [LOAD] Insert into MongoDB
async function runPipeline() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to DB');

        const transformedData = transformData(MOCK_RAW_DATA);
        console.log(`🔄 Transformed ${transformedData.length} records.`);

        // Upsert (Update if exists, Insert if new) based on Business Number or Name
        for (const company of transformedData) {
            await Company.findOneAndUpdate(
                { name: company.name }, // Match criteria
                company, // Update data
                { upsert: true, new: true } // Options
            );
            console.log(`   - Processed: ${company.name}`);
        }

        console.log('🎉 ETL Pipeline Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Pipeline Failed:', err);
        process.exit(1);
    }
}

runPipeline();
