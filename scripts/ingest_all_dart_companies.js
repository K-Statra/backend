require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const { execSync } = require('child_process');

const API_KEY = process.env.OPENDART_API_KEY;
const TMP_DIR = path.join(__dirname, '../tmp');
const CORP_CODE_ZIP = path.join(TMP_DIR, 'corp_codes.zip');
const CORP_CODE_XML = path.join(TMP_DIR, 'CORPCODE.xml');
const CORP_CODE_JSON = path.join(TMP_DIR, 'corp_codes.json');

if (!API_KEY) {
    console.error('Missing OPENDART_API_KEY in .env');
    process.exit(1);
}

async function getCorpCodes() {
    if (fs.existsSync(CORP_CODE_JSON)) {
        console.log('Loading corp codes from cache...');
        return JSON.parse(fs.readFileSync(CORP_CODE_JSON, 'utf8'));
    }

    console.log('Fetching Corp Codes from DART...');
    try {
        if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

        const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${API_KEY}`;
        console.log('Downloading ZIP...');
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(CORP_CODE_ZIP, response.data);

        console.log('Unzipping...');
        if (fs.existsSync(CORP_CODE_XML)) fs.unlinkSync(CORP_CODE_XML);
        const psCommand = `powershell -Command "Expand-Archive -Path '${CORP_CODE_ZIP}' -DestinationPath '${TMP_DIR}' -Force"`;
        execSync(psCommand);

        console.log('Parsing XML...');
        const xml = fs.readFileSync(CORP_CODE_XML, 'utf8');
        const parser = new xml2js.Parser({ explicitArray: false });
        const parsed = await parser.parseStringPromise(xml);

        let list = [];
        if (parsed && parsed.result && parsed.result.list) {
            list = Array.isArray(parsed.result.list) ? parsed.result.list : [parsed.result.list];
            fs.writeFileSync(CORP_CODE_JSON, JSON.stringify(list));
            console.log(`Parsed ${list.length} corp codes.`);
        }
        return list;
    } catch (err) {
        console.error('Failed to fetch/parse corp codes:', err.message);
        throw err;
    }
}

async function ingest() {
    try {
        await connectDB();
        const corpCodes = await getCorpCodes();

        if (!corpCodes || corpCodes.length === 0) {
            console.error('No corp codes found.');
            process.exit(1);
        }

        console.log(`Starting bulk ingestion for ${corpCodes.length} companies...`);

        const args = process.argv.slice(2);
        const limitArgIndex = args.indexOf('--limit');
        const limit = limitArgIndex !== -1 ? parseInt(args[limitArgIndex + 1]) : corpCodes.length;

        console.log(`Starting ingestion for ${limit} companies (Total available: ${corpCodes.length})...`);

        const BATCH_SIZE = 1000;
        let totalUpdated = 0;
        let totalInserted = 0;

        for (let i = 0; i < limit; i += BATCH_SIZE) {
            const end = Math.min(i + BATCH_SIZE, limit);
            const batch = corpCodes.slice(i, end);
            const operations = batch.map(code => ({
                updateOne: {
                    filter: { name: code.corp_name },
                    update: {
                        $set: {
                            dartCorpCode: code.corp_code,
                            stockCode: code.stock_code ? code.stock_code.trim() : undefined
                        },
                        $setOnInsert: {
                            name: code.corp_name,
                            dataSource: 'dart_basic',
                            extractedAt: new Date(),
                            // Default fields to make them searchable
                            industry: 'Unknown',
                            tags: ['DART_Listed']
                        }
                    },
                    upsert: true
                }
            }));

            const result = await Company.bulkWrite(operations, { ordered: false });
            totalUpdated += result.modifiedCount;
            totalInserted += result.upsertedCount;

            if ((i + BATCH_SIZE) % 10000 === 0) {
                console.log(`Processed ${i + BATCH_SIZE} / ${corpCodes.length}...`);
            }
        }

        console.log('Ingestion Complete!');
        console.log(`Total Inserted (New): ${totalInserted}`);
        console.log(`Total Updated (Existing): ${totalUpdated}`);

        process.exit(0);
    } catch (err) {
        console.error('Ingestion failed:', err);
        process.exit(1);
    }
}

ingest();
