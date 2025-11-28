require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
const { Buyer } = require('../src/models/Buyer');
const { embed, provider } = require('../src/providers/embeddings');

function usage() {
  console.log('Usage: node scripts/embed_text.js [companies|buyers|all] [--limit N]');
}

function parseArgs(argv) {
  const args = { target: 'all', limit: 0 };
  if (argv[2]) args.target = String(argv[2]).toLowerCase();
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit' && i + 1 < argv.length) {
      args.limit = Number(argv[i + 1]) || 0;
      i++;
    }
  }
  return args;
}

async function processCompanies(limit = 0) {
  const cursor = Company.find({}).cursor();
  let processed = 0;
  let skipped = 0;
  for await (const doc of cursor) {
    const text = [doc.name, doc.profileText, ...(doc.tags || [])].filter(Boolean).join(' \n');
    const vec = await embed(text);
    if (Array.isArray(vec) && vec.length > 0) {
      doc.embedding = vec;
      await doc.save();
      processed++;
    } else {
      skipped++;
    }
    if (limit > 0 && processed >= limit) break;
  }
  if (skipped > 0) console.log(`[embed_text] companies skipped(empty): ${skipped}`);
  return processed;
}

async function processBuyers(limit = 0) {
  const cursor = Buyer.find({}).cursor();
  let processed = 0;
  let skipped = 0;
  for await (const doc of cursor) {
    const text = [doc.name, doc.profileText, ...(doc.tags || []), ...(doc.industries || []), ...(doc.needs || [])]
      .filter(Boolean)
      .join(' \n');
    const vec = await embed(text);
    if (Array.isArray(vec) && vec.length > 0) {
      doc.embedding = vec;
      await doc.save();
      processed++;
    } else {
      skipped++;
    }
    if (limit > 0 && processed >= limit) break;
  }
  if (skipped > 0) console.log(`[embed_text] buyers skipped(empty): ${skipped}`);
  return processed;
}

(async () => {
  const args = parseArgs(process.argv);
  if (!['companies', 'buyers', 'all'].includes(args.target)) {
    usage();
    process.exit(1);
  }
  try {
    console.log(`[embed_text] provider=${provider}`);
    await connectDB();
    let total = 0;
    if (args.target === 'companies' || args.target === 'all') {
      const n = await processCompanies(args.limit);
      console.log(`[embed_text] companies updated: ${n}`);
      total += n;
    }
    if (args.target === 'buyers' || args.target === 'all') {
      const n = await processBuyers(args.limit);
      console.log(`[embed_text] buyers updated: ${n}`);
      total += n;
    }
    console.log(`[embed_text] done. total updated: ${total}`);
  } catch (err) {
    console.error('[embed_text] error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
