require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { Buyer } = require('../src/models/Buyer');
const { Company } = require('../src/models/Company');
const { scoreCompany } = require('../src/services/matchScore');

async function main() {
  const buyerId = process.argv[2];
  const limit = Number(process.argv[3] || 10);
  if (!buyerId || !/^[a-f0-9]{24}$/i.test(buyerId)) {
    console.log('Usage: node scripts/preview_matches.js <buyerId24hex> [limit]');
    process.exit(1);
  }
  await connectDB();
  const buyer = await Buyer.findById(buyerId).exec();
  if (!buyer) {
    console.error('Buyer not found');
    process.exit(1);
  }
  const companies = await Company.find({}).sort({ updatedAt: -1 }).limit(200).exec();
  const scored = companies
    .map((c) => ({ company: c, ...scoreCompany(buyer, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  for (const r of scored) {
    console.log(`${r.score.toFixed(2)}  ${r.company.name}  [${(r.reasons || []).join(', ')}]`);
  }
}

main()
  .catch((e) => {
    console.error('error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    try { await mongoose.disconnect(); } catch (_) {}
  });

