const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// GET /ready - readiness probe with DB check
router.get('/', async (req, res) => {
  try {
    const state = mongoose.connection.readyState; // 1=connected, 2=connecting, 0=disconnected, 3=disconnecting
    if (state !== 1) {
      return res.status(503).json({ status: 'not-ready', db: state });
    }
    // Optional: ping DB
    if (mongoose.connection.db && mongoose.connection.db.admin) {
      try {
        await mongoose.connection.db.admin().command({ ping: 1 });
      } catch (_) {
        return res.status(503).json({ status: 'not-ready', db: 'no-ping' });
      }
    }
    return res.json({ status: 'ready', db: 'ok' });
  } catch (err) {
    return res.status(503).json({ status: 'not-ready', error: err.message });
  }
});

module.exports = router;

