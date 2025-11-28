const axios = require('axios');

// OpenAI Embeddings provider
// Environment variables:
// - OPENAI_API_KEY (required)
// - OPENAI_EMBED_MODEL (optional, default: text-embedding-3-small)
// Returns a numeric array embedding; falls back to empty array on error.

async function embed(text = '') {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  if (!apiKey) {
    // No key configured; return empty vector to avoid hard-failing callers
    return [];
  }

  const payload = {
    input: String(text || ''),
    model,
  };

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/embeddings',
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: Number(process.env.OPENAI_TIMEOUT_MS || 20000),
        maxContentLength: 10 * 1024 * 1024,
      }
    );

    const data = res.data && res.data.data && res.data.data[0];
    const vec = (data && Array.isArray(data.embedding)) ? data.embedding : [];
    const out = [];
    for (let i = 0; i < vec.length; i++) {
      const v = Number(vec[i]);
      out.push(Number.isFinite(v) ? v : 0);
    }
    return out;
  } catch (err) {
    if (String(process.env.OPENAI_DEBUG || '0') === '1') {
      try {
        const status = err.response && err.response.status;
        const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
        // eslint-disable-next-line no-console
        console.warn(`[openai] embed error status=${status || '-'} msg=${msg}`);
      } catch (_) {}
    }
    return [];
  }
}

module.exports = { embed };

