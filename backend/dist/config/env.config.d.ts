declare const _default: () => {
    port: number;
    nodeEnv: string;
    mongodb: {
        uri: string;
    };
    neo4j: {
        uri: string;
        user: string;
        password: string;
    };
    xrpl: {
        wsUrl: string;
        destAddress: string;
        issuedCurrencyCode: string;
        issuerAddress: string;
    };
    xumm: {
        apiKey: string;
        apiSecret: string;
        webhookSecret: string;
    };
    payments: {
        provider: string;
        webhookSecret: string;
        allowedCurrencies: string[];
    };
    cors: {
        origins: string[];
    };
};
export default _default;
