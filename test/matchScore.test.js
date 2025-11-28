const assert = require('assert');
const { scoreCompany, cosineSimilarity } = require('../src/services/matchScore');

(function testDeterminism() {
  const buyer = { tags: ['b2b', 'cloud'], industries: ['it'], needs: ['saas'], embedding: [0.1, 0.2, 0.3] };
  const fixedDate = new Date('2024-01-01T00:00:00.000Z');
  const company = { tags: ['Cloud', 'AI'], industry: 'IT', offerings: ['SaaS'], updatedAt: fixedDate, embedding: [0.1, 0.2, 0.3] };

  delete process.env.MATCH_USE_EMBEDDING;
  const a = scoreCompany(buyer, company).score;
  const b = scoreCompany(buyer, company).score;
  assert.strictEqual(a, b, 'score should be deterministic without embedding');
})();

(function testEmbeddingWeightInfluence() {
  const buyer = { tags: [], industries: [], needs: [], embedding: [1, 0, 0] };
  const companyNear = { tags: [], industry: '', offerings: [], updatedAt: new Date(), embedding: [1, 0, 0] };
  const companyFar = { tags: [], industry: '', offerings: [], updatedAt: new Date(), embedding: [0, 1, 0] };

  process.env.MATCH_USE_EMBEDDING = 'true';
  process.env.MATCH_EMBEDDING_WEIGHT = '0.5';
  const nearScore = scoreCompany(buyer, companyNear).score;
  const farScore = scoreCompany(buyer, companyFar).score;
  assert.ok(nearScore > farScore, 'embedding similarity should influence score');
})();

(function testCosineSimilarityBounds() {
  assert.strictEqual(cosineSimilarity([], []), 0);
  assert.strictEqual(cosineSimilarity([0, 0], [0, 0]), 0);
  const sim = cosineSimilarity([1, 0], [1, 0]);
  assert.ok(sim <= 1 && sim >= 0, 'cosine similarity within [0,1]');
})();
