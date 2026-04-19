const mongoose = require('mongoose');
require('dotenv').config();
const { Company } = require('../src/models/Company');
const { searchWeb } = require('../src/providers/search/tavily');

const POC_COUNTRIES = [
    // Latin America
    'Brazil', 'Chile', 'Panama',
    // Middle East
    'UAE', 'Oman',
    // Asia
    'Vietnam', 'Indonesia', 'Thailand',
    // CIS
    'Uzbekistan', 'Kazakhstan',
    // Africa
    'Kenya', 'Nigeria', 'Egypt', 'Morocco',
    // Eastern Europe
    'Poland', 'Hungary', 'Czech Republic',
    // North America
    'US', 'Mexico', 'Canada',
    // Europe
    'Germany', 'France', 'Spain'
];

async function trainPocCountries() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB for PoC Countries Training');

        let totalInserted = 0;

        for (const country of POC_COUNTRIES) {
            console.log(`\n\n==========================================`);
            console.log(`Processing Target Country: ${country}`);
            console.log(`==========================================`);
            
            const queries = [
                `${country} automotive parts importer distributor buyer B2B company "contact" -software -crm`,
                `${country} auto parts distributor buyer procurement B2B company -platform -capterra`
            ];

            for (const q of queries) {
                console.log(`\nSearching Web: ${q}`);
                const results = await searchWeb(q);
                const rawResults = results.results || [];
                
                console.log(`Found ${rawResults.length} results for query. Accumulating to DB...`);
                let countryInserted = 0;
                
                for (const item of rawResults) {
                    const title = (item.title || "").toLowerCase();
                    const content = (item.content || "").toLowerCase();
                    
                    // Penalize if it's clearly a supplier/manufacturer/news
                    const penalties = ['supplier', 'seller', 'manufacturer', 'factory', 'exporter', 'news', 'article', 'report'];
                    if (penalties.some(p => title.includes(p) || content.includes(p))) {
                        console.log(`Skipping (seems like seller/news): ${item.title}`);
                        continue; // For POC, let's actually skip these to keep data clean
                    }

                    await Company.findOneAndUpdate(
                        { name: item.title },
                        { 
                            $set: {
                                name: item.title,
                                industry: 'Mobility / Automation / Manufacturing',
                                location: { country: country, city: '' },
                                profileText: item.content,
                                website: item.url,
                                dataSource: 'Tavily Web Search',
                                tags: ['Buyer', country, 'Automotive Parts'],
                                updatedAt: new Date()
                            }
                        },
                        { upsert: true, setDefaultsOnInsert: true }
                    );
                    countryInserted++;
                    totalInserted++;
                }
                console.log(`Inserted ${countryInserted} buyers for ${country} from this query.`);
            }
        }

        console.log(`\n==========================================`);
        console.log(`Success! Total PoC target companies inserted: ${totalInserted}`);
        console.log(`==========================================`);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
        process.exitCode = 1;
    }
}

trainPocCountries();
