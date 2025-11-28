const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

router.get('/metrics', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 1 : 0;
        const uptime = process.uptime();
        const memory = process.memoryUsage();

        const metrics = [
            '# HELP node_uptime_seconds Node.js process uptime in seconds',
            '# TYPE node_uptime_seconds gauge',
            `node_uptime_seconds ${uptime}`,
            '',
            '# HELP node_memory_usage_bytes Node.js memory usage',
            '# TYPE node_memory_usage_bytes gauge',
            `node_memory_usage_bytes{type="heapUsed"} ${memory.heapUsed}`,
            `node_memory_usage_bytes{type="heapTotal"} ${memory.heapTotal}`,
            `node_memory_usage_bytes{type="rss"} ${memory.rss}`,
            '',
            '# HELP mongodb_connection_status MongoDB connection status (1=connected, 0=disconnected)',
            '# TYPE mongodb_connection_status gauge',
            `mongodb_connection_status ${dbStatus}`,
        ];

        res.set('Content-Type', 'text/plain');
        res.send(metrics.join('\n'));
    } catch (err) {
        res.status(500).send('# Error collecting metrics');
    }
});

module.exports = router;
