import mongoose from 'mongoose';
import app from './index.js';

let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
      isConnected = true;
      console.log('✅ MongoDB connected (cold start)');
    } catch (err) {
      console.error('❌ MongoDB connection failed:', err);
      return res.status(500).json({ message: 'Database connection failed' });
    }
  }

  return app(req, res);
}
