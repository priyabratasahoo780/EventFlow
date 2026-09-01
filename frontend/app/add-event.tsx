import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import React, { useState, useMemo } from 'react';
import { 
  StyleSheet, ScrollView, View, Text, Pressable, Platform, 
  TextInput, KeyboardAvoidingView, ToastAndroid, Modal, Switch, Animated, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEventStore } from '../store/useEventStore';
import { Event, Priority, ReminderConfig, ReminderType } from '../models/Event';
import { Colors } from '../constants/Colors';

import BrutalCard from '../components/BrutalCard';
import BrutalButton from '../components/BrutalButton';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, subMinutes, subHours, subDays, subWeeks } from 'date-fns';
import { 
  Calendar as CalendarIcon, Clock, Tag, Flag, 
  AlignLeft, Bell, ChevronLeft, Type,
  X, Check, Plus, Globe, Lock, Users,
  GraduationCap, Briefcase, User, Stethoscope, Mic,
  Rocket, Activity, ShoppingCart, Zap, Layers
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

import LocationSelector from '../components/LocationSelector';
import MediaPicker from '../components/MediaPicker';
import ContactSelector from '../components/ContactSelector';
import { LocationDetails, LinkedContact, TaskStatus } from '../models/Event';

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(50, 'Title is too long'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  estimatedDuration: z.string().optional(),
  color: z.string(),
  icon: z.string(),
  notes: z.string().optional()
});

type EventFormData = z.infer<typeof eventSchema>;

