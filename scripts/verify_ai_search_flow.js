require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');
const { chat } = require('../src/providers/chat/openai');
const { embed } = require('../src/providers/embeddings');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra';

async function verifyAI() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        // 1. Verify Intent Router
        const testQuery = "I want to export K-Beauty cosmetics to USA";
        console.log(`\n--- Testing Intent Logic for: "${testQuery}" ---`);

        const routerPrompt = `
        You are a search router.
        User Query: "${testQuery}"
        Task: If query is about Beauty/Cosmetics/Food, output "DB". Else "WEB".
        Output only one word.
        `;
        const decision = await chat([{ role: 'user', content: routerPrompt }]);
        console.log(`Router Decision: ${decision}`);


        // 2. Verify Vector Search
        console.log(`\n--- Testing Vector Search (Embeddings) ---`);
        const vector = await embed(testQuery);
        console.log(`Generated Embedding Length: ${vector.length}`);

        if (vector.length > 0) {
            // Note: Vector search syntax depends on Mongoose version or raw driver. 
            // Here we allow fallback to regex if vector fails locally (no Atlas index).
            console.log("Simulating Vector Search Query...");
            // Use simple regex for local verification if vector index not present
            const results = await Company.find({
                $or: [
                    { industry: /Beauty/i },
                    { profileText: /Cosmetics/i }
                ]
            }).limit(3).select('name industry profileText');

            console.log(`Found ${results.length} companies locally (simulating vector match):`);
            results.forEach(c => console.log(`- ${c.name} (${c.industry})`));

            // 3. Verify AI Summary
            if (results.length > 0) {
                console.log(`\n--- Testing AI Summary Generation ---`);
                const context = results.map(c => `- ${c.name}: ${c.profileText}`).join('\n');
                const summaryPrompt = `
                 User Query: "${testQuery}"
                 Candidates:
                 ${context}
                 
                 Recommend the best match and explain why.
                 `;
                const summary = await chat([{ role: 'user', content: summaryPrompt }]);
                console.log(`AI Summary:\n${summary}`);
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

verifyAI();
