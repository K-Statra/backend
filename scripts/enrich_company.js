require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const xml2js = require('xml2js');
const dart = require('opendart');

const API_KEY = process.env.OPENDART_API_KEY;
const TMP_DIR = path.join(__dirname, '../tmp');
const CORP_CODE_JSON = path.join(TMP_DIR, 'corp_codes.json');

async function getCorpCode(targetName) {
    if (!fs.existsSync(CORP_CODE_JSON)) {
        console.error('Corp codes not found. Please run ingest_all_dart_companies.js first or ensure cache exists.');
        return null;
    }
    const corpCodes = JSON.parse(fs.readFileSync(CORP_CODE_JSON, 'utf8'));
    return corpCodes.find(c => c.corp_name === targetName);
}

async function fetchFinancials(corpCode, year) {
    try {
        // 11011 = Annual Report
        const response = await dart.statement.fnlttSinglAcnt(API_KEY, {
            corp_code: corpCode,
            bsns_year: year,
            reprt_code: '11011'
        });
        return response.data || response;
    } catch (e) {
        console.error(`Failed to fetch financials: ${e.message}`);
        return null;
    }
}

async function enrichCompany() {
    try {
        await connectDB();

        const args = process.argv.slice(2);
        const targetName = args.find((arg, i) => args[i - 1] === '--target') || '아모레퍼시픽'; // Default to Amorepacific

        console.log(`Enriching data for: ${targetName}`);

        // 1. Find in DB
        let company = await Company.findOne({ name: targetName });
        if (!company) {
            console.log(`Company ${targetName} not found in DB. Creating placeholder...`);
            company = await Company.create({ name: targetName, dataSource: 'enriched_manual' });
        }

        // 2. Get Corp Code
        const corpInfo = await getCorpCode(targetName);
        if (!corpInfo) {
            console.error(`Corp code not found for ${targetName}`);
            process.exit(1);
        }

        // 3. Fetch Financials
        const year = new Date().getFullYear() - 1;
        console.log(`Fetching financials for ${year}...`);
        const financials = await fetchFinancials(corpInfo.corp_code, year.toString());

        if (financials && financials.list) {
            const extract = (list, names) => {
                const item = list.find(i => names.includes(i.account_nm.replace(/\s/g, '')));
                return item ? parseFloat(item.thstrm_amount.replace(/,/g, '')) : 0;
            };

            const revenue = extract(financials.list, ['매출액', '수익(매출액)']);
            const operatingProfit = extract(financials.list, ['영업이익', '영업이익(손실)']);
            const netIncome = extract(financials.list, ['당기순이익', '당기순이익(손실)']);

            company.dart = {
                corpCode: corpInfo.corp_code,
                fiscalYear: year.toString(),
                revenueConsolidated: revenue,
                operatingProfitConsolidated: operatingProfit,
                netIncomeConsolidated: netIncome,
                lastUpdated: new Date()
            };

            // Update top-level revenue for sorting
            company.revenue = revenue;

            console.log(`Financials: Rev=${revenue}, OP=${operatingProfit}, NI=${netIncome}`);
        }

        // 4. Add Manual Detailed Profile (Since DART text data is hard to parse automatically)
        // We inject high-quality data for Amorepacific as a demo
        if (targetName === '아모레퍼시픽') {
            company.industry = 'Cosmetics & Beauty';
            company.profileText = 'Amorepacific Corporation is a South Korean beauty and cosmetics conglomerate, operating over 30 brands including Sulwhasoo, Laneige, and Innisfree. We are dedicated to spreading Asian Beauty to the world.';
            company.tags = ['K-Beauty', 'Cosmetics', 'Skincare', 'Makeup', 'Wellness'];
            company.offerings = ['Premium Skincare', 'Makeup Products', 'Beauty Devices', 'Health Supplements'];
            company.needs = ['Sustainable Packaging', 'Global Logistics Partners', 'AI Skin Analysis Tech'];
            company.location = {
                country: 'South Korea',
                city: 'Seoul',
                address: '100, Hangang-daero, Yongsan-gu'
            };
            company.videoUrl = 'https://www.youtube.com/watch?v=example'; // Placeholder
            company.images = [
                { url: 'https://images.unsplash.com/photo-1612817288484-929134772840?auto=format&fit=crop&q=80&w=1000', caption: 'Amorepacific Headquarters' }
            ];

            // Clear embedding to force regeneration with new data
            company.embedding = [];
            console.log('Injected detailed profile data.');
        }

        await company.save();
        console.log('Company updated successfully.');

        process.exit(0);
    } catch (err) {
        console.error('Enrichment failed:', err);
        process.exit(1);
    }
}

enrichCompany();
