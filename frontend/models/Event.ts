export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'late_completed' | 'overdue' | 'cancelled' | 'pending_exit';
export type ReminderType = 'before' | 'exact' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface LocationTimeGate {
  startHour: number;   
  endHour: number;     
  days: string[];     
}


export interface LocationDetails {
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface LinkedContact {
  name: string;
  phone?: string;
  email?: string;
}


export interface ReminderConfig {
  id: string; 
  type: ReminderType;
  
  value?: number; 
  unit?: 'minutes' | 'hours' | 'days' | 'weeks'; 

  time?: string; 

  date?: string; 

  days?: string[]; 

  dayOfMonth?: number; 

  notificationPreference?: 'banner_sound' | 'banner_only' | 'silent';
  alarmPreference?: 'notification' | 'alarm' | 'both';
  snooze?: number; 
  sound?: 'default' | 'silent' | 'custom';
  vibration?: boolean; 

 
  notificationIds?: string[];
}

export interface EventOwner {
  _id?: string;
  name?: string;
  username?: string;
  profilePhoto?: string;
  uniqueId?: string;
}

export interface Event {
  id: string;
  _id?: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  priorityScore?: number;
  estimatedDuration?: number; 
  status: TaskStatus;
  date: string; 
  time: string; 
  isAllDay?: boolean;
  
  reminders: ReminderConfig[];
  
  color: string;
  icon: string;
  notes: string;
  location: string;
  locationDetails?: LocationDetails;
  image?: string;
  video?: string;
  linkedContact?: LinkedContact;
  completed: boolean;
  locationReminderEnabled?: boolean;
  geofenceRadius?: number;
  triggerType?: 'arrive' | 'leave';
  locationReminderTriggered?: boolean;
  checklist?: ChecklistItem[];

  locationTimeGate?: LocationTimeGate;


  pendingExitGeofenceId?: string;

  isCritical?: boolean;


  
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;

  ownerId?: string | EventOwner;
  visibility?: 'onlyMe' | 'friends' | 'selectedFriends';
  sharedWith?: string[];
  isArchived?: boolean;
  archivedAt?: string;
}

export interface EventFilters {
  searchQuery: string;
  category: string;
  status: 'all' | 'today' | 'pending' | 'in_progress' | 'completed' | 'overdue';
  timeframe: 'all' | 'today' | 'tomorrow' | 'this_week' | 'this_month';
  priority: 'all' | 'critical' | 'high' | 'medium' | 'low';
}
