import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Week, Task, PenaltyLog, Attendance } from '../models.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/study_app';

console.log('--- Database Connection Debug ---');
console.log(`Connecting to: ${MONGODB_URI.split('@')[1] || MONGODB_URI}`); // Log only host part for privacy

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000, // Wait up to 10s for connection
})
.then(() => console.log('✅ MongoDB connected successfully.'))
.catch(err => {
  console.error('❌ MongoDB initial connection error:');
  console.error(err);
  console.error('--------------------------------');
});

mongoose.connection.on('error', err => {
  console.error('🚨 Mongoose runtime error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected from MongoDB Atlas');
});

// Schedule Data
const SCHEDULE = {
  1: { start: "17:00", name: "Monday" },
  2: { start: null, name: "Tuesday" }, 
  3: { start: "17:00", name: "Wednesday" },
  4: { start: "18:30", name: "Thursday" },
  5: { start: "15:00", name: "Friday" },
  6: { start: null, name: "Saturday" }
};

const getLocalDateString = (date) => {
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

const getLocalInfo = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  const dateStr = localDate.toISOString().split('T')[0];
  const dayOfWeek = now.getDay();
  return { now, dateStr, dayOfWeek };
};

const getBalance = async (user) => {
  const logs = await PenaltyLog.find({ user });
  const total = logs.reduce((sum, log) => sum + log.points, 0);
  return Math.max(0, total);
};

const checkAndProcessAutomaticBunks = async () => {
  const { now, dateStr, dayOfWeek } = getLocalInfo();
  const daySched = SCHEDULE[dayOfWeek];

  if (daySched && daySched.start) {
    const [schedH, schedM] = daySched.start.split(':').map(Number);
    const cutoffTime = new Date(now);
    cutoffTime.setHours(schedH, schedM + 100, 0, 0); 

    if (now > cutoffTime) {
      const users = ['Kanishk', 'Anmol'];
      for (const user of users) {
        let attendance = await Attendance.findOne({ user, date: dateStr });
        
        if (!attendance || attendance.status === 'Not Arrived') {
          if (!attendance) attendance = new Attendance({ user, date: dateStr });
          
          attendance.status = 'Bunked';
          await attendance.save();

          const otherUser = user === 'Kanishk' ? 'Anmol' : 'Kanishk';
          const logReason = `${user} Bunked (Auto) on ${dateStr} - 100 pts awarded to ${otherUser}`;
          const bunkUniqueKey = `auto-bunk-${user}-${dateStr}`;

          try {
            await PenaltyLog.create({ 
              user: otherUser, 
              fromUser: 'System', 
              reason: logReason, 
              points: 100, 
              type: 'Penalty',
              uniqueKey: bunkUniqueKey
            });
            console.log(`✅ Processed AUTO-BUNK for ${user} on ${dateStr}`);
          } catch (e) {
            // Ignore duplicate key errors (code 11000)
            if (e.code !== 11000) {
              console.error("Auto-bunk log error:", e);
            }
          }
        }
      }
    }
  }
};

