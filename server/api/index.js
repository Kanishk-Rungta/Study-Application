import mongoose from 'mongoose';
import app from '../app.js';

let isConnected = false;

export default async function handler(req, res) {
  try {
    if (!isConnected) {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
      isConnected = true;
      console.log('✅ MongoDB connected');
    }

    return app(req, res);
  } catch (err) {
    console.error('❌ MongoDB error:', err);
    return res.status(500).json({ message: 'Database connection failed' });
  }
}
