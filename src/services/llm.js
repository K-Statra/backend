const OpenAI = require('openai');

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
const GPT_MODEL_ID = process.env.GPT_MODEL_ID || 'gpt-4o'; // Default to gpt-4o if not set

let openaiClient = null;

function getClient() {
    if (!openaiClient && process.env.OPENAI_API_KEY) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openaiClient;
}

/**
 * Analyzes a company profile to extract keywords or summary.
 * @param {Object} company - The company object
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeCompany(company) {
    const client = getClient();
    if (!client) {
        console.warn('LLM: OpenAI API Key not configured.');
        return null;
    }

    try {
        const prompt = `Analyze the following company and provide a brief summary and 5 key business tags.
        
        Company: ${company.name}
        Description: ${company.description || 'N/A'}
        Industry: ${company.industry || 'N/A'}
        KSIC Classification: ${company.ksicName || 'N/A'}
        
        Output JSON format: { "summary": "...", "tags": ["tag1", ...] }`;

        const response = await client.chat.completions.create({
            model: GPT_MODEL_ID,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" },
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error('LLM: analyzeCompany failed', error);
        return null;
    }
}

/**
 * Generates reasoning for a B2B match.
 * @param {Object} source - Buyer or Source Company
 * @param {Object} target - Target Company
 * @returns {Promise<String>} Reasoning text
 */
async function generateMatchReasoning(source, target) {
    const client = getClient();
    if (!client) {
        console.warn('LLM: OpenAI API Key not configured.');
        return 'AI Matching unavailable (Missing Key).';
    }

    try {
        const prompt = `Explain why these two companies are a good B2B match in 1-2 sentences.
        
        Buyer: ${source.name} (${source.industry})
        Target: ${target.name} (${target.stockCode || 'N/A'}, ${target.industry})
        `;

        const response = await client.chat.completions.create({
            model: GPT_MODEL_ID,
            messages: [{ role: 'user', content: prompt }],
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('LLM: generateMatchReasoning failed', error);
        return 'AI reasoning unavailable at this time.';
    }
}

/**
 * Classifies a company into a standard industry category.
 * @param {Object} company - The company object
 * @returns {Promise<String>} Normalized Industry Category
 */
async function classifyIndustry(company) {
    const client = getClient();
    if (!client) {
        console.warn('LLM: OpenAI API Key not configured.');
        return null;
    }

    const categories = [
        'Beauty & Cosmetics', 'Food & Beverage', 'Tech & Electronics', 'Health & Bio',
        'Pet Care', 'Industrial & Manufacturing', 'Energy & Environment', 'Lifestyle & Home',
        'Fashion & Accessories', 'Sports & Leisure', 'Services'
    ];

    try {
        const prompt = `Classify this company into exactly one of the following categories:
        ${categories.join(', ')}

        Company: ${company.name}
        Description: ${company.products ? JSON.stringify(company.products) : company.description || company.name}
        
        Return ONLY the category name. If unsure, choose the closest match.`;

        const response = await client.chat.completions.create({
            model: GPT_MODEL_ID,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
        });

        const result = response.choices[0].message.content.trim();
        // Validate result
        const cleaned = result.replace(/['"]/g, '');
        if (categories.includes(cleaned)) {
            return cleaned;
        }
        // Fuzzy match or default
        return categories.find(c => c.includes(cleaned)) || 'Other';
    } catch (error) {
        console.error('LLM: classifyIndustry failed', error);
        return null;
    }
}

module.exports = {
    analyzeCompany,
    generateMatchReasoning,
    classifyIndustry,
    analyzeCompanyCulture,
    extractSearchIntent,
};

/**
 * Analyzes a company's culture based on text descriptions.
 * @param {String} text - Combined text of company profile, mission, etc.
 * @returns {Promise<Object>} Cultural traits
 */
async function analyzeCompanyCulture(text) {
    const client = getClient();
    if (!client) return null;

    try {
        const prompt = `Analyze the corporate culture of this company based on the text below.
        
        Text: "${text.substring(0, 3000)}"
        
        Task:
        1. Score 'Innovation': 1 (Conservative/Stable) to 10 (Disruptive/Experimental).
        2. Score 'Hierarchy': 1 (Flat/Autonomous) to 10 (Strict Hierarchy/Chain of Command).
        3. Score 'Speed': 1 (Deliberate/Methodical) to 10 (Agile/Fast-paced).
        4. Extract 3-5 cultural keywords (e.g., "Customer-centric", "Risk-taking", "Process-driven").
        5. Write a 1-sentence cultural summary.

        Output JSON: { "innovationScore": N, "hierarchyScore": N, "speedScore": N, "keywords": [...], "summary": "..." }
        `;

        const response = await client.chat.completions.create({
            model: GPT_MODEL_ID,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error('LLM: analyzeCompanyCulture failed', error);
        return null;
    }
}

/**
 * Extracts B2B search intent from a natural language query.
 * @param {String} query - User query
 * @returns {Promise<Object>} Intent object
 */
async function extractSearchIntent(query) {
    const client = getClient();
    if (!client) return null;

    try {
        const prompt = `Extract structured B2B search intent from this query: "${query}"
        
        Fields to extract:
        - country: Target region or country (English).
        - role: "Buyer", "Seller", or "Both".
        - subject: Main product or industry (English).
        - webQuery: Optimized English query for a B2B web search (Tavily).
        
        Output JSON: { "country": "...", "role": "...", "subject": "...", "webQuery": "..." }`;

        const response = await client.chat.completions.create({
            model: GPT_MODEL_ID,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0,
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error('LLM: extractSearchIntent failed', error);
        return null;
    }
}
