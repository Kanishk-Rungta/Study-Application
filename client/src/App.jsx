import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Modal, ProgressBar, Badge, ListGroup, Toast, ToastContainer } from 'react-bootstrap';
import { 
  User, CheckCircle, Clock, XCircle, Plus, LayoutDashboard, 
  History, TrendingUp, BookOpen, Users, Award, Coffee, 
  Target, Zap, Calendar, LogOut, ChevronRight, Flame, Snowflake, 
  Gift, ArrowRightLeft, CreditCard, Trash2, MapPin, AlertCircle, Bell, AlertTriangle,
  Star, Rocket, Orbit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getWeeks, createWeek, createTask, completeTask, 
  getStats, redeemPoints, deleteTask, deleteWeek,
  checkIn, bunk, getTodayAttendance
} from './api';
import './App.css';

const SCHEDULE = [
  { day: "Monday", time: "5:00 PM - 8:00 PM", h: 17, m: 0 },
  { day: "Tuesday", time: "Break", h: null, m: null },
  { day: "Wednesday", time: "5:00 PM - 8:00 PM", h: 17, m: 0 },
  { day: "Thursday", time: "6:30 PM - 8:00 PM", h: 18, m: 30 },
  { day: "Friday", time: "3:00 PM - 8:00 PM", h: 15, m: 0 }
];

