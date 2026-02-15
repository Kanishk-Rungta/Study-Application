import express from 'express';
import cors from 'cors';
import { Week, Task, PenaltyLog, Attendance } from '../models.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

/* ---------------- SCHEDULE & HELPERS ---------------- */

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
  return {
    now,
    dateStr: localDate.toISOString().split('T')[0],
    dayOfWeek: now.getDay()
  };
};

const getBalance = async (user) => {
  const logs = await PenaltyLog.find({ user });
  return Math.max(0, logs.reduce((s, l) => s + l.points, 0));
};

const checkAndProcessAutomaticBunks = async () => {
  const { now, dateStr, dayOfWeek } = getLocalInfo();
  const daySched = SCHEDULE[dayOfWeek];
  if (!daySched?.start) return;

  const [h, m] = daySched.start.split(':').map(Number);
  const cutoff = new Date(now);
  cutoff.setHours(h, m + 100, 0, 0);

  if (now <= cutoff) return;

  const users = ['Kanishk', 'Anmol'];

  for (const user of users) {
    let attendance = await Attendance.findOne({ user, date: dateStr });
    if (attendance && attendance.status !== 'Not Arrived') continue;

    if (!attendance) attendance = new Attendance({ user, date: dateStr });
    attendance.status = 'Bunked';
    await attendance.save();

    const other = user === 'Kanishk' ? 'Anmol' : 'Kanishk';

    try {
      await PenaltyLog.create({
        user: other,
        fromUser: 'System',
        reason: `${user} bunked (auto)`,
        points: 100,
        type: 'Penalty',
        uniqueKey: `auto-${user}-${dateStr}`
      });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
};

/* ---------------- ROUTES ---------------- */

app.get('/api/weeks', async (req, res) => {
  try {
    await checkAndProcessAutomaticBunks();
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
    await Week.findByIdAndUpdate(req.body.weekId, { $push: { tasks: task._id } });
    res.status(201).json(task);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/attendance/today', async (req, res) => {
  try {
    await checkAndProcessAutomaticBunks();
    const { dateStr } = getLocalInfo();
    res.json(await Attendance.find({ date: dateStr }));
  } catch (e) {
    res.status(500).json(e);
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const logs = await PenaltyLog.find();
    const stats = { Kanishk: 0, Anmol: 0 };
    logs.forEach(l => stats[l.user] += l.points);
    res.json(stats);
  } catch (e) {
    res.status(500).json(e);
  }
});

export default app;
