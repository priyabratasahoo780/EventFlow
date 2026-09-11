import { Event } from '../models/Event';
import { getDepartureSuggestion, DepartureSuggestion } from './travelService';

export interface PriorityInfo {
  score: number;
  level: 'Critical' | 'High' | 'Medium' | 'Low';
  color: string;
  badge: string;
}

export const priorityService = {
  calculateScore(task: Event, userLocation?: { latitude: number; longitude: number } | null): number {
    let score = 0;

    // 1. Importance Score
    const importanceMap: Record<string, number> = {
      critical: 40,
      high: 30,
      medium: 20,
      low: 10
    };
    score += importanceMap[task.priority?.toLowerCase() || 'medium'] || 20;

    // Deadline date calculation
    const dateStr = task.date ? task.date.split('T')[0] : new Date().toISOString().split('T')[0];
    const timeStr = task.time || '23:59';
    const deadline = new Date(`${dateStr}T${timeStr.length <= 5 ? timeStr + ':00' : timeStr}`);
    const now = new Date();

    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // 2. Overdue Check
    if (diffHours < 0 && !task.completed && task.status !== 'completed') {
      score += 45;
    } else {
      // 3. Urgency Score
      if (diffHours <= 2) score += 50;
      else if (diffHours <= 6) score += 35;
      else if (diffHours <= 12) score += 25;
      else if (diffHours <= 24) score += 15;
      else if (diffHours <= 72) score += 10;
      else score += 5;

      // 4. Duration Risk
      const durationHours = (task.estimatedDuration || 30) / 60;
      if (durationHours > diffHours) {
        score += 30;
      }
    }

    // 5. In Progress Status Bonus
    if (task.status === 'in_progress') {
      score += 15;
    }

    // 6. Location Relevance (proximity)
    if (userLocation && task.locationDetails?.latitude && task.locationDetails?.longitude) {
      const dist = this.getDistance(
        userLocation.latitude,
        userLocation.longitude,
        task.locationDetails.latitude,
        task.locationDetails.longitude
      );
      if (dist <= 500) {
        score += 25;
      }

      // 7. Travel Urgency: if you need to leave soon, boost priority
      if (userLocation && task.locationDetails?.latitude) {
        const suggestion = getDepartureSuggestion(task, userLocation.latitude, userLocation.longitude);
        if (suggestion) {
          if (suggestion.isMissed) score += 20;           // Already should have left
          else if (suggestion.isUrgent) score += 15;      // Need to leave in < 15 min
          else if (suggestion.leaveInMins < 30) score += 8; // Leave within 30 min
        }
      }
    }

    // 8. Category Relevance Bonus
    const highFocusCategories = ['Academic', 'Work', 'Interview', 'Hackathon'];
    if (highFocusCategories.includes(task.category)) {
      score += 5;
    }

    return Math.round(score);
  },

  getPriorityInfo(score: number): PriorityInfo {
    if (score >= 70) return { score, level: 'Critical', color: '#EF4444', badge: '🔴' };
    if (score >= 50) return { score, level: 'High', color: '#F97316', badge: '🟠' };
    if (score >= 30) return { score, level: 'Medium', color: '#EAB308', badge: '🟡' };
    return { score, level: 'Low', color: '#22C55E', badge: '🟢' };
  },

  getRecommendation(tasks: Event[], userLocation?: { latitude: number; longitude: number } | null): Event | null {
    const pending = tasks.filter(t => !t.completed && t.status !== 'completed' && t.status !== 'cancelled');
    if (pending.length === 0) return null;

    const scored = pending.map(t => ({
      task: t,
      score: this.calculateScore(t, userLocation)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].task;
  },

  /** Get departure suggestion for a task given user location */
  getDeparture(task: Event, userLocation?: { latitude: number; longitude: number } | null): DepartureSuggestion | null {
    if (!userLocation) return null;
    return getDepartureSuggestion(task, userLocation.latitude, userLocation.longitude);
  },

  getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
};
