require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
const { embed } = require('../src/providers/embeddings');

const SLEEP_MS = 200; // Sleep between batches to avoid rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateEmbeddings() {
    try {
        await connectDB();

        const args = process.argv.slice(2);
        const limitArgIndex = args.indexOf('--limit');
        // Default to processing all if no limit specified, but respect limit if given
        const limit = limitArgIndex !== -1 ? parseInt(args[limitArgIndex + 1]) : 200000;

        console.log(`Finding companies without embeddings (Limit: ${limit})...`);

        // Find companies where embedding is empty or missing
        const cursor = Company.find({
            $or: [
                { embedding: { $exists: false } },
                { embedding: { $size: 0 } },
                { embedding: null }
            ]
        }).limit(limit).batchSize(100).cursor();

        let batch = [];
        const BATCH_SIZE = 50; // Reduced batch size for safety
        let totalProcessed = 0;
        let successCount = 0;

        console.log('Starting batch generation...');

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            batch.push(doc);

            if (batch.length >= BATCH_SIZE) {
                await processBatch(batch);
                totalProcessed += batch.length;
                successCount += batch.length; // Approximate
                process.stdout.write(`\rProcessed: ${totalProcessed}`);
                batch = [];
                await sleep(SLEEP_MS);
            }
        }

        if (batch.length > 0) {
            await processBatch(batch);
            totalProcessed += batch.length;
            successCount += batch.length;
        }

        console.log('\n\n--- Summary ---');
        console.log(`Total Processed: ${totalProcessed}`);

        process.exit(0);
    } catch (err) {
        console.error('\nScript failed:', err);
        process.exit(1);
    }
}

async function processBatch(companies) {
    try {
        // 1. Prepare texts
        const texts = companies.map(c => {
            const parts = [
                `Company: ${c.name}`,
                c.industry ? `Industry: ${c.industry}` : '',
                c.tags && c.tags.length > 0 ? `Tags: ${c.tags.join(', ')}` : '',
                c.profileText ? `Profile: ${c.profileText}` : '',
                c.offerings && c.offerings.length > 0 ? `Offerings: ${c.offerings.join(', ')}` : '',
                c.needs && c.needs.length > 0 ? `Needs: ${c.needs.join(', ')}` : ''
            ];
            return parts.filter(Boolean).join('\n').substring(0, 8000); // Truncate just in case
        });

        // 2. Call API (Batch) with retry
        let embeddings = [];
        let retries = 3;
        while (retries > 0) {
            try {
                embeddings = await embed(texts);
                if (embeddings && embeddings.length === companies.length) break;
            } catch (e) {
                console.error(`\nAPI Error (Retries left: ${retries}): ${e.message}`);
                await sleep(2000);
            }
            retries--;
        }

        if (!embeddings || embeddings.length !== companies.length) {
            console.error(`\nBatch failed: Expected ${companies.length} embeddings, got ${embeddings ? embeddings.length : 0}`);
            return; // Skip update
        }

        // 3. Bulk Update
        const operations = companies.map((c, i) => ({
            updateOne: {
                filter: { _id: c._id },
                update: { $set: { embedding: embeddings[i] } }
            }
        }));

        await Company.bulkWrite(operations, { ordered: false });

    } catch (err) {
        console.error(`\nError processing batch: ${err.message}`);
    }
}

generateEmbeddings();
