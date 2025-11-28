/**
 * Minimal Mongo copy utility using Mongoose (no external tools required).
 *
 * Copies selected collections from a source MongoDB to a destination MongoDB.
 * Designed to help migrate from Atlas cluster A -> FLEX/M2 cluster B
 * when mongodump/mongorestore are not available.
 *
 * Usage (Windows PowerShell examples):
 *   $env:MONGODB_URI_SRC="<src-uri>"; $env:MONGODB_URI_DST="<dst-uri>"; node scripts/clone_db.js companies buyers --drop
 *   node scripts/clone_db.js --src "<src-uri>" --dst "<dst-uri>" companies buyers --drop
 *
 * Collections supported out of the box: companies, buyers
 * You may add more by extending the map below to include schema & collection name.
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import app models to reuse their schemas
const { Company } = require('../src/models/Company');
const { Buyer } = require('../src/models/Buyer');

function parseArgs(argv) {
  const out = { src: process.env.MONGODB_URI_SRC || '', dst: process.env.MONGODB_URI_DST || '', drop: false, cols: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--src' && argv[i + 1]) { out.src = argv[++i]; continue; }
    if (a === '--dst' && argv[i + 1]) { out.dst = argv[++i]; continue; }
    if (a === '--drop') { out.drop = true; continue; }
    if (!a.startsWith('--')) out.cols.push(a.toLowerCase());
  }
  if (out.cols.length === 0) out.cols = ['companies', 'buyers'];
  return out;
}

const COLLECTIONS = {
  companies: {
    schema: Company.schema,
    collectionName: 'companies',
  },
  buyers: {
    schema: Buyer.schema,
    collectionName: 'buyers',
  },
};

async function cloneCollection(srcConn, dstConn, key, { drop = false }) {
  if (!COLLECTIONS[key]) throw new Error(`Unsupported collection: ${key}`);
  const { schema, collectionName } = COLLECTIONS[key];

  const SrcModel = srcConn.model(key, schema, collectionName);
  const DstModel = dstConn.model(key, schema, collectionName);

  if (drop) {
    try { await dstConn.db.dropCollection(collectionName); } catch (_) {}
  }

  await DstModel.syncIndexes().catch(() => {});

  const cursor = SrcModel.find({}).lean().cursor();
  const batch = [];
  const BATCH_SIZE = 500;
  let n = 0;
  for await (const doc of cursor) {
    // Ensure plain object (lean) and upsert by _id
    batch.push({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
    });
    if (batch.length >= BATCH_SIZE) {
      await DstModel.bulkWrite(batch, { ordered: false });
      n += batch.length;
      process.stdout.write(`\r[${key}] copied: ${n}`);
      batch.length = 0;
    }
  }
  if (batch.length) {
    await DstModel.bulkWrite(batch, { ordered: false });
    n += batch.length;
  }
  process.stdout.write(`\r[${key}] copied: ${n}\n`);
}

(async () => {
  const args = parseArgs(process.argv);
  if (!args.src || !args.dst) {
    console.error('Usage: node scripts/clone_db.js [--src <uri>] [--dst <uri>] [companies] [buyers] [--drop]');
    console.error('Or set env: MONGODB_URI_SRC, MONGODB_URI_DST');
    process.exit(1);
  }

  const srcConn = await mongoose.createConnection(args.src, { autoIndex: true }).asPromise();
  const dstConn = await mongoose.createConnection(args.dst, { autoIndex: true }).asPromise();
  console.log('[clone] connected');
  try {
    for (const key of args.cols) {
      await cloneCollection(srcConn, dstConn, key, { drop: args.drop });
    }
    console.log('[clone] done');
  } catch (err) {
    console.error('[clone] error:', err && err.message);
    process.exitCode = 1;
  } finally {
    try { await srcConn.close(); } catch (_) {}
    try { await dstConn.close(); } catch (_) {}
  }
})();

