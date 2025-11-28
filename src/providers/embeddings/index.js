const providerName = (process.env.EMBEDDINGS_PROVIDER || 'mock').toLowerCase();

let provider;
switch (providerName) {
  case 'openai':
    provider = require('./openai');
    break;
  case 'huggingface':
    provider = require('./huggingface');
    break;
  case 'mock':
  default:
    provider = require('./mock');
    break;
}

// Always expose an async embed() to accommodate remote providers.
// For sync providers, wrap in Promise.resolve to keep the interface consistent.
async function embed(text) {
  try {
    const result = provider.embed(text);
    return await Promise.resolve(result);
  } catch (_) {
    return [];
  }
}

module.exports = {
  embed,
  provider: providerName,
};
