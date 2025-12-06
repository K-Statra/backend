require('dotenv').config();
const { searchWeb } = require('./src/providers/search/tavily');
const { chat } = require('./src/providers/chat/openai');

async function testSearchFlow() {
    const query = "미국 LA에 소재한 K-Beaty 수입상을 추천해달라";
    console.log(`Testing Query: "${query}"`);

    // 1. Test Intent Router
    console.log('\n--- 1. Testing Intent Router ---');
    const routerPrompt = `
    You are a search router for a B2B matching platform specialized in "K-Beauty, Cosmetics, Food, and Consumer Goods".
    User Query: "${query}"
    
    Task: Determine if this query falls within our specialized domain.
    - If the query is about Beauty, Cosmetics, Skincare, Makeup, Food, Supplements, or general Consumer Goods, output "DB".
    - If the query is about Automotive, Machinery, Construction, IT, Electronics, or any other unrelated industry, output "WEB".
    - If unsure, output "DB".
    
    Output only one word: "DB" or "WEB".
    `;
    try {
        const decision = await chat([{ role: 'user', content: routerPrompt }]);
        console.log(`[Router] Decision: ${decision}`);
    } catch (e) {
        console.error('[Router] Error:', e.message);
    }

    // 2. Test Tavily Direct Search
    console.log('\n--- 2. Testing Tavily Direct Search ---');
    if (!process.env.TAVILY_API_KEY) {
        console.error('ERROR: TAVILY_API_KEY is missing in .env');
    } else {
        try {
            const results = await searchWeb(query);
            console.log('Tavily Results:', JSON.stringify(results, null, 2));
        } catch (e) {
            console.error('Tavily Error:', e.message);
        }
    }
}

testSearchFlow();
