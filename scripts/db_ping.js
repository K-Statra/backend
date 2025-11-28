require('dotenv').config();
const { connectDB } = require('../src/config/db');
const mongoose = require('mongoose');

(async () => {
  try {
    await connectDB();
    console.log('[db_ping] DB_OK');
  } catch (err) {
    console.error('[db_ping] DB_ERR', err && err.message);
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); } catch (_) {}
  }
})();

