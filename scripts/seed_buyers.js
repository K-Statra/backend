require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { Buyer } = require('../src/models/Buyer');

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeBuyers(n = 20) {
  const countries = ['KR', 'US', 'JP', 'DE', 'GB', 'SG'];
  const industriesPool = ['IT', 'Healthcare', 'Finance', 'Education', 'Retail'];
  const needsPool = ['SaaS', 'API', 'Integration', 'Security', 'Analytics'];
  const tagsPool = ['b2b', 'import', 'export', 'wholesale', 'retail', 'cloud'];

  const list = [];
  for (let i = 1; i <= n; i++) {
    const name = `Buyer_${i}`;
    const country = pick(countries);
    const industries = Array.from(new Set([pick(industriesPool), pick(industriesPool)])).slice(0, 2);
    const needs = Array.from(new Set([pick(needsPool), pick(needsPool)])).slice(0, 2);
    const tags = Array.from(new Set([pick(tagsPool), pick(tagsPool)])).slice(0, 2);
    list.push({
      name,
      country,
      industries,
      needs,
      tags,
      profileText: `${name} profile: ${country} market, industries ${industries.join(', ')}`,
    });
  }
  return list;
}

(async () => {
  try {
    console.log('[seed:buyers] connecting DB...');
    await connectDB();
    console.log('[seed:buyers] inserting documents...');
    const docs = makeBuyers(20);
    const result = await Buyer.insertMany(docs, { ordered: false });
    console.log(`[seed:buyers] inserted: ${result.length}`);
  } catch (err) {
    if (err && err.writeErrors) {
      console.error('[seed:buyers] partial insert, errors:', err.writeErrors.length);
    } else {
      console.error('[seed:buyers] error:', err.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('[seed:buyers] done.');
    process.exit(0);
  }
})();

