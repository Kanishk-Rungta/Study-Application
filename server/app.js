import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Week, Task, PenaltyLog, Attendance } from './models.js';

dotenv.config();

const app = express();

/* -------------------- Middleware -------------------- */
app.use(cors());
app.use(express.json());

/* -------------------- MongoDB Connection -------------------- */
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    throw err;
  }
}

/* -------------------- Schedule -------------------- */
const SCHEDULE = {
  1: { start: "17:00", name: "Monday" },
  2: { start: null, name: "Tuesday" },
  3: { start: "17:00", name: "Wednesday" },
  4: { start: "18:30", name: "Thursday" },
  5: { start: "15:00", name: "Friday" },
  6: { start: null, name: "Saturday" }
};

const getLocalInfo = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const dateStr = localDate.toISOString().split('T')[0];
  const dayOfWeek = now.getDay();
  return { now, dateStr, dayOfWeek };
};

const getBalance = async (user) => {
  const logs = await PenaltyLog.find({ user });
  return Math.max(0, logs.reduce((s, l) => s + l.points, 0));
};

/* -------------------- Auto Bunk Logic -------------------- */
const checkAndProcessAutomaticBunks = async () => {
  const { now, dateStr, dayOfWeek } = getLocalInfo();
  const daySched = SCHEDULE[dayOfWeek];
  if (!daySched || !daySched.start) return;

  const [h, m] = daySched.start.split(':').map(Number);
  const cutoff = new Date(now);
  cutoff.setHours(h, m + 100, 0, 0);
  if (now <= cutoff) return;

  for (const user of ['Kanishk', 'Anmol']) {
    let attendance = await Attendance.findOne({ user, date: dateStr });
    if (attendance && attendance.status !== 'Not Arrived') continue;

    if (!attendance) attendance = new Attendance({ user, date: dateStr });
    attendance.status = 'Bunked';
    await attendance.save();

    const other = user === 'Kanishk' ? 'Anmol' : 'Kanishk';
    const key = `auto-bunk-${user}-${dateStr}`;

    try {
      await PenaltyLog.create({
        user: other,
        fromUser: 'System',
        reason: `${user} Bunked (Auto) on ${dateStr}`,
        points: 100,
        type: 'Penalty',
        uniqueKey: key
      });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
};

/* -------------------- ROUTES -------------------- */

app.get('/api/weeks', async (req, res) => {
  try {
    await connectDB();
    await checkAndProcessAutomaticBunks();
    const weeks = await Week.find().populate('tasks').sort({ startDate: -1 });
    res.json(weeks);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/api/weeks', async (req, res) => {
  try {
    await connectDB();
    const week = await new Week(req.body).save();
    res.status(201).json(week);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    await connectDB();
    const task = await new Task(req.body).save();
    await Week.findByIdAndUpdate(req.body.weekId, { $push: { tasks: task._id } });
    res.status(201).json(task);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.patch('/api/tasks/:id/complete', async (req, res) => {
  try {
    await connectDB();
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const other = task.assignedUser === 'Kanishk' ? 'Anmol' : 'Kanishk';
    const now = new Date();
    const due = new Date(task.dueDate);
    due.setHours(23, 59, 59, 999);

    let reward = 0;
    let status = 'Completed On Time';
    let reason = `${task.assignedUser} completed task on time.`;

    if (now > due) {
      const daysLate = Math.ceil((now - due) / 86400000);
      reward = daysLate * 10;
      status = 'Completed Late';
      reason = `${task.assignedUser} completed task ${daysLate} days late.`;
    }

    task.status = status;
    await task.save();

    await PenaltyLog.create({
      user: reward ? other : task.assignedUser,
      fromUser: 'System',
      reason,
      points: reward,
      type: 'Penalty',
      task: task._id
    });

    res.json(task);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await connectDB();
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Not found' });

    await Week.findByIdAndUpdate(task.week, { $pull: { tasks: task._id } });
    await PenaltyLog.deleteMany({ task: task._id });
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.delete('/api/weeks/:id', async (req, res) => {
  try {
    await connectDB();
    const week = await Week.findById(req.params.id);
    if (!week) return res.status(404).json({ message: 'Not found' });

    await Task.deleteMany({ _id: { $in: week.tasks } });
    await PenaltyLog.deleteMany({ task: { $in: week.tasks } });
    await Week.findByIdAndDelete(req.params.id);
    res.json({ message: 'Wiped' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    await connectDB();
    await checkAndProcessAutomaticBunks();

    const logs = await PenaltyLog.find().sort({ createdAt: -1 });
    const stats = { Kanishk: { points: 0, logs: [] }, Anmol: { points: 0, logs: [] } };

    logs.forEach(l => {
      if (stats[l.user]) {
        stats[l.user].points += l.points;
        stats[l.user].logs.push(l);
      }
    });

    stats.Kanishk.points = Math.max(0, stats.Kanishk.points);
    stats.Anmol.points = Math.max(0, stats.Anmol.points);

    res.json(stats);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* -------------------- EXPORT FOR VERCEL -------------------- */
export default async function handler(req, res) {
  await connectDB();
  return app(req, res);
}
