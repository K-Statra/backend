const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: Number(process.env.RATE_LIMIT_MAX || 120),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' }
});

const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // Stricter limit for sensitive endpoints
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests to this endpoint, please slow down.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Very strict for auth/admin checks
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many auth attempts, please try again later.' }
});

module.exports = { globalLimiter, strictLimiter, authLimiter };
