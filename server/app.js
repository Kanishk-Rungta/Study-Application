import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Week, Task, PenaltyLog, Attendance } from './models.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* =======================
   MongoDB (Vercel Safe)
======================= */
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed', err);
    throw err;
  }
}

// Ensure DB is connected before every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch {
    res.status(500).json({ message: 'Database connection failed' });
  }
});

/* =======================
   Schedule + Helpers
======================= */
const SCHEDULE = {
  1: { start: "17:00" },
  2: { start: null },
  3: { start: "17:00" },
  4: { start: "18:30" },
  5: { start: "15:00" },
  6: { start: null }
};

const getLocalInfo = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return {
    now,
    dateStr: local.toISOString().split('T')[0],
    dayOfWeek: now.getDay()
  };
};

const getBalance = async (user) => {
  const logs = await PenaltyLog.find({ user });
  return Math.max(0, logs.reduce((s, l) => s + l.points, 0));
};

/* =======================
   Routes
======================= */

app.get('/api/weeks', async (_, res) => {
  try {
    const weeks = await Week.find().populate('tasks').sort({ startDate: -1 });
    res.json(weeks);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/api/weeks', async (req, res) => {
  try {
    const week = await Week.create(req.body);
    res.status(201).json(week);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const task = await Task.create(req.body);
    await Week.findByIdAndUpdate(req.body.weekId, {
      $push: { tasks: task._id }
    });
    res.status(201).json(task);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.patch('/api/tasks/:id/complete', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const other = task.assignedUser === 'Kanishk' ? 'Anmol' : 'Kanishk';
    const now = new Date();
    const due = new Date(task.dueDate);
    due.setHours(23, 59, 59, 999);

    let reward = 0;
    let status = 'Completed On Time';

    if (now > due) {
      reward = Math.ceil((now - due) / 86400000) * 10;
      status = 'Completed Late';
      await PenaltyLog.create({
        user: other,
        fromUser: 'System',
        points: reward,
        type: 'Penalty',
        task: task._id,
        reason: `${task.assignedUser} finished late`
      });
    }

    task.status = status;
    await task.save();
    res.json(task);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.delete('/api/weeks/:id', async (req, res) => {
  try {
    const week = await Week.findById(req.params.id);
    await Task.deleteMany({ _id: { $in: week.tasks } });
    await PenaltyLog.deleteMany({ task: { $in: week.tasks } });
    await Week.findByIdAndDelete(req.params.id);
    res.json({ message: 'Wiped' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* =======================
   EXPORT FOR VERCEL
======================= */
export default app;
