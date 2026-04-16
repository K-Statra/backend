"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/k-statra',
    },
    neo4j: {
        uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
        user: process.env.NEO4J_USER || 'neo4j',
        password: process.env.NEO4J_PASSWORD || '',
    },
    xrpl: {
        wsUrl: process.env.XRPL_WS_URL || 'wss://s.altnet.rippletest.net:51233',
        destAddress: process.env.XRPL_DEST_ADDRESS || '',
        issuedCurrencyCode: process.env.XRPL_ISSUED_CURRENCY_CODE || '',
        issuerAddress: process.env.XRPL_ISSUER_ADDRESS || '',
    },
    xumm: {
        apiKey: process.env.XUMM_API_KEY || '',
        apiSecret: process.env.XUMM_API_SECRET || '',
        webhookSecret: process.env.XUMM_WEBHOOK_SECRET || '',
    },
    payments: {
        provider: process.env.PAYMENTS_PROVIDER || 'xrpl-testnet',
        webhookSecret: process.env.PAYMENTS_WEBHOOK_SECRET || '',
        allowedCurrencies: (process.env.PAYMENTS_ALLOWED_CURRENCIES || 'XRP').split(',').map(s => s.trim().toUpperCase()),
    },
    cors: {
        origins: (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim()),
    },
});
//# sourceMappingURL=env.config.js.map