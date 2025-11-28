// Utilities and scoring logic extracted from matches route for unit testing

function toSet(arr) {
  return new Set((arr || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean));
}

function intersectCount(aSet, bSet) {
  let c = 0;
  for (const x of aSet) if (bSet.has(x)) c++;
  return c;
}

function cosineSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
  if (!Number.isFinite(sim)) return 0;
  return Math.max(0, Math.min(1, sim));
}

function scoreCompany(buyer, company) {
  const buyerTags = toSet(buyer.tags);
  const buyerIndustries = toSet(buyer.industries);
  const buyerNeeds = toSet(buyer.needs);

  const companyTags = toSet(company.tags);
  const companyIndustry = String(company.industry || '').toLowerCase().trim();
  const companyOfferings = toSet(company.offerings);

  let score = 0;
  const reasons = [];

  const tagMatches = intersectCount(buyerTags, companyTags);
  if (tagMatches > 0) {
    score += tagMatches * 2;
    reasons.push(`tags overlap x${tagMatches}`);
  }

  if (companyIndustry && buyerIndustries.has(companyIndustry)) {
    score += 3;
    reasons.push('industry match');
  }

  const needOfferingMatches = intersectCount(buyerNeeds, companyOfferings);
  if (needOfferingMatches > 0) {
    score += needOfferingMatches * 2;
    reasons.push(`needs-offerings overlap x${needOfferingMatches}`);
  }

  const updated = company.updatedAt ? new Date(company.updatedAt) : new Date();
  const days = Math.max(0, (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
  const recencyBonus = Math.max(0, 30 - days) / 30; // 0..1
  if (recencyBonus > 0) {
    score += recencyBonus;
    reasons.push('recently updated');
  }

  const useEmbedding = String(process.env.MATCH_USE_EMBEDDING || 'false').toLowerCase().trim() === 'true';
  if (useEmbedding) {
    const weight = Number(process.env.MATCH_EMBEDDING_WEIGHT || 0.3);
    let sim = 0;

    if (typeof company.vectorScore === 'number') {
      sim = company.vectorScore;
    } else if (buyer.embedding && company.embedding) {
      sim = cosineSimilarity(buyer.embedding, company.embedding);
    }

    if (sim > 0 && weight > 0) {
      const embContribution = sim * 10 * Math.max(0, Math.min(1, weight));
      score += embContribution;
      reasons.push(`embedding sim ${sim.toFixed(2)}`);
    }
  }

  return { score, reasons };
}

module.exports = { toSet, intersectCount, cosineSimilarity, scoreCompany };

