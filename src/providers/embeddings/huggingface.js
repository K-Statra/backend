const axios = require('axios');

// Hugging Face Inference API provider for text embeddings
// Environment variables:
// - HF_API_TOKEN (required)
// - HF_EMBEDDING_MODEL (optional, default: intfloat/multilingual-e5-small)
// Returns a numeric array embedding; falls back to empty array on error.

async function embed(text = '') {
  const apiToken = process.env.HF_API_TOKEN;
  const model = process.env.HF_EMBEDDING_MODEL || 'intfloat/multilingual-e5-small';
  if (!apiToken) {
    // No token configured; return empty vector to avoid hard-failing callers
    return [];
  }

  const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeURIComponent(model)}?wait_for_model=true`;
  const payload = String(text || '');

  try {
    const res = await axios.post(
      url,
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'text/plain',
        },
        timeout: Number(process.env.HF_TIMEOUT_MS || 20000),
        maxContentLength: 10 * 1024 * 1024,
      }
    );

    // The API may return either a flat array or nested [ [ .. ] ] depending on model
    let vec = Array.isArray(res.data) ? res.data : [];
    if (Array.isArray(vec) && Array.isArray(vec[0])) {
      vec = vec[0];
    }

    // Normalize numeric values and guard against NaN/Infinity
    const out = [];
    for (let i = 0; i < vec.length; i++) {
      const v = Number(vec[i]);
      if (Number.isFinite(v)) out.push(v);
      else out.push(0);
    }
    return out;
  } catch (err) {
    // Soft-fail for robustness; callers can proceed without embeddings
    if (String(process.env.HF_DEBUG || '0') === '1') {
      try {
        const status = err.response && err.response.status;
        const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
        // eslint-disable-next-line no-console
        console.warn(`[hf] embed error status=${status || '-'} msg=${msg}`);
      } catch (_) {}
    }
    return [];
  }
}

module.exports = { embed };
