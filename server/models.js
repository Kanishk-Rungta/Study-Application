import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  dueDate: { type: Date, required: true },
  assignedUser: { type: String, enum: ['Kanishk', 'Anmol'], required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Completed On Time', 'Completed Late', 'Missed'], 
    default: 'Pending' 
  },
  week: { type: mongoose.Schema.Types.ObjectId, ref: 'Week' }
}, { timestamps: true });

const weekSchema = new mongoose.Schema({
  title: { type: String, required: true },
  startDate: { type: Date, required: true },
  tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }]
}, { timestamps: true });

const penaltyLogSchema = new mongoose.Schema({
  user: { type: String, enum: ['Kanishk', 'Anmol'], required: true },
  fromUser: { type: String, enum: ['Kanishk', 'Anmol', 'System'], required: true },
  reason: { type: String, required: true },
  points: { type: Number, required: true },
  type: { type: String, enum: ['Penalty', 'Redemption'], default: 'Penalty' },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  uniqueKey: { type: String, unique: true, sparse: true } // Prevents duplicates for auto-events
}, { timestamps: true });

const attendanceSchema = new mongoose.Schema({
  user: { type: String, enum: ['Kanishk', 'Anmol'], required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  arrivalTime: { type: Date },
  status: { type: String, enum: ['Present', 'Bunked', 'Not Arrived'], default: 'Not Arrived' },
  penaltyPoints: { type: Number, default: 0 }
}, { timestamps: true });

export const Task = mongoose.model('Task', taskSchema);
export const Week = mongoose.model('Week', weekSchema);
export const PenaltyLog = mongoose.model('PenaltyLog', penaltyLogSchema);
export const Attendance = mongoose.model('Attendance', attendanceSchema);
