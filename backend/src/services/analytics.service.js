  // FocusFlow Analytics Service
 

function generateAnalytics(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed || t.status === 'completed' || t.status === 'late_completed').length;
  const lateCompleted = tasks.filter(t => t.status === 'late_completed').length;
  const pending = tasks.filter(t => !t.completed && t.status !== 'completed' && t.status !== 'late_completed' && t.status !== 'overdue').length;
  
  const now = new Date();
  const overdue = tasks.filter(t => {
    if (t.completed || t.status === 'completed' || t.status === 'late_completed') return false;
    const dateStr = t.date ? t.date.split('T')[0] : '';
    const timeStr = t.time || '23:59';
    if (!dateStr) return false;
    const deadline = new Date(`${dateStr}T${timeStr.length <= 5 ? timeStr + ':00' : timeStr}`);
    return deadline < now;
  }).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Calculate total focus time in minutes from completed / in_progress tasks
  let totalFocusMinutes = 0;
  tasks.forEach(t => {
    if (t.completed && t.startedAt && t.completedAt) {
      const diffMs = new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime();
      totalFocusMinutes += Math.max(0, Math.round(diffMs / (1000 * 60)));
    } else if (t.completed) {
      totalFocusMinutes += (t.estimatedDuration || 30);
    }
  });

  // Category distribution
  const categories = {};
  tasks.forEach(t => {
    const cat = t.category || 'Other';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  // Priority distribution
  const priorities = { critical: 0, high: 0, medium: 0, low: 0 };
  tasks.forEach(t => {
    const prio = (t.priority || 'medium').toLowerCase();
    if (priorities[prio] !== undefined) {
      priorities[prio]++;
    }
  });

  return {
    total,
    completed,
    lateCompleted,
    pending,
    overdue,
    completionRate,
    focusTimeHours: (totalFocusMinutes / 60).toFixed(1),
    focusTimeMinutes: totalFocusMinutes,
    categories,
    priorities
  };
}

module.exports = {
  generateAnalytics
};