app.get('/api/weeks', async (req, res) => {
  try {
    await checkAndProcessAutomaticBunks();
    const weeks = await Week.find().populate('tasks').sort({ startDate: -1 });
    res.json(weeks);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/weeks', async (req, res) => {
  const { title, startDate } = req.body;
  try {
    const newWeek = new Week({ title, startDate });
    await newWeek.save();
    res.status(201).json(newWeek);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.post('/api/tasks', async (req, res) => {
  const { title, dueDate, assignedUser, weekId } = req.body;
  try {
    const task = new Task({ title, dueDate, assignedUser, week: weekId });
    await task.save();
    await Week.findByIdAndUpdate(weekId, { $push: { tasks: task._id } });
    res.status(201).json(task);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.post('/api/attendance/check-in', async (req, res) => {
  const { user } = req.body;
  const { now, dateStr, dayOfWeek } = getLocalInfo();
  const daySched = SCHEDULE[dayOfWeek];
  const otherUser = user === 'Kanishk' ? 'Anmol' : 'Kanishk';
  
  try {
    await checkAndProcessAutomaticBunks();
    let attendance = await Attendance.findOne({ user, date: dateStr });
    if (attendance && attendance.status !== 'Not Arrived') return res.status(400).json({ message: `Attendance is ${attendance.status}.` });

    let minsLate = 0;
    let logReason = "";
    let pointsToAward = 0;

    if (daySched && daySched.start) {
      const [schedH, schedM] = daySched.start.split(':').map(Number);
      const schedTime = new Date(now);
      schedTime.setHours(schedH, schedM, 0, 0);

      if (now > schedTime) {
        minsLate = Math.floor((now - schedTime) / (1000 * 60));
        pointsToAward = minsLate;
        logReason = `${user} arrived ${minsLate} mins late. Points awarded to ${otherUser}.`;
      } else {
        logReason = `${user} arrived on time.`;
      }
    } else {
      logReason = `${user} logged an extra session (Break Day)`;
    }

    if (!attendance) attendance = new Attendance({ user, date: dateStr });
    attendance.arrivalTime = now;
    attendance.status = 'Present';
    attendance.penaltyPoints = minsLate;
    await attendance.save();

    await PenaltyLog.create({
      user: pointsToAward > 0 ? otherUser : user,
      fromUser: 'System',
      reason: logReason,
      points: pointsToAward,
      type: 'Penalty'
    });

    res.json(attendance);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/attendance/bunk', async (req, res) => {
  const { user } = req.body;
  const { dateStr } = getLocalInfo();
  const otherUser = user === 'Kanishk' ? 'Anmol' : 'Kanishk';
  try {
    let attendance = await Attendance.findOne({ user, date: dateStr });
    if (attendance && attendance.status !== 'Not Arrived') return res.status(400).json({ message: "Already marked." });
    if (!attendance) attendance = new Attendance({ user, date: dateStr });
    attendance.status = 'Bunked';
    await attendance.save();
    await PenaltyLog.create({ user: otherUser, fromUser: user, reason: `${user} Bunked - 100 pts awarded to ${otherUser}`, points: 100, type: 'Penalty' });
    res.json(attendance);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.patch('/api/tasks/:id/complete', async (req, res) => {
  const { id } = req.params;
  try {
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.status !== 'Pending') return res.status(400).json({ message: 'Done.' });

    const otherUser = task.assignedUser === 'Kanishk' ? 'Anmol' : 'Kanishk';
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(23, 59, 59, 999);

    let status = 'Completed On Time';
    let reward = 0;
    let logReason = `${task.assignedUser} finished task on time.`;

    if (now > dueDate) {
      status = 'Completed Late';
      const diffDays = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
      reward = diffDays * 10;
      logReason = `${task.assignedUser} finished task ${diffDays} days late. 10 pts/day awarded to ${otherUser}.`;
    }

    task.status = status;
    await task.save();
    await PenaltyLog.create({ user: reward > 0 ? otherUser : task.assignedUser, fromUser: 'System', reason: logReason, points: reward, type: 'Penalty', task: task._id });
    res.json(task);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    await Week.findByIdAndUpdate(task.week, { $pull: { tasks: task._id } });
    await PenaltyLog.deleteMany({ task: task._id });
    res.json({ message: 'Deleted' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/weeks/:id', async (req, res) => {
  try {
    const week = await Week.findById(req.params.id);
    await Task.deleteMany({ _id: { $in: week.tasks } });
    await PenaltyLog.deleteMany({ task: { $in: week.tasks } });
    await Week.findByIdAndDelete(req.params.id);
    res.json({ message: 'Wiped' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/redeem', async (req, res) => {
  const { user, points, reason } = req.body;
  try {
    const currentBalance = await getBalance(user);
    if (currentBalance < Math.abs(points)) return res.status(400).json({ message: 'Insufficient balance' });
    const log = new PenaltyLog({ user, fromUser: user, reason, points: -Math.abs(points), type: 'Redemption' });
    await log.save();
    res.status(201).json(log);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.get('/api/attendance/today', async (req, res) => {
  const { dateStr } = getLocalInfo();
  try {
    await checkAndProcessAutomaticBunks();
    const records = await Attendance.find({ date: dateStr });
    res.json(records);
  } catch (error) { res.status(500).json(error); }
});

app.get('/api/stats', async (req, res) => {
  try {
    await checkAndProcessAutomaticBunks();
    const logs = await PenaltyLog.find().sort({ createdAt: -1 });
    const stats = { Kanishk: { points: 0, logs: [] }, Anmol: { points: 0, logs: [] } };
    logs.forEach(log => { if (stats[log.user]) { stats[log.user].points += log.points; stats[log.user].logs.push(log); } });
    stats.Kanishk.points = Math.max(0, stats.Kanishk.points);
    stats.Anmol.points = Math.max(0, stats.Anmol.points);
    res.json(stats);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

export default app;
