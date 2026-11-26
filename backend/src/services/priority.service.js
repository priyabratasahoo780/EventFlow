  // Dynamic priority score calculation based on urgency, risk, and context.

function calculatePriorityScore(task, userLocation = null) {
  let score = 0;

  // 1. Importance Score
  const importanceMap = {
    critical: 40,
    high: 30,
    medium: 20,
    low: 10
  };
  score += importanceMap[task.priority?.toLowerCase()] || 20;

  // Calculate deadline date object
  const dateStr = task.date ? task.date.split('T')[0] : new Date().toISOString().split('T')[0];
  const timeStr = task.time || '23:59';
  const deadline = new Date(`${dateStr}T${timeStr.length <= 5 ? timeStr + ':00' : timeStr}`);
  const now = new Date();

  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // 2. Overdue Check
  if (diffHours < 0 && task.status !== 'completed') {
    score += 45; // Overdue Penalty / Priority Boost to draw immediate action
  } else {
    // 3. Urgency Score (hours until deadline)
    if (diffHours <= 2) score += 50;
    else if (diffHours <= 6) score += 35;
    else if (diffHours <= 12) score += 25;
    else if (diffHours <= 24) score += 15;
    else if (diffHours <= 72) score += 10;
    else score += 5;

    // 4. Deadline Risk (If estimated duration in hours exceeds remaining time)
    const durationHours = (task.estimatedDuration || 30) / 60;
    if (durationHours > diffHours) {
      score += 30; // High risk of missing deadline
    }
  }

  // 5. In Progress Status Bonus (Keep user focused on task they already started)
  if (task.status === 'in_progress') {
    score += 15;
  }

  // 6. Location Relevance (If user coordinates are within 500m of task location)
  if (userLocation && task.locationDetails && task.locationDetails.latitude && task.locationDetails.longitude) {
    const distMeters = getHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      task.locationDetails.latitude,
      task.locationDetails.longitude
    );
    if (distMeters <= 500) {
      score += 25;
    }
  }

  // 7. Category Relevance Bonus
  const highFocusCategories = ['Academic', 'Work', 'Interview', 'Hackathon'];
  if (highFocusCategories.includes(task.category)) {
    score += 5;
  }

  return Math.round(score);
}

function getPriorityLevel(score) {
  if (score >= 70) return { level: 'Critical', color: '#EF4444', badge: '🔴' };
  if (score >= 50) return { level: 'High', color: '#F97316', badge: '🟠' };
  if (score >= 30) return { level: 'Medium', color: '#EAB308', badge: '🟡' };
  return { level: 'Low', color: '#22C55E', badge: '🟢' };
}

// Distance helper in meters
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  calculatePriorityScore,
  getPriorityLevel
};
