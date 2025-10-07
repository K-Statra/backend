import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[DB] MONGODB_URI 가 .env 에 없습니다. (나중에 설정 예정)');
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log('[DB] MongoDB connected');
  } catch (err) {
    console.error('[DB] connection error', err);
    process.exit(1);
  }
}
