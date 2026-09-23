const Event = require('../models/Event');
const { generateAnalytics } = require('../services/analytics.service');

exports.getDashboardAnalytics = async (req, res) => {
  try {
    const tasks = await Event.find({ ownerId: req.userId }).lean();
    const analytics = generateAnalytics(tasks);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getWeeklyAnalytics = async (req, res) => {
  try {
    const tasks = await Event.find({ ownerId: req.userId }).lean();
    const taskObjs = tasks;
    
    // Group tasks by day of week
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = days.map(day => ({ day, completed: 0, created: 0 }));

    taskObjs.forEach(t => {
      if (t.createdAt) {
        const dayIdx = new Date(t.createdAt).getDay();
        weeklyData[dayIdx].created++;
      }
      if (t.completed && t.completedAt) {
        const dayIdx = new Date(t.completedAt).getDay();
        weeklyData[dayIdx].completed++;
      }
    });

    res.json(weeklyData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCategoriesAnalytics = async (req, res) => {
  try {
    const tasks = await Event.find({ ownerId: req.userId }).lean();
    const categoryDistribution = {};

    tasks.forEach(t => {
      const cat = t.category || 'Other';
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    });

    res.json(categoryDistribution);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
