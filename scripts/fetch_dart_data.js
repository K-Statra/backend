console.log('Script starting...');
require('dotenv').config();
console.log('Dotenv loaded');
const mongoose = require('mongoose');
console.log('Mongoose loaded');
const OpenDart = require('opendart');
console.log('OpenDart loaded');
const { Company } = require('../src/models/Company');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENDART_API_KEY;
if (!API_KEY) {
    console.error('Missing OPENDART_API_KEY in .env');
    process.exit(1);
}

const dart = require('opendart');

const { execSync } = require('child_process');
const xml2js = require('xml2js');

// Cache file for corp codes
const TMP_DIR = path.join(__dirname, '../tmp');
const CORP_CODE_ZIP = path.join(TMP_DIR, 'corp_codes.zip');
const CORP_CODE_XML = path.join(TMP_DIR, 'CORPCODE.xml');
const CORP_CODE_JSON = path.join(TMP_DIR, 'corp_codes.json');

async function getCorpCode(targetName) {
    // Check cache first
    let corpCodes = [];
    if (fs.existsSync(CORP_CODE_JSON)) {
        corpCodes = JSON.parse(fs.readFileSync(CORP_CODE_JSON, 'utf8'));
    } else {
        console.log('Fetching Corp Codes from DART (this may take a while)...');
        try {
            // Fetch manually with axios to ensure binary data is handled correctly
            const axios = require('axios');
            const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${API_KEY}`;
            console.log('Downloading corp codes zip...');
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const result = response.data;

            if (result) {
                console.log('Received ZIP data. Saving and extracting...');
                if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

                // Write ZIP
                fs.writeFileSync(CORP_CODE_ZIP, result);

                // Unzip using PowerShell Expand-Archive
                try {
                    // Remove existing XML if any
                    if (fs.existsSync(CORP_CODE_XML)) fs.unlinkSync(CORP_CODE_XML);

                    const psCommand = `powershell -Command "Expand-Archive -Path '${CORP_CODE_ZIP}' -DestinationPath '${TMP_DIR}' -Force"`;
                    execSync(psCommand);
                    console.log('Unzip complete via Expand-Archive.');
                } catch (err) {
                    console.error('PowerShell Expand-Archive failed:', err.message);
                    return null;
                }

                // Parse XML
                if (fs.existsSync(CORP_CODE_XML)) {
                    const xml = fs.readFileSync(CORP_CODE_XML, 'utf8');
                    const parser = new xml2js.Parser({ explicitArray: false });
                    const parsed = await parser.parseStringPromise(xml);

                    if (parsed && parsed.result && parsed.result.list) {
                        // Normalize list to array
                        const list = Array.isArray(parsed.result.list) ? parsed.result.list : [parsed.result.list];
                        corpCodes = list;
                        fs.writeFileSync(CORP_CODE_JSON, JSON.stringify(corpCodes));
                        console.log(`Parsed ${corpCodes.length} corp codes.`);
                    } else {
                        console.error('Invalid XML structure');
                        return null;
                    }
                } else {
                    console.error('CORPCODE.xml not found after unzip');
                    return null;
                }
            } else if (result && result.list) {
                // Direct list (unlikely based on previous run)
                corpCodes = result.list;
                fs.writeFileSync(CORP_CODE_JSON, JSON.stringify(corpCodes));
            } else {
                console.log('Unexpected corpCode response type:', typeof result);
                return null;
            }
        } catch (e) {
            console.error('Failed to fetch corp codes:', e.message);
            return null;
        }
    }

    // Prioritize exact match
    const exact = corpCodes.find(c => c.corp_name === targetName);
    if (exact) return exact;

    const found = corpCodes.find(c => c.corp_name.includes(targetName));
    return found;
}

async function fetchFinancials(corpCode, year, reportCode = '11011') {
    try {
        // Pass API_KEY as first argument
        const response = await dart.statement.fnlttSinglAcnt(API_KEY, {
            corp_code: corpCode,
            bsns_year: year,
            reprt_code: reportCode
        });

        const data = response.data || response; // Handle if it returns response or data directly

        if (!data || !data.list) {
            console.log('Financials API Result:', JSON.stringify(data, null, 2));
        }
        return data;
    } catch (e) {
        console.error(`Failed to fetch financials for ${corpCode}:`, e.message);
        return null;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const targetName = args.find((arg, i) => args[i - 1] === '--target') || '삼성전자';
    const dryRun = args.includes('--dry-run');

    console.log(`Target: ${targetName}`);

    // 1. Get Corp Code
    const companyInfo = await getCorpCode(targetName);
    if (!companyInfo) {
        console.error(`Company "${targetName}" not found in DART.`);
        process.exit(1);
    }
    console.log(`Found: ${companyInfo.corp_name} (${companyInfo.corp_code})`);

    // 2. Fetch Financials (Last Year)
    const year = new Date().getFullYear() - 1;
    console.log(`Fetching financials for ${year}...`);

    const financials = await fetchFinancials(companyInfo.corp_code, year.toString());

    if (!financials || !financials.list) {
        console.error('No financial data found.');
        process.exit(1);
    }

    // 3. Parse Data
    // We look for Revenue, Operating Profit, Net Income
    // Account IDs usually: 
    // Revenue: 'Sales' or 'Revenue' (standard codes exist but names vary)
    // Often: '매출액', '영업이익', '당기순이익'

    const extract = (list, names) => {
        const item = list.find(i => names.includes(i.account_nm.replace(/\s/g, '')));
        return item ? parseFloat(item.thstrm_amount.replace(/,/g, '')) : null;
    };

    const revenue = extract(financials.list, ['매출액', '수익(매출액)']);
    const operatingProfit = extract(financials.list, ['영업이익', '영업이익(손실)']);
    const netIncome = extract(financials.list, ['당기순이익', '당기순이익(손실)']);

    const dartData = {
        corpCode: companyInfo.corp_code,
        fiscalYear: year.toString(),
        revenueConsolidated: revenue, // Assuming consolidated if available, logic to distinguish needed
        operatingProfitConsolidated: operatingProfit,
        netIncomeConsolidated: netIncome,
        lastUpdated: new Date()
    };

    console.log('Parsed Data:', dartData);

    if (dryRun) {
        console.log('Dry run complete. No DB changes.');
        process.exit(0);
    }

    // 4. Update DB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra');
    console.log('DB Connected');

    const res = await Company.findOneAndUpdate(
        { name: targetName }, // Simple match by name for now
        { $set: { dart: dartData } },
        { new: true }
    );

    if (res) {
        console.log(`Updated ${res.name} with DART data.`);
    } else {
        console.log(`Company ${targetName} not found in DB to update.`);
    }

    await mongoose.disconnect();
}

main();
