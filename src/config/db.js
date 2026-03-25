const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[DB] Missing MONGODB_URI in .env');
    return;
  }
  const opts = {
    // Atlas Flex/serverless friendly defaults; override via env as needed
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 0),
    maxIdleTimeMS: Number(process.env.MONGODB_MAX_IDLE_TIME_MS || 30000),
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000),
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),
    retryWrites: true,
    w: 'majority',
  };

  mongoose.connection.on('connected', () => {
    console.log('[DB] Mongoose connected to DB');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[DB] Mongoose connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] Mongoose disconnected');
  });

  try {
    await mongoose.connect(uri, opts);
    // console.log('MongoDB connected'); // Handled by event listener
  } catch (err) {
    console.error('[DB] Initial connection error', err.message);
    throw err;
  }
}


async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[DB] Mongoose disconnected gracefully');
  } catch (err) {
    console.error('[DB] Error disconnecting:', err.message);
  }
}

module.exports = { connectDB, disconnectDB };

