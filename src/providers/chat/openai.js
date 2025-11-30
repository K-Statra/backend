const axios = require('axios');
const { logger } = require('../../utils/logger');

// OpenAI Chat Completion provider
// Environment variables:
// - OPENAI_API_KEY (required)
// - OPENAI_CHAT_MODEL (optional, default: gpt-3.5-turbo)

async function chat(messages = [], options = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo';

    if (!apiKey) {
        logger.warn('[openai] chat: No API key configured');
        return null;
    }

    const payload = {
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000,
    };

    try {
        const res = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000, // 10s timeout
            }
        );

        return res.data?.choices?.[0]?.message?.content || null;
    } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        logger.error(`[openai] chat error status=${status} msg=${msg}`);
        return null;
    }
}

module.exports = { chat };
