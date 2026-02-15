import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

export const getWeeks = () => api.get('/weeks');
export const createWeek = (data) => api.post('/weeks', data);
export const createTask = (data) => api.post('/tasks', data);
export const completeTask = (id) => api.patch(`/tasks/${id}/complete`);
export const getStats = () => api.get('/stats');
export const redeemPoints = (data) => api.post('/redeem', data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const deleteWeek = (id) => api.delete(`/weeks/${id}`);
export const checkIn = (user) => api.post('/attendance/check-in', { user });
export const bunk = (user) => api.post('/attendance/bunk', { user });
export const getTodayAttendance = () => api.get('/attendance/today');

export default api;
