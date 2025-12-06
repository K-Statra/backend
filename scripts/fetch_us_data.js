require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');

const FMP_API_KEY = process.env.FMP_API_KEY;

// Top US Tech & Famous Companies
const TICKERS = [
    'AAPL', // Apple
    'MSFT', // Microsoft
    'GOOGL', // Alphabet (Google)
    'AMZN', // Amazon
    'TSLA', // Tesla
    'NVDA', // NVIDIA
    'META', // Meta (Facebook)
    'NFLX', // Netflix
    'INTC', // Intel
    'AMD',  // AMD
    'IBM',  // IBM
    'ORCL', // Oracle
    'CRM',  // Salesforce
    'ADBE', // Adobe
    'PYPL'  // PayPal
];

async function fetchCompanyProfile(ticker) {
    try {
        const url = `https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${FMP_API_KEY}`;
        const response = await axios.get(url);
        if (response.data && response.data.length > 0) {
            return response.data[0];
        }
        return null;
    } catch (error) {
        console.error(`Error fetching ${ticker}:`, error.message);
        return null;
    }
}

async function run() {
    if (!FMP_API_KEY) {
        console.error('ERROR: FMP_API_KEY is missing in .env file.');
        console.error('Please get a free key from https://site.financialmodelingprep.com/developer/docs');
        process.exit(1);
    }

    try {
        await connectDB();
        console.log(`Starting US Company Fetch for ${TICKERS.length} tickers...`);

        for (const ticker of TICKERS) {
            const profile = await fetchCompanyProfile(ticker);

            if (profile) {
                const companyData = {
                    name: profile.companyName,
                    industry: profile.sector || 'Technology', // Fallback
                    offerings: [profile.industry, 'Tech Services', 'Products'], // Mock offerings based on industry
                    location: {
                        country: 'USA',
                        city: profile.city || 'Unknown',
                        state: profile.state || ''
                    },
                    tags: [profile.sector, profile.industry, 'US Stock', ticker].filter(Boolean),
                    profileText: profile.description,
                    website: profile.website,
                    dataSource: 'fmp_api',
                    extractedAt: new Date(),
                    images: profile.image ? [{ url: profile.image, caption: 'Logo' }] : []
                };

                await Company.findOneAndUpdate(
                    { name: profile.companyName },
                    companyData,
                    { upsert: true, new: true }
                );
                console.log(`[SUCCESS] Upserted: ${profile.companyName} (${ticker})`);
            } else {
                console.warn(`[WARN] No data found for ${ticker}`);
            }

            // Respect API rate limits (mild delay)
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log('Fetch complete.');
        process.exit(0);
    } catch (err) {
        console.error('Script failed:', err);
        process.exit(1);
    }
}

run();
