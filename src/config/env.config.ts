export default () => ({
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  mongodb: {
    uri: (() => {
      const uri = process.env.MONGODB_URI?.trim();
      if (!uri) {
        throw new Error("MONGODB_URI env var is required");
      }
      return uri;
    })(),
    dbName: process.env.MONGODB_DB_NAME || "K-statra",
    vectorIndex: process.env.ATLAS_VECTOR_INDEX,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },

  embeddings: {
    provider: (process.env.EMBEDDINGS_PROVIDER || "mock").toLowerCase(),
    openai: {
      model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
      timeout: Number(process.env.OPENAI_TIMEOUT_MS || 20000),
      debug: process.env.OPENAI_DEBUG === "1",
    },
    huggingface: {
      apiToken: process.env.HF_API_TOKEN || "",
      model: process.env.HF_EMBEDDING_MODEL || "intfloat/multilingual-e5-small",
      timeout: Number(process.env.HF_TIMEOUT_MS || 20000),
      debug: process.env.HF_DEBUG === "1",
    },
  },

  tavily: {
    apiKey: process.env.TAVILY_API_KEY || "",
  },

  neo4j: {
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    user: process.env.NEO4J_USER || "neo4j",
    password: process.env.NEO4J_PASSWORD || "",
    graphScoreWeight: Number(process.env.GRAPH_SCORE_WEIGHT || 0.3),
  },

  matching: {
    useEmbedding: process.env.MATCH_USE_EMBEDDING === "true",
    embeddingWeight: Number(process.env.MATCH_EMBEDDING_WEIGHT || 0.3),
    useAtlasVector: process.env.MATCH_USE_ATLAS_VECTOR === "true",
  },

  xrpl: {
    wsUrl: process.env.XRPL_WS_URL || "wss://s.altnet.rippletest.net:51233",
    destAddress: process.env.XRPL_DEST_ADDRESS || "",
    issuedCurrencyCode: process.env.XRPL_ISSUED_CURRENCY_CODE || "",
    issuerAddress: process.env.XRPL_ISSUER_ADDRESS || "",
  },

  xumm: {
    apiKey: process.env.XUMM_API_KEY || "",
    apiSecret: process.env.XUMM_API_SECRET || "",
    webhookSecret: process.env.XUMM_WEBHOOK_SECRET || "",
  },

  payments: {
    provider: process.env.PAYMENTS_PROVIDER || "xrpl-testnet",
    webhookSecret: process.env.PAYMENTS_WEBHOOK_SECRET || "",
    allowedCurrencies: (process.env.PAYMENTS_ALLOWED_CURRENCIES || "XRP")
      .split(",")
      .map((s) => s.trim().toUpperCase()),
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || "*").split(",").map((s) => s.trim()),
  },

  redis: {
    password: process.env.REDIS_PASSWORD || "",
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
  },

  session: {
    secret:
      process.env.SESSION_SECRET ??
      (process.env.NODE_ENV === "production"
        ? (() => {
            throw new Error("SESSION_SECRET env var is required in production");
          })()
        : "dev-secret-change-in-production"),
    ttl: Number(process.env.SESSION_TTL_SECONDS || 7 * 24 * 60 * 60), // 7일
  },

  security: {
    encryptionKey:
      process.env.ENCRYPTION_KEY ??
      (process.env.NODE_ENV === "production"
        ? (() => {
            throw new Error("ENCRYPTION_KEY env var is required in production");
          })()
        : "3b1a51039ac4a559d0dcec462cce9a66381632ba7e5570b1f9b32a82b1d7e8cc"),
  },
});
