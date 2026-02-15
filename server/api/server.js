import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from './index.js';

dotenv.config();

mongoose.set('bufferCommands', false);

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });

  isConnected = true;
  console.log('✅ MongoDB connected');
}

/* 🔥 VERCEL SERVERLESS HANDLER */
export default async function handler(req, res) {
  try {
    await connectDB();
    return app(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database connection failed' });
  }
}