const CATEGORY_ITEMS = [
  { name: 'Academic', key: 'academic' },
  { name: 'Work', key: 'work' },
  { name: 'Personal', key: 'personal' },
  { name: 'Appointment', key: 'appointment' },
  { name: 'Interview', key: 'interview' },
  { name: 'Hackathon', key: 'hackathon' },
  { name: 'Meeting', key: 'meeting' },
  { name: 'Health', key: 'health' },
  { name: 'Shopping', key: 'shopping' },
  { name: 'Other', key: 'other' },
];
const CATEGORIES = CATEGORY_ITEMS.map(c => c.name);
const COLORS = ['#3B82F6', '#FFD600', '#FF90E8', '#10B981', '#F97316', '#8B5CF6'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Utility to generate a unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function AddEventScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const s = styles;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addEvent, updateEvent, events } = useEventStore();
  
  const existingEvent = id ? events.find(e => e.id === id) : null;
  
  const [date, setDate] = useState(existingEvent ? new Date(existingEvent.date.split('T')[0] + 'T00:00:00') : new Date());
  const [time, setTime] = useState(existingEvent ? new Date(`1970-01-01T${existingEvent.time}:00`) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // FocusFlow Extended States
  const [locationText, setLocationText] = useState(existingEvent?.location || '');
  const [locationDetails, setLocationDetails] = useState<LocationDetails | undefined>(existingEvent?.locationDetails);
  
  const [locationReminderEnabled, setLocationReminderEnabled] = useState<boolean>(existingEvent?.locationReminderEnabled || false);
  const [geofenceRadius, setGeofenceRadius] = useState<number>(existingEvent?.geofenceRadius || 500);
  const [triggerType, setTriggerType] = useState<'arrive' | 'leave'>(existingEvent?.triggerType || 'arrive');

  const [imageUri, setImageUri] = useState<string | undefined>(existingEvent?.image);
  const [videoUri, setVideoUri] = useState<string | undefined>(existingEvent?.video);
  const [linkedContact, setLinkedContact] = useState<LinkedContact | undefined>(existingEvent?.linkedContact);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(existingEvent?.status || 'pending');

  // Reminders State
  const [reminders, setReminders] = useState<ReminderConfig[]>(existingEvent?.reminders || []);
  const [showReminderModal, setShowReminderModal] = useState(false);
  
  // Visibility State
  const [visibility, setVisibility] = useState<'onlyMe' | 'friends' | 'selectedFriends'>(existingEvent?.visibility || 'onlyMe');
  const [sharedWith, setSharedWith] = useState<string[]>(existingEvent?.sharedWith || []);
  const [friendsList, setFriendsList] = useState<any[]>([]);

  useEffect(() => {
    api.get('/friends').then(res => setFriendsList(res.data)).catch(console.error);
  }, []);
  
  // Custom Reminder Modal States
  const [modalType, setModalType] = useState<ReminderType>('before');
  const [modalValue, setModalValue] = useState<string>('1');
  const [modalUnit, setModalUnit] = useState<'minutes'|'hours'|'days'|'weeks'>('days');
  const [modalTime, setModalTime] = useState(new Date());
  const [modalShowTimePicker, setModalShowTimePicker] = useState(false);
  const [modalDate, setModalDate] = useState(new Date());
  const [modalShowDatePicker, setModalShowDatePicker] = useState(false);
  const [modalDays, setModalDays] = useState<string[]>([]);
  const [modalDayOfMonth, setModalDayOfMonth] = useState<string>('15');
  const [modalNotificationPref, setModalNotificationPref] = useState<'banner_sound' | 'banner_only' | 'silent'>('banner_sound');
  const [modalAlarmPref, setModalAlarmPref] = useState<'notification' | 'alarm' | 'both'>('notification');
  const [modalSnooze, setModalSnooze] = useState<number>(0);
  const [modalSound, setModalSound] = useState<'default'|'silent'|'custom'>('default');
  const [modalVibration, setModalVibration] = useState<boolean>(true);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  
  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SNOOZE_OPTIONS = [{label: 'Off', val: 0}, {label: '5 Min', val: 5}, {label: '10 Min', val: 10}, {label: '15 Min', val: 15}, {label: '30 Min', val: 30}, {label: '1 Hr', val: 60}];

  const { control, handleSubmit, watch, formState: { errors } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: existingEvent ? {
      title: existingEvent.title,
      description: existingEvent.description,
      category: existingEvent.category,
      priority: existingEvent.priority,
      estimatedDuration: String(existingEvent.estimatedDuration || 30),
      color: existingEvent.color,
      icon: existingEvent.icon,
      notes: existingEvent.notes,
    } : {
      category: 'Academic',
      priority: 'medium',
      estimatedDuration: '45',
      color: COLORS[0],
      icon: 'academic',
      notes: ''
    }
  });

  const selectedCategory = watch('category');

  // Smart Suggestions
  const smartSuggestions: { label: string, config: Partial<ReminderConfig> }[] = useMemo(() => {
    if (selectedCategory === 'Birthday' || selectedCategory === 'Hackathon') {
      return [
        { label: '7 Days Before', config: { type: 'before' as ReminderType, value: 7, unit: 'days' } },
        { label: '1 Day Before', config: { type: 'before' as ReminderType, value: 1, unit: 'days' } },
        { label: 'Same Day 9:00 AM', config: { type: 'exact' as ReminderType, time: '09:00', date: format(date, 'yyyy-MM-dd') } }
      ];
    } else if (selectedCategory === 'Academic' || selectedCategory === 'Interview' || selectedCategory === 'Work') {
      return [
        { label: '3 Days Before', config: { type: 'before' as ReminderType, value: 3, unit: 'days' } },
        { label: '1 Day Before', config: { type: 'before' as ReminderType, value: 1, unit: 'days' } },
        { label: '2 Hours Before', config: { type: 'before' as ReminderType, value: 2, unit: 'hours' } }
      ];
    }
    return [
      { label: '1 Hour Before', config: { type: 'before' as ReminderType, value: 1, unit: 'hours' } },
      { label: '1 Day Before', config: { type: 'before' as ReminderType, value: 1, unit: 'days' } }
    ];
  }, [selectedCategory, date]);

  const addSmartSuggestion = (config: Partial<ReminderConfig>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReminders(prev => [...prev, { id: generateId(), type: 'before', ...config } as ReminderConfig]);
  };

  const removeReminder = (idToRemove: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReminders(prev => prev.filter(r => r.id !== idToRemove));
  };

  const toggleModalDay = (day: string) => {
    Haptics.selectionAsync();
    setModalDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const openEditReminder = (r: ReminderConfig) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingReminderId(r.id);
    setModalType(r.type);
    if (r.value) setModalValue(r.value.toString());
    if (r.unit) setModalUnit(r.unit);
    if (r.time) setModalTime(new Date(`1970-01-01T${r.time}:00`));
    if (r.date) setModalDate(new Date(r.date));
    if (r.days) setModalDays(r.days);
    if (r.dayOfMonth) setModalDayOfMonth(r.dayOfMonth.toString());
    if (r.notificationPreference) setModalNotificationPref(r.notificationPreference);
    if (r.alarmPreference) setModalAlarmPref(r.alarmPreference);
    setModalSnooze(r.snooze || 0);
    setModalSound(r.sound || 'default');
    setModalVibration(r.vibration !== false);
    setShowReminderModal(true);
  };

  const saveCustomReminder = () => {
    const now = new Date();
    const [eventHours, eventMinutes] = format(time, 'HH:mm').split(':').map(Number);
    const eventTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eventHours, eventMinutes, 0, 0);

    if (modalType === 'exact') {
      const [remHours, remMinutes] = format(modalTime, 'HH:mm').split(':').map(Number);
      const reminderTarget = new Date(modalDate.getFullYear(), modalDate.getMonth(), modalDate.getDate(), remHours, remMinutes, 0, 0);

      if (reminderTarget.getTime() <= now.getTime()) {
        Alert.alert('Invalid Reminder Time', 'You cannot set a reminder for a time that has already passed.');
        return;
      }

      if (reminderTarget.getTime() > eventTarget.getTime()) {
        Alert.alert(
          'Invalid Reminder Time',
          `Reminder time (${format(reminderTarget, 'hh:mm a')}) cannot be set AFTER the event time (${format(eventTarget, 'hh:mm a')}). Please select a time before or at the event start.`
        );
        return;
      }
    } else if (modalType === 'before') {
      const val = parseInt(modalValue, 10) || 1;
      let triggerDate = new Date(eventTarget);
      if (modalUnit === 'minutes') triggerDate = subMinutes(eventTarget, val);
      else if (modalUnit === 'hours') triggerDate = subHours(eventTarget, val);
      else if (modalUnit === 'days') triggerDate = subDays(eventTarget, val);
      else if (modalUnit === 'weeks') triggerDate = subWeeks(eventTarget, val);

      if (triggerDate.getTime() <= now.getTime()) {
        Alert.alert(
          'Reminder In Past',
          `Setting a reminder ${val} ${modalUnit} before this event falls in the past. Please choose a shorter reminder interval or adjust event time.`
        );
        return;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newReminder: Partial<ReminderConfig> = { 
      id: editingReminderId || generateId(), 
      type: modalType,
      notificationPreference: modalNotificationPref,
      alarmPreference: modalAlarmPref,
      snooze: modalSnooze > 0 ? modalSnooze : undefined,
      sound: modalSound,
      vibration: modalVibration
    };
    
    if (modalType === 'before') {
      newReminder.value = parseInt(modalValue, 10) || 1;
      newReminder.unit = modalUnit;
    } else if (modalType === 'exact') {
      newReminder.date = format(modalDate, 'yyyy-MM-dd');
      newReminder.time = format(modalTime, 'HH:mm');
    } else if (modalType === 'daily') {
      newReminder.time = format(modalTime, 'HH:mm');
    } else if (modalType === 'weekly') {
      newReminder.time = format(modalTime, 'HH:mm');
      newReminder.days = modalDays;
    } else if (modalType === 'monthly') {
      newReminder.time = format(modalTime, 'HH:mm');
      newReminder.dayOfMonth = parseInt(modalDayOfMonth, 10) || 1;
    } else if (modalType === 'yearly') {
      newReminder.date = format(modalDate, 'MM-dd');
      newReminder.time = format(modalTime, 'HH:mm');
    }
    
    if (editingReminderId) {
      setReminders(prev => prev.map(r => r.id === editingReminderId ? (newReminder as ReminderConfig) : r));
    } else {
      setReminders(prev => [...prev, newReminder as ReminderConfig]);
    }
    
    setShowReminderModal(false);
    setEditingReminderId(null);
  };

  const formatReminderString = (r: ReminderConfig) => {
    if (r.type === 'before') return `${r.value} ${r.unit} before`;
    if (r.type === 'daily') return `Every day at ${r.time}`;
    if (r.type === 'weekly') return `Weekly on ${r.days?.map(d => d.slice(0,3)).join(', ')} at ${r.time}`;
    if (r.type === 'exact') return `${r.date} at ${r.time}`;
    if (r.type === 'monthly') return `Monthly on the ${r.dayOfMonth} at ${r.time}`;
    if (r.type === 'yearly') return `Yearly on ${r.date} at ${r.time}`;
    return `Custom ${r.type}`;
  };

  const renderRightActions = (id: string) => {
    return (
      <Pressable onPress={() => removeReminder(id)} style={styles.swipeDeleteBtn}>
        <Text style={styles.swipeDeleteText}>DELETE</Text>
      </Pressable>
    );
  };

  const onSubmit = async (data: EventFormData) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const durationNum = parseInt(data.estimatedDuration || '30', 10) || 30;
    
    if (existingEvent) {
      const updatedEvent: Event = {
        ...existingEvent,
        ...data,
        estimatedDuration: durationNum,
        status: taskStatus,
        location: locationText,
        locationDetails: locationDetails,
        locationReminderEnabled: locationReminderEnabled,
        geofenceRadius: geofenceRadius,
        triggerType: triggerType,
        image: imageUri,
        video: videoUri,
        linkedContact: linkedContact,
        date: date.toISOString(),
        time: format(time, 'HH:mm'),
        reminders: reminders,
        visibility,
        sharedWith: visibility === 'selectedFriends' ? sharedWith : [],
        updatedAt: new Date().toISOString(),
      };
      await updateEvent(updatedEvent as Event);
      if (Platform.OS === 'android') ToastAndroid.show('TASK UPDATED 🔥', ToastAndroid.SHORT);
    } else {
      const newEvent: Event = {
        id: generateId(),
        ...data,
        description: data.description || '',
        notes: data.notes || '',
        estimatedDuration: durationNum,
        status: 'pending',
        location: locationText,
        locationDetails: locationDetails,
        locationReminderEnabled: locationReminderEnabled,
        geofenceRadius: geofenceRadius,
        triggerType: triggerType,
        image: imageUri,
        video: videoUri,
        linkedContact: linkedContact,
        date: date.toISOString(),
        time: format(time, 'HH:mm'),
        reminders: reminders,
        visibility,
        sharedWith: visibility === 'selectedFriends' ? sharedWith : [],
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addEvent(newEvent as Event);
      if (Platform.OS === 'android') ToastAndroid.show('TASK CREATED 🔥', ToastAndroid.SHORT);
    }
    
    router.back();
  };

  return (
    <View style={styles.root}>
      <View style={styles.bgGlow} />

      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable 
            style={styles.backBtn} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <ChevronLeft color={colors.text} size={24} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>{existingEvent ? 'EDIT EVENT' : 'NEW EVENT'}</Text>
            <View style={styles.stepIndicator}>
              <View style={styles.stepActive} />
              <View style={styles.stepInactive} />
              <View style={styles.stepInactive} />
              <View style={styles.stepInactive} />
            </View>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            <View style={styles.mainCard}>
              <Controller
                control={control}
                name="title"
                render={({ field: { onChange, value } }) => (
                  <View>
                    <Text style={styles.label}>EVENT TITLE</Text>
                    <View style={[styles.inputWrapper, errors.title && styles.inputError, { borderColor: '#FFD5B0', backgroundColor: '#FFF9F5' }]}>
                      <Type color={colors.secondary} size={20} strokeWidth={2.5} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Birthday Party"
                        placeholderTextColor={colors.textSecondary}
                        value={value}
                        onChangeText={onChange}
                      />
                    </View>
                    {errors.title && <Text style={styles.errorText}>{errors.title.message}</Text>}
                  </View>
                )}
              />

              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.mt24}>
                    <Text style={styles.label}>DESCRIPTION</Text>
                    <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 14 }]}>
                      <AlignLeft color={colors.secondary} size={20} strokeWidth={2.5} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                        placeholder="Add details..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        value={value}
                        onChangeText={onChange}
                      />
                    </View>
                  </View>
                )}
              />

              <View style={styles.mt24}>
                <Text style={styles.label}>DATE & TIME</Text>
                <View style={styles.row}>
                  <Pressable 
                    style={[styles.inputWrapper, styles.flex1, { backgroundColor: '#F9FAFB', borderColor: colors.border }]} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <CalendarIcon color={colors.secondary} size={20} strokeWidth={2.5} style={styles.inputIcon} />
                    <Text style={[styles.input, { fontFamily: 'Poppins_600SemiBold', marginTop: 14 }]}>{format(date, 'MMM dd, yyyy')}</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.inputWrapper, styles.flex1, { backgroundColor: '#F9FAFB', borderColor: colors.border }]} 
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Clock color={colors.secondary} size={20} strokeWidth={2.5} style={styles.inputIcon} />
                    <Text style={[styles.input, { fontFamily: 'Poppins_600SemiBold', marginTop: 14 }]}>{format(time, 'hh:mm a')}</Text>
                  </Pressable>
                </View>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) setDate(selectedDate);
                  }}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="default"
                  onChange={(event, selectedTime) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (selectedTime) setTime(selectedTime);
                  }}
                />
              )}

              <View style={styles.mt24}>
                <Text style={styles.label}>ESTIMATED DURATION (MINUTES)</Text>
                <Controller
                  control={control}
                  name="estimatedDuration"
                  render={({ field: { onChange, value } }) => (
                    <View style={[styles.inputWrapper, { backgroundColor: '#F9FAFB', borderColor: colors.border }]}>
                      <Clock color={colors.secondary} size={20} strokeWidth={2.5} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="45"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        value={value}
                        onChangeText={onChange}
                      />
                    </View>
                  )}
                />
              </View>

              <View style={styles.mt24}>
                <Text style={styles.label}>CATEGORY</Text>
                <Controller
                  control={control}
                  name="category"
                  render={({ field: { onChange, value } }) => (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                      {CATEGORY_ITEMS.map((item) => {
                        const isSelected = value === item.name;
                        return (
                          <Pressable
                            key={item.name}
                            style={[styles.chip, isSelected && styles.chipActive]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              onChange(item.name);
                            }}
                          >
                            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{item.name}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                />
              </View>

              <View style={styles.mt24}>
                <Text style={styles.label}>IMPORTANCE LEVEL</Text>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field: { onChange, value } }) => (
                    <View style={styles.row}>
                      {PRIORITIES.map((p) => {
                        const isSelected = value === p;
                        const prioColors: Record<string, string> = { low: colors.success, medium: colors.secondary, high: '#EAB308', critical: colors.error };
                        const activeColor = prioColors[p];
                        
                        return (
                          <Pressable
                            key={p}
                            style={[
                              styles.prioChip, 
                              styles.flex1, 
                              isSelected && { borderColor: activeColor, backgroundColor: colors.card, shadowColor: activeColor, elevation: 4 }
                            ]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              onChange(p);
                            }}
                          >
                            <Text style={[styles.prioChipText, isSelected && { color: activeColor }]}>{p.toUpperCase()}</Text>
                            <View style={[styles.prioChipDot, { backgroundColor: isSelected ? activeColor : '#D1D9E6' }]} />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                />
              </View>

              <View style={styles.mt24}>
                <Text style={styles.label}>WHO CAN SEE THIS EVENT?</Text>
                <View style={styles.visibilityContainer}>
                  {[
                    { id: 'onlyMe', title: 'Only Me', icon: Lock },
                    { id: 'friends', title: 'All Connected Friends', icon: Globe },
                    { id: 'selectedFriends', title: 'Selected Friends', icon: Users }
                  ].map((option) => {
                    const isSelected = visibility === option.id;
                    const Icon = option.icon;
                    return (
                      <Pressable 
                        key={option.id}
                        style={[styles.visibilityOption, isSelected && styles.visibilityOptionActive]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setVisibility(option.id as any);
                        }}
                      >
                        <Icon color={isSelected ? colors.card : colors.text} size={20} strokeWidth={2.5} />
                        <Text style={[styles.visibilityOptionText, isSelected && { color: colors.card }]}>{option.title}</Text>
                        {isSelected && (
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <View style={styles.checkCircle}>
                              <Check color={colors.secondary} size={12} strokeWidth={3} />
                            </View>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {visibility === 'selectedFriends' && friendsList.length > 0 && (
                  <View style={{ marginTop: 12, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
                    <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 12, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Select Friends</Text>
                    {friendsList.map(friend => {
                      const fId = friend._id || friend.id;
                      const isSelected = sharedWith.includes(fId);
                      return (
                        <Pressable 
                          key={fId}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSharedWith(prev => isSelected ? prev.filter(id => id !== fId) : [...prev, fId]);
                          }}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                            <User color="#FFF" size={16} />
                          </View>
                          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: colors.text, flex: 1 }}>{friend.name}</Text>
                          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? colors.success : colors.border, backgroundColor: isSelected ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                            {isSelected && <Check color="#FFF" size={14} strokeWidth={3} />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                {visibility === 'selectedFriends' && friendsList.length === 0 && (
                  <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 13, color: colors.textSecondary, marginTop: 8, fontStyle: 'italic' }}>
                    You don't have any friends yet. Add friends to share tasks!
                  </Text>
                )}
              </View>

              <View style={styles.mt24}>
                <Text style={styles.label}>REMINDERS</Text>
                {reminders.map(r => (
                  <View key={r.id} style={styles.reminderCard}>
                    <View style={styles.reminderContent}>
                      <Bell color={colors.secondary} size={16} strokeWidth={2.5} />
                      <Text style={styles.reminderText}>{formatReminderString(r)}</Text>
                    </View>
                    <Pressable onPress={() => removeReminder(r.id)} style={styles.reminderDelete}>
                      <X color={colors.textSecondary} size={16} strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ))}

                <View style={styles.presetRemindersBox}>
                  <Text style={styles.presetRemindersTitle}>QUICK ADD</Text>
                  <View style={styles.presetRemindersWrap}>
                    {[
                      { label: '5m before', val: '5', u: 'minutes' },
                      { label: '15m before', val: '15', u: 'minutes' },
                      { label: '1h before', val: '1', u: 'hours' },
                      { label: '1d before', val: '1', u: 'days' }
                    ].map((preset, idx) => (
                      <Pressable
                        key={idx}
                        style={styles.presetChip}
                        onPress={() => {
                          const now = new Date();
                          const [eventHours, eventMinutes] = format(time, 'HH:mm').split(':').map(Number);
                          const eventTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eventHours, eventMinutes, 0, 0);
                          
                          let triggerDate = new Date(eventTarget);
                          const val = Number(preset.val);
                          if (preset.u === 'minutes') triggerDate = subMinutes(eventTarget, val);
                          else if (preset.u === 'hours') triggerDate = subHours(eventTarget, val);
                          else if (preset.u === 'days') triggerDate = subDays(eventTarget, val);

                          if (triggerDate.getTime() <= now.getTime()) {
                            Alert.alert('Cannot Add Reminder', `A reminder "${preset.label}" falls in the past for this event time.`);
                            return;
                          }

                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const newRem: ReminderConfig = {
                            id: Date.now().toString() + idx,
                            type: 'before',
                            value: Number(preset.val),
                            unit: preset.u as any,
                            alarmPreference: 'notification',
                            sound: 'default'
                          };
                          setReminders(prev => [...prev, newRem]);
                        }}
                      >
                        <Plus color={colors.text} size={14} strokeWidth={3} />
                        <Text style={styles.presetChipText}>{preset.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Pressable 
                  style={styles.addReminderBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditingReminderId(null);
                    setModalDate(date);
                    setModalTime(time);
                    setShowReminderModal(true);
                  }}
                >
                  <Plus color={colors.text} size={18} strokeWidth={2.5} />
                  <Text style={styles.addReminderBtnText}>ADD CUSTOM REMINDER</Text>
                </Pressable>
              </View>

              <LocationSelector
                value={locationText}
                onChangeLocation={(addr, details) => {
                  setLocationText(addr);
                  if (details) setLocationDetails(details);
                }}
              />
              
              {locationDetails?.latitude ? (
                <View style={styles.mt24}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={styles.label}>ENABLE LOCATION REMINDER</Text>
                    <Switch
                      value={locationReminderEnabled}
                      onValueChange={setLocationReminderEnabled}
                      trackColor={{ false: '#E2E8F0', true: colors.primary }}
                      thumbColor="#FFF"
                    />
                  </View>

                  {locationReminderEnabled && (
                    <View style={{ backgroundColor: '#F9FAFB', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={[styles.label, { fontSize: 12, marginBottom: 8 }]}>TRIGGER WHEN I...</Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                        <Pressable 
                          style={[{flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center'}, triggerType === 'arrive' && {backgroundColor: colors.primary, borderColor: colors.primary}]}
                          onPress={() => { Haptics.selectionAsync(); setTriggerType('arrive'); }}
                        >
                          <Text style={[{fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.textSecondary}, triggerType === 'arrive' && {color: '#FFF'}]}>Arrive</Text>
                        </Pressable>
                        <Pressable 
                          style={[{flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center'}, triggerType === 'leave' && {backgroundColor: colors.primary, borderColor: colors.primary}]}
                          onPress={() => { Haptics.selectionAsync(); setTriggerType('leave'); }}
                        >
                          <Text style={[{fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.textSecondary}, triggerType === 'leave' && {color: '#FFF'}]}>Leave</Text>
                        </Pressable>
                      </View>

                      <Text style={[styles.label, { fontSize: 12, marginBottom: 8 }]}>RADIUS</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {[100, 250, 500, 1000].map(r => (
                          <Pressable 
                            key={r}
                            style={[{paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border}, geofenceRadius === r && {backgroundColor: colors.secondary, borderColor: colors.secondary}]}
                            onPress={() => { Haptics.selectionAsync(); setGeofenceRadius(r); }}
                          >
                            <Text style={[{fontFamily: 'Poppins_500Medium', fontSize: 12, color: colors.textSecondary}, geofenceRadius === r && {color: '#FFF'}]}>{r}m</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ) : null}

              <ContactSelector
                value={linkedContact}
                onSelectContact={(contact) => setLinkedContact(contact)}
              />

              <MediaPicker
                imageUri={imageUri}
                videoUri={videoUri}
                onSelectImage={(uri) => setImageUri(uri)}
                onSelectVideo={(uri) => setVideoUri(uri)}
              />
            </View>

            <Pressable style={styles.createEventBtnWrapper} onPress={handleSubmit(onSubmit)}>
              <LinearGradient colors={[colors.secondary, colors.secondary]} style={styles.createEventBtn}>
                <CalendarIcon color="#FFF" size={20} strokeWidth={2.5} />
                <Text style={styles.createEventBtnText}>SAVE EVENT</Text>
              </LinearGradient>
            </Pressable>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={showReminderModal} animationType="slide" transparent={true} onRequestClose={() => setShowReminderModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', maxHeight: '90%' }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>CUSTOM REMINDER</Text>
                <Pressable onPress={() => setShowReminderModal(false)} style={styles.closeBtn}>
                  <X size={24} color={colors.text} strokeWidth={2.5} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                <Text style={styles.label}>TYPE</Text>
                <View style={styles.chipRowWrap}>
                  {(['before', 'exact', 'daily', 'weekly'] as ReminderType[]).map(t => (
                    <Pressable 
                      key={t}
                      style={[styles.modalChip, modalType === t && styles.modalChipActive]}
                      onPress={() => { Haptics.selectionAsync(); setModalType(t); }}
                    >
                      <Text style={[styles.modalChipText, modalType === t && styles.modalChipTextActive]}>{t.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>

                {modalType === 'before' && (
                  <>
                    <View style={styles.mt24}>
                      <Text style={styles.label}>VALUE</Text>
                      <View style={styles.modalInputWrapper}>
                        <TextInput
                          style={styles.modalInputText}
                          placeholder="1"
                          placeholderTextColor="#98A2B3"
                          keyboardType="numeric"
                          value={modalValue}
                          onChangeText={setModalValue}
                        />
                      </View>
                    </View>

                    <View style={styles.mt24}>
                      <Text style={styles.label}>UNIT</Text>
                      <View style={styles.chipRowWrap}>
                        {(['minutes', 'hours', 'days', 'weeks'] as const).map(u => (
                          <Pressable 
                            key={u}
                            style={[styles.modalChip, modalUnit === u && styles.modalChipActive]}
                            onPress={() => { Haptics.selectionAsync(); setModalUnit(u); }}
                          >
                            <Text style={[styles.modalChipText, modalUnit === u && styles.modalChipTextActive]}>{u.toUpperCase()}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </>
                )}

                {modalType === 'exact' && (
                  <>
                    <View style={styles.mt24}>
                      <Text style={styles.label}>DATE & TIME</Text>
                      <View style={styles.row}>
                        <Pressable 
                          style={[styles.inputWrapper, styles.flex1]} 
                          onPress={() => setModalShowDatePicker(true)}
                        >
                          <CalendarIcon color="#98A2B3" size={16} style={styles.inputIcon} />
                          <Text style={styles.input}>{format(modalDate, 'MMM dd, yyyy')}</Text>
                        </Pressable>
                        <Pressable 
                          style={[styles.inputWrapper, styles.flex1]} 
                          onPress={() => setModalShowTimePicker(true)}
                        >
                          <Clock color="#98A2B3" size={16} style={styles.inputIcon} />
                          <Text style={styles.input}>{format(modalTime, 'hh:mm a')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}

                {(modalType === 'daily' || modalType === 'weekly') && (
                  <View style={styles.mt24}>
                    <Text style={styles.label}>TIME</Text>
                    <Pressable 
                      style={styles.inputWrapper} 
                      onPress={() => setModalShowTimePicker(true)}
                    >
                      <Clock color="#98A2B3" size={16} style={styles.inputIcon} />
                      <Text style={styles.input}>{format(modalTime, 'hh:mm a')}</Text>
                    </Pressable>
                  </View>
                )}

                {modalType === 'weekly' && (
                  <View style={styles.mt24}>
                    <Text style={styles.label}>DAYS OF WEEK</Text>
                    <View style={styles.chipRowWrap}>
                      {WEEKDAYS.map(d => (
                        <Pressable 
                          key={d}
                          style={[styles.modalChip, modalDays.includes(d) && styles.modalChipActive]}
                          onPress={() => toggleModalDay(d)}
                        >
                          <Text style={[styles.modalChipText, modalDays.includes(d) && styles.modalChipTextActive]}>{d.substring(0,3)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {modalShowDatePicker && (
                  <DateTimePicker
                    value={modalDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setModalShowDatePicker(Platform.OS === 'ios');
                      if (selectedDate) setModalDate(selectedDate);
                    }}
                  />
                )}

                {modalShowTimePicker && (
                  <DateTimePicker
                    value={modalTime}
                    mode="time"
                    display="default"
                    onChange={(event, selectedTime) => {
                      setModalShowTimePicker(Platform.OS === 'ios');
                      if (selectedTime) setModalTime(selectedTime);
                    }}
                  />
                )}

                <View style={styles.divider} />

                <Text style={[styles.label, { color: colors.text, fontSize: 13 }]}>ADVANCED SETTINGS</Text>

                <View style={styles.mt16}>
                  <Text style={styles.label}>DELIVERY METHOD</Text>
                  <View style={styles.chipRowWrap}>
                    {(['notification', 'alarm', 'both'] as const).map(m => (
                      <Pressable 
                        key={m}
                        style={[styles.modalChip, modalAlarmPref === m && styles.modalChipActive]}
                        onPress={() => { Haptics.selectionAsync(); setModalAlarmPref(m); }}
                      >
                        <Text style={[styles.modalChipText, modalAlarmPref === m && styles.modalChipTextActive]}>{m.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                
                <View style={styles.mt16}>
                  <Text style={styles.label}>SNOOZE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                    {SNOOZE_OPTIONS.map(s => (
                      <Pressable 
                        key={s.label}
                        style={[styles.modalChip, modalSnooze === s.val && styles.modalChipActive]}
                        onPress={() => { Haptics.selectionAsync(); setModalSnooze(s.val); }}
                      >
                        <Text style={[styles.modalChipText, modalSnooze === s.val && styles.modalChipTextActive]}>{s.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={[styles.mt16, { marginBottom: 24 }]}>
                  <Text style={styles.label}>SOUND</Text>
                  <View style={styles.chipRowWrap}>
                    {(['default', 'silent', 'custom'] as const).map(s => (
                      <Pressable 
                        key={s}
                        style={[styles.modalChip, modalSound === s && styles.modalChipActive]}
                        onPress={() => { Haptics.selectionAsync(); setModalSound(s); }}
                      >
                        <Text style={[styles.modalChipText, modalSound === s && styles.modalChipTextActive]}>{s.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Pressable style={styles.saveReminderBtn} onPress={saveCustomReminder}>
                  <Check color={colors.card} size={20} strokeWidth={2.5} />
                  <Text style={styles.saveReminderBtnText}>SAVE REMINDER</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgGlow: {
    position: 'absolute',
    top: -50,
    right: -100,
    width: 300,
    height: 300,
    backgroundColor: colors.secondaryLight,
    opacity: 0.6,
    borderRadius: 150,
    transform: [{ scaleX: 1.5 }],
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 22,
    color: colors.text,
    textTransform: 'uppercase',
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  stepActive: {
    width: 16,
    height: 3,
    backgroundColor: colors.secondary,
    borderRadius: 2,
  },
  stepInactive: {
    width: 16,
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  mainCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 24,
  },
  label: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 11,
    color: colors.text,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    position: 'relative',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  flex1: {
    flex: 1,
  },
  mt24: {
    marginTop: 24,
  },
  chipContainer: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  chipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  chipText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.card,
  },
  prioChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prioChipText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 10,
    color: colors.text,
    marginBottom: 4,
  },
  prioChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  createEventBtnWrapper: {
    width: '100%',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 32,
    marginTop: 16,
  },
  createEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  createEventBtnText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: colors.card,
  },
  saveBtn: { marginTop: 8 },
  saveBtnText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 20, color: Colors.light.text },

  // Reminders & Visibility Styles
  presetRemindersBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  presetRemindersTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: colors.textSecondary, marginBottom: 10, letterSpacing: 0.5 },
  presetRemindersWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 4 },
  presetChipText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: colors.text },
  visibilityContainer: { gap: 12 },
  visibilityOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 12 },
  visibilityOptionActive: { backgroundColor: colors.text, borderColor: colors.text, shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  visibilityOptionText: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: colors.text },
  checkCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  reminderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  reminderContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: colors.text },
  reminderDelete: { padding: 4 },
  addReminderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 16, padding: 14, gap: 8, marginTop: 4 },
  addReminderBtnText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: colors.text },


  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(24,34,53,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: colors.text, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontFamily: 'Poppins_800ExtraBold', fontSize: 20, color: colors.text },
  closeBtn: { padding: 4, backgroundColor: colors.surface, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalScrollContent: { paddingBottom: Platform.OS === 'ios' ? 48 : 36 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, shadowColor: colors.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  modalChipActive: { backgroundColor: colors.primary, borderColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  modalChipText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: colors.text },
  modalChipTextActive: { color: colors.card },
  modalInputWrapper: { height: 52, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  modalInputText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 24 },
  saveReminderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary, paddingVertical: 16, borderRadius: 16, gap: 10, marginTop: 16, shadowColor: colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  saveReminderBtnText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 14, color: colors.card },
  mt16: { marginTop: 16 },
  
  // Timeline additions
  timelineItemWrapper: { marginBottom: 16, position: 'relative' },
  swipeDeleteBtn: {
    backgroundColor: colors.error, justifyContent: 'center', alignItems: 'flex-end',
    borderWidth: 2, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 20,
    marginLeft: 12, height: '100%'
  },
  swipeDeleteText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 14, color: '#FFF' },
  
  // Visibility Styles
  visibilityRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: '#000', borderRadius: 8, backgroundColor: '#FFF', gap: 12 },
  visibilityRowActive: { backgroundColor: '#000' },
  visibilityText: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: '#000' },
  visibilityTextActive: { color: '#FFF' },
  friendSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  friendSelectAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.primary, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  friendSelectAvatarText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 16, color: '#000' },
  friendSelectName: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: '#000' },
  friendSelectUsername: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: '#666' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#000', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.light.success }
});