const StarField = () => (
  <div className="star-field">
    {[...Array(40)].map((_, i) => (
      <motion.div
        key={i}
        className="position-absolute bg-white rounded-circle"
        style={{ width: Math.random() * 2 + 1, height: Math.random() * 2 + 1, top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%` }}
        animate={{ opacity: [0.1, 0.8, 0.1], scale: [1, 1.2, 1] }}
        transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 5 }}
      />
    ))}
  </div>
);

const IdentitySelector = ({ onSelect }) => {
  return (
    <div className="identity-selector">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center position-relative" style={{ zIndex: 3 }}>
        <h1 className="display-4 fw-bold mb-2 neon-white-glow">Study Buddy</h1>
        <p className="subtitle-fire-ice mb-5">FIRE MEETS ICE</p>
        <div className="selector-grid">
          <motion.div onClick={() => onSelect('Anmol')} className="identity-pane fire" whileHover={{ scale: 1.05 }}>
            <Flame size={80} className="text-fire mb-4" />
            <h2 className="name-gradient-fire">Anmol</h2>
            <p className="desc-fire">The Burning Passion. Master of drive and energy.</p>
            <div className="mt-4 badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 px-3 py-2">FIRE ELEMENT</div>
          </motion.div>
          <motion.div onClick={() => onSelect('Kanishk')} className="identity-pane ice" whileHover={{ scale: 1.05 }}>
            <Snowflake size={80} className="text-ice mb-4" />
            <h2 className="name-gradient-ice">Kanishk</h2>
            <p className="desc-ice">The Cold Strategist. Master of focus and precision.</p>
            <div className="mt-4 badge bg-info bg-opacity-25 text-info border border-info border-opacity-25 px-3 py-2">ICE ELEMENT</div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

const TaskCard = ({ task, onComplete, onDelete, currentIdentity }) => {
  const isIceUser = task.assignedUser === 'Kanishk';
  const canUpdate = task.assignedUser === currentIdentity;

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className={`mb-3 border-0 task-card ${isIceUser ? 'ice-task' : 'fire-task'}`}>
        <Card.Body className="d-flex justify-content-between align-items-center py-3">
          <div className="d-flex align-items-center gap-3">
            <div className={`p-2 rounded-circle bg-${isIceUser ? 'info' : 'danger'} bg-opacity-10 text-${isIceUser ? 'info' : 'danger'}`}>
              {isIceUser ? <Snowflake size={18} /> : <Flame size={18} />}
            </div>
            <div>
              <h6 className={`mb-0 fw-bold text-white ${task.status !== 'Pending' ? 'text-decoration-line-through opacity-50' : ''}`}>{task.title}</h6>
              <small className="text-muted d-flex align-items-center gap-2">
                <Calendar size={12} /> Due: {new Date(task.dueDate).toLocaleDateString()}
              </small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {task.status === 'Pending' ? (
              canUpdate && <Button variant={isIceUser ? 'info' : 'danger'} size="sm" className="rounded-pill px-3 fw-bold shadow-sm" onClick={() => onComplete(task._id)}>Complete</Button>
            ) : (
              <Badge bg={task.status === 'Completed On Time' ? 'success' : 'warning'} className="rounded-pill px-3 shadow-sm">{task.status}</Badge>
            )}
            {canUpdate && (
              <Button variant="link" className="text-danger p-1 ms-1 opacity-50 hover-opacity-100" onClick={() => onDelete(task._id, task.title)}>
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </motion.div>
  );
};

function App() {
  const [identity, setIdentity] = useState(localStorage.getItem('user_identity'));
  const [weeks, setWeeks] = useState([]);
  const [stats, setStats] = useState({ Kanishk: { points: 0, logs: [] }, Anmol: { points: 0, logs: [] } });
  const [attendance, setAttendance] = useState([]);
  const [showAddWeek, setShowAddWeek] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmConfig, setConfirmData] = useState({ title: '', message: '', onConfirm: () => {} });

  const [showToast, setShowToast] = useState(false);
  const [toastConfig, setToastConfig] = useState({ message: '', variant: 'success' });

  const [newWeekTitle, setNewWeekTitle] = useState('');
  const [newWeekStart, setNewWeekStart] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [redeemMoneyAmount, setRedeemMoneyAmount] = useState(0);
  const [redeemReason, setRedeemReason] = useState('');

  useEffect(() => { if (identity) fetchData(); }, [identity]);

  const notify = (message, variant = 'success') => { setToastConfig({ message, variant }); setShowToast(true); };

  const fetchData = async () => {
    try {
      const [w, s, a] = await Promise.all([getWeeks(), getStats(), getTodayAttendance()]);
      setWeeks(w.data); setStats(s.data); setAttendance(a.data);
    } catch (error) { console.error(error); }
  };

  const handleIdentitySelect = (id) => { setIdentity(id); localStorage.setItem('user_identity', id); };

  const handleCreateWeek = async (e) => {
    e.preventDefault();
    try { await createWeek({ title: newWeekTitle, startDate: newWeekStart }); setShowAddWeek(false); notify("Week initialized!"); fetchData(); } catch (error) { notify(error.message, 'danger'); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const now = new Date(); now.setHours(0,0,0,0);
    const selected = new Date(newTaskDue); selected.setHours(0,0,0,0);
    const max = new Date(); max.setDate(max.getDate() + 7); max.setHours(23,59,59,999);

    if (selected < now) return notify("Date must be in the future!", "danger");
    if (selected > max) return notify("Max deadline is 7 days!", "danger");

    try { await createTask({ title: newTaskTitle, dueDate: newTaskDue, assignedUser: identity, weekId: selectedWeek._id }); setShowAddTask(false); notify("Goal Deployed!"); fetchData(); } catch (error) { notify(error.message, 'danger'); }
  };

  const handleCompleteTask = async (taskId) => {
    try { await completeTask(taskId); notify("Goal Achieved!"); fetchData(); } catch (error) { notify(error.message, 'danger'); }
  };

  const handleDeleteTask = (taskId, taskTitle) => {
    setConfirmData({ title: 'Delete Goal', message: `Permanently delete "${taskTitle}"?`, onConfirm: async () => { try { await deleteTask(taskId); notify("Goal Deleted."); fetchData(); } catch (error) { notify(error.message, 'danger'); } } });
    setShowConfirm(true);
  };

  const handleDeleteWeek = (weekId, weekTitle) => {
    setConfirmData({ title: 'Delete Week', message: `Delete "${weekTitle}" and ALL tasks?`, onConfirm: async () => { try { await deleteWeek(weekId); notify("Week Wiped."); fetchData(); } catch (error) { notify(error.message, 'danger'); } } });
    setShowConfirm(true);
  };

  const handleArrived = async () => {
    try { await checkIn(identity); notify("Arrival Confirmed."); fetchData(); } catch (error) { notify(error.response?.data?.message || "Error logging arrival", 'danger'); }
  };

  const handleBunk = () => {
    const other = identity === 'Kanishk' ? 'Anmol' : 'Kanishk';
    setConfirmData({ title: 'Bunk Session', message: `Bunking will award 100 POINTS to ${other}. Are you sure?`, onConfirm: async () => { try { await bunk(identity); notify(`Bunk recorded. 100 pts awarded to ${other}!`, "warning"); fetchData(); } catch (error) { notify(error.message, 'danger'); } } });
    setShowConfirm(true);
  };

  const handleRedeem = async (e) => {
    e.preventDefault();
    const pointsToRedeem = Number(redeemMoneyAmount) * 5;
    const currentPoints = stats[identity]?.points || 0;

    if (pointsToRedeem > currentPoints) {
      return notify(`Insufficient balance! You need ${pointsToRedeem} pts for ₹${redeemMoneyAmount}.`, "danger");
    }

    try { 
      await redeemPoints({ user: identity, points: pointsToRedeem, reason: redeemReason, fromUser: identity }); 
      setShowRedeem(false); setRedeemMoneyAmount(0); setRedeemReason(''); 
      notify(`₹${redeemMoneyAmount} (${pointsToRedeem} pts) Redeemed!`); 
      fetchData(); 
    } catch (error) { 
      notify(error.response?.data?.message || "Error during redemption", 'danger'); 
    }
  };

  const getLogIcon = (log) => {
    if (log.type === 'Redemption') return <Gift size={16} />;
    const r = log.reason.toLowerCase();
    if (r.includes('bunked')) return <AlertTriangle size={16} />;
    if (r.includes('late arrival')) return <Clock size={16} />;
    if (r.includes('completed on time')) return <CheckCircle size={16} />;
    if (r.includes('completed late')) return <Calendar size={16} />;
    return <Zap size={16} />;
  };

  const getLogColor = (log) => {
    if (log.type === 'Redemption') return 'warning';
    const r = log.reason.toLowerCase();
    if (r.includes('bunked')) return 'danger';
    if (r.includes('late arrival')) return 'danger';
    if (r.includes('completed on time')) return 'success';
    if (r.includes('completed late')) return 'warning';
    return 'primary';
  };

  if (!identity) return <IdentitySelector onSelect={handleIdentitySelect} />;

  const isIce = identity === 'Kanishk';
  const todayRecords = { Anmol: attendance.find(r => r.user === 'Anmol'), Kanishk: attendance.find(r => r.user === 'Kanishk') };
  const todayStr = new Date().toISOString().split('T')[0];
  const maxDateLimit = new Date(); maxDateLimit.setDate(maxDateLimit.getDate() + 7);
  const maxDateStr = maxDateLimit.toISOString().split('T')[0];

  return (
    <div className="app-container">
      <StarField />
      <nav className="navbar navbar-expand-lg sticky-top mb-4">
        <Container>
          <div className="navbar-brand d-flex align-items-center text-white fw-bold"><LayoutDashboard className="me-2 text-primary" size={20} /> STUDY BUDDY</div>
          <div className="d-flex align-items-center gap-3">
            <div className={`nav-identity-element ${isIce ? 'nav-identity-ice' : 'nav-identity-fire'}`}>
              {isIce ? <Snowflake size={14} /> : <Flame size={14} />}
              <small className="fw-bold">{identity.toUpperCase()}</small>
            </div>
            <Button variant="link" className="text-white opacity-50 p-0" onClick={() => { localStorage.removeItem('user_identity'); setIdentity(null); }}><LogOut size={18} /></Button>
          </div>
        </Container>
      </nav>

      <Container className="position-relative" style={{ zIndex: 1 }}>
        <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
          <Toast show={showToast} onClose={() => setShowToast(false)} delay={3000} autohide bg={toastConfig.variant} className="border-0 shadow-lg text-white">
            <Toast.Body className="d-flex align-items-center gap-2"><Bell size={18} /> {toastConfig.message}</Toast.Body>
          </Toast>
        </ToastContainer>

        {/* Elemental Balance Cards */}
        <Row className="mb-5 g-4">
          {['Anmol', 'Kanishk'].map(user => {
            const isMe = user === identity;
            const color = user === 'Anmol' ? 'fire' : 'ice';
            return (
              <Col key={user} md={6}>
                <Card className={`border-0 points-card bg-gradient-${color} overflow-hidden shadow-lg`}>
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div><h5 className="text-white opacity-75 mb-0 fw-bold tracking-widest">{user.toUpperCase()}'S BALANCE</h5><h1 className="display-4 fw-bold text-white mb-0">₹{(stats[user]?.points / 5).toFixed(2)}</h1><small className="text-white opacity-50 fw-bold">{stats[user]?.points} POINTS</small></div>
                      <div className="d-flex align-items-center gap-3">
                        {isMe && <motion.button whileHover={{ scale: 1.1, rotate: 15 }} whileTap={{ scale: 0.9 }} className="btn btn-redeem-circle shadow-sm" onClick={() => setShowRedeem(true)}><Gift size={22} /></motion.button>}
                        <div className="bg-white bg-opacity-20 p-3 rounded-circle shadow-lg">{user === 'Anmol' ? <Flame size={36} /> : <Snowflake size={36} />}</div>
                      </div>
                    </div>
                    <ProgressBar now={(stats[user]?.points % 5) * 20} variant="white" className="bg-dark bg-opacity-30" style={{ height: '6px' }} />
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>

        <Row className="mb-5 g-4">
          <Col lg={8}>
            <Card className="border-0 shadow-lg h-100">
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-4"><h5 className="fw-bold m-0 text-white"><Calendar className="me-2 text-primary" /> SESSION ATTENDANCE</h5><Badge bg="primary" className="px-3 py-2 rounded-pill shadow-sm">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Badge></div>
                <Row className="g-4">
                  {['Anmol', 'Kanishk'].map(user => {
                    const rec = todayRecords[user];
                    const isMe = user === identity;
                    const color = user === 'Anmol' ? 'fire' : 'ice';
                    return (
                      <Col key={user} md={6}>
                        <div className={`p-4 rounded-4 attendance-box ${rec?.status === 'Bunked' ? 'border-danger border-opacity-50 bg-danger bg-opacity-10' : ''}`}>
                          <div className="attendance-header-centered w-100">
                            <div className="d-flex align-items-center gap-2">
                              {user === 'Anmol' ? <Flame size={24} className="text-fire" /> : <Snowflake size={24} className="text-ice" />}
                              <h6 className={`m-0 fw-bold text-${color} tracking-widest`}>{user.toUpperCase()}</h6>
                            </div>
                            {rec ? <Badge bg={rec.status === 'Present' ? 'success' : 'danger'} className="rounded-pill px-3 shadow-sm">{rec.status}</Badge> : <Badge bg="secondary" className="rounded-pill px-3 opacity-50">Waiting...</Badge>}
                          </div>
                          
                          {rec ? (
                            <div className="mt-2">
                              {rec.status === 'Present' ? (
                                <p className="mb-0 small fw-bold text-white">
                                  <Clock size={14} className="me-1" /> {new Date(rec.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              ) : (
                                <p className="mb-0 small fw-bold text-danger">
                                  <AlertCircle size={14} className="me-1" /> MISSED
                                </p>
                              )}
                              {rec.penaltyPoints > 0 && <div className="text-danger fw-bold mt-1 small">Penalty: -{rec.penaltyPoints} pts</div>}
                            </div>
                          ) : (
                            (() => {
                              const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                              const dayName = days[new Date().getDay()];
                              const todaySched = SCHEDULE.find(s => s.day === dayName);
                              const isBreakDay = !todaySched || todaySched.time === "Break";

                              if (isBreakDay) return <div className="mt-2 py-2 px-3 bg-white bg-opacity-5 rounded-pill border border-info border-opacity-25"><small className="fw-bold text-info tracking-wider uppercase">BREAK DAY</small></div>;
                              return isMe ? (
                                <div className="d-flex flex-column gap-2 mt-3 w-100 px-3">
                                  <Button variant="success" className="fw-bold shadow-lg py-2" onClick={handleArrived}>ARRIVED</Button>
                                  <Button variant="outline-danger" size="sm" className="fw-bold border-2" onClick={handleBunk}>BUNK</Button>
                                </div>
                              ) : (
                                <p className="text-muted small mt-3 italic">Waiting...</p>
                              );
                            })()
                          )}
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={4}>
            <Card className="border-0 shadow-lg h-100 schedule-card"><Card.Body className="p-4"><h5 className="fw-bold mb-4 text-center border-bottom border-white border-opacity-10 pb-3 text-white tracking-widest">SCHEDULE</h5>{SCHEDULE.map(s => {
              const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
              const todayName = days[new Date().getDay()];
              return (
                <div key={s.day} className={`d-flex justify-content-between schedule-item ${todayName === s.day ? 'active' : ''}`}>
                  <span>{s.day}</span>
                  <span>{s.time}</span>
                </div>
              );
            })}</Card.Body></Card>
          </Col>
        </Row>

        <Row className="mb-5">
          <Col lg={8}>
            <div className="d-flex justify-content-between align-items-center mb-4"><h3 className="fw-bold m-0 text-white neon-white-glow" style={{ fontSize: '1.5rem' }}>Weekly Goals</h3><Button variant="primary" className="shadow-lg px-4 fw-bold border-0" onClick={() => setShowAddWeek(true)}><Plus size={20} /> NEW WEEK</Button></div>
            <AnimatePresence>{weeks.slice().reverse().map((week) => (
              <motion.div key={week._id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mb-5 shadow-2xl"><Card className="border-0 overflow-hidden"><div className="p-4 week-panel-header d-flex justify-content-between align-items-center"><div className="d-flex align-items-center gap-3"><div><h4 className="mb-1 fw-bold week-title-gradient">{week.title}</h4><small className="text-white d-block fw-bold text-uppercase opacity-75">START: {new Date(week.startDate).toLocaleDateString()}</small></div><Button variant="link" className="text-danger p-0 opacity-50 hover-opacity-100" onClick={() => handleDeleteWeek(week._id, week.title)}><Trash2 size={18} /></Button></div><Button variant="outline-primary" size="sm" className="fw-bold border-2" onClick={() => { setSelectedWeek(week); setShowAddTask(true); }}>ADD GOAL</Button></div><Card.Body className="p-4"><Row className="g-4">{['Anmol', 'Kanishk'].map(user => (<Col key={user} lg={6}><div className="goal-container h-100"><h6 className={`fw-bold mb-3 text-${user === 'Anmol' ? 'fire' : 'ice'} tracking-widest`}>{user.toUpperCase()}'S TASKS</h6>{week.tasks.filter(t => t.assignedUser === user).map(task => (<TaskCard key={task._id} task={task} onComplete={handleCompleteTask} onDelete={handleDeleteTask} currentIdentity={identity} />))}</div></Col>))}</Row></Card.Body></Card></motion.div>
            ))}</AnimatePresence>
          </Col>
          <Col lg={4}>
            <Card className="border-0 shadow-lg h-100"><div className="p-4 border-bottom border-white border-opacity-10 d-flex justify-content-between align-items-center"><h5 className="fw-bold mb-0 text-white tracking-widest">GLOBAL LOG</h5><History size={20} className="text-primary" /></div><div className="custom-scroll p-0" style={{ maxHeight: '650px', overflowY: 'auto' }}><ListGroup variant="flush">{Object.values(stats).flatMap(s => s.logs).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map((log, i) => (<ListGroup.Item key={i} className="bg-transparent log-item border-0"><div className="d-flex gap-3">
                        <div className={`log-icon-circle bg-opacity-10 bg-${getLogColor(log)} text-${getLogColor(log)}`}>{getLogIcon(log)}</div>
                        <div className="w-100">
                          <div className="d-flex justify-content-between"><span className={`fw-bold small ${log.user === 'Anmol' ? 'text-fire' : 'text-ice'}`}>{log.user}</span><span className="small text-muted">{new Date(log.createdAt).toLocaleDateString()}</span></div>
                          <div className="text-white small opacity-75 fw-medium">{log.reason}</div>
                          <Badge bg={log.points > 0 ? 'success' : log.points < 0 ? 'danger' : 'secondary'} className="mt-1 shadow-sm">{log.points > 0 ? '+' : ''}{log.points} pts</Badge>
                        </div>
                      </div>
                    </ListGroup.Item>))}</ListGroup></div></Card>
          </Col>
        </Row>
      </Container>

      {/* Modals */}
      <Modal show={showAddWeek} onHide={() => setShowAddWeek(false)} centered contentClassName="modal-content"><Modal.Header closeButton className="border-0"><Modal.Title className="fw-bold text-white tracking-widest neon-white-glow">PLAN NEW WEEK</Modal.Title></Modal.Header><Form onSubmit={handleCreateWeek}><Modal.Body><Form.Group className="mb-4"><Form.Label className="text-white small fw-bold">TITLE</Form.Label><Form.Control type="text" placeholder="e.g. Final Exams Grind" className="modal-white-input" required onChange={(e) => setNewWeekTitle(e.target.value)} /></Form.Group><Form.Group className="mb-3"><Form.Label className="text-white small fw-bold">START DATE</Form.Label><Form.Control type="date" className="modal-white-input" required onChange={(e) => setNewWeekStart(e.target.value)} /></Form.Group></Modal.Body><Modal.Footer className="border-0"><Button variant="primary" type="submit" className="w-100 fw-bold py-3 shadow-lg">INITIALIZE WEEK</Button></Modal.Footer></Form></Modal>
      <Modal show={showAddTask} onHide={() => setShowAddTask(false)} centered contentClassName="modal-content"><Modal.Header closeButton className="border-0"><Modal.Title className="fw-bold text-white tracking-widest">NEW GOAL</Modal.Title></Modal.Header><Form onSubmit={handleCreateTask}><Modal.Body><div className={`${identity === 'Anmol' ? 'bg-anmol-orange text-anmol-orange' : 'bg-info bg-opacity-10 text-info'} p-3 rounded-3 mb-4 text-center fw-bold small`}>GOAL FOR {identity?.toUpperCase()}</div><Form.Group className="mb-4"><Form.Label className="text-white small fw-bold">DESCRIPTION</Form.Label><Form.Control type="text" placeholder="Scanning targets..." className="modal-white-input" required onChange={(e) => setNewTaskTitle(e.target.value)} /></Form.Group><Form.Group className="mb-4"><Form.Label className="text-white small fw-bold">DUE DATE (MAX 7 DAYS)</Form.Label><Form.Control type="date" required min={todayStr} max={maxDateStr} className="modal-white-input" onChange={(e) => setNewTaskDue(e.target.value)} /><Form.Text className="text-white opacity-50 small">Max deadline: {new Date(maxDateLimit).toLocaleDateString()}</Form.Text></Form.Group></Modal.Body><Modal.Footer className="border-0"><Button variant="primary" type="submit" className="w-100 fw-bold py-3 shadow-lg">DEPLOY TASK</Button></Modal.Footer></Form></Modal>
      <Modal show={showRedeem} onHide={() => setShowRedeem(false)} centered contentClassName="modal-content"><Modal.Header closeButton className="border-0"><Modal.Title className="fw-bold d-flex align-items-center gap-2 text-white tracking-widest"><Gift style={{ color: '#ff0000', filter: 'drop-shadow(0 0 8px #ff0000)' }} /> REDEEM MONEY</Modal.Title></Modal.Header><Form onSubmit={handleRedeem}><Modal.Body><div className="bg-warning bg-opacity-10 p-3 rounded-3 mb-4 text-center text-warning fw-bold small">CONVERTING BALANCE TO RUPEES</div><Form.Group className="mb-4"><Form.Label className="text-white small fw-bold">AMOUNT IN ₹ (₹1 = 5 PTS)</Form.Label><Form.Control type="number" required min="1" step="0.01" placeholder="₹ Amount" className="modal-white-input" onChange={(e) => setRedeemMoneyAmount(e.target.value)} /><Form.Text className="text-white opacity-50">Available: ₹{(stats[identity]?.points / 5).toFixed(2)}</Form.Text></Form.Group><Form.Group className="mb-3"><Form.Label className="text-white small fw-bold">GIFT / REASON</Form.Label><Form.Control type="text" placeholder="e.g. Ordered a treat" className="modal-white-input" required onChange={(e) => setRedeemReason(e.target.value)} /></Form.Group></Modal.Body><Modal.Footer className="border-0"><Button variant="warning" type="submit" className="w-100 fw-bold py-3 shadow-lg text-dark">AUTHORIZE ₹{redeemMoneyAmount} REDEMPTION</Button></Modal.Footer></Form></Modal>
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered contentClassName="modal-content shadow-lg border-0"><Modal.Header closeButton className="border-0"><Modal.Title className="fw-bold text-danger d-flex align-items-center gap-2 tracking-widest"><Trash2 size={24} /> {confirmConfig.title}</Modal.Title></Modal.Header><Modal.Body className="py-2"><p className="mb-0 fs-5 text-white">{confirmConfig.message}</p><p className="text-white opacity-50 small mt-2">Action is permanent.</p></Modal.Body><Modal.Footer className="border-0 gap-2"><Button variant="outline-secondary" className="fw-bold px-4 rounded-pill text-white border-white opacity-75" onClick={() => setShowConfirm(false)}>Cancel</Button><Button variant="danger" className="fw-bold px-4 rounded-pill shadow-sm" onClick={() => { confirmConfig.onConfirm(); setShowConfirm(false); }}>Confirm</Button></Modal.Footer></Modal>
    </div>
  );
}

export default App;