import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import { useState } from 'react';
import { 
  StyleSheet, ScrollView, View, Text, Pressable, Platform, 
  TextInput, KeyboardAvoidingView, ToastAndroid, Modal, Switch, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useEventStore } from '../store/useEventStore';
import { Event, ReminderConfig, ChecklistItem } from '../models/Event';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, subMinutes, subHours, subDays, subWeeks } from 'date-fns';
import { 
  Calendar as CalendarIcon, Clock,
  AlignLeft, Bell, ChevronLeft, Type,
  X, Check, Plus, Globe, Lock, Users, User
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { behaviorService } from '../services/behaviorService';

import LocationSelector from '../components/LocationSelector';
import MediaPicker from '../components/MediaPicker';
import ContactSelector from '../components/ContactSelector';
import { LocationDetails, LinkedContact, TaskStatus } from '../models/Event';

const eventSchema = yup.object().shape({
  title: yup.string().required('Title is required').max(50, 'Title is too long'),
  description: yup.string().optional(),
  category: yup.string().required('Category is required'),
  priority: yup.string().oneOf(['low', 'medium', 'high', 'critical']).required(),
  estimatedDuration: yup.string().optional(),
  color: yup.string().required(),
  icon: yup.string().required(),
  notes: yup.string().optional()
});

type EventFormData = yup.InferType<typeof eventSchema>;

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
const COLORS = ['#3B82F6', '#FFD600', '#FF90E8', '#10B981', '#F97316', '#8B5CF6'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SNOOZE_OPTIONS = [
  { label: 'Off', val: 0 },
  { label: '5 Min', val: 5 },
  { label: '10 Min', val: 10 },
  { label: '15 Min', val: 15 },
  { label: '30 Min', val: 30 },
  { label: '1 Hr', val: 60 }
];

// Utility to generate a unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function AddEventScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addEvent, updateEvent, events } = useEventStore();
  
  const existingEvent = id ? events.find(e => e.id === id) : null;
  
  const [date, setDate] = useState(existingEvent ? new Date(existingEvent.date) : new Date());
  const [time, setTime] = useState(existingEvent ? new Date(`1970-01-01T${existingEvent.time}:00`) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [locationText, setLocationText] = useState(existingEvent?.location || '');
  const [locationDetails, setLocationDetails] = useState<LocationDetails | undefined>(existingEvent?.locationDetails);
  
  const [locationReminderEnabled, setLocationReminderEnabled] = useState<boolean>(existingEvent?.locationReminderEnabled || false);
  const [geofenceRadius, setGeofenceRadius] = useState<number>(existingEvent?.geofenceRadius || 500);
  const [triggerType, setTriggerType] = useState<'arrive' | 'leave'>(existingEvent?.triggerType || 'arrive');

  // EC5: Critical task overrides phone silent mode and maxes alarm volume
  const [isCritical, setIsCritical] = useState<boolean>(existingEvent?.isCritical || false);

  // EC2: Time-gated location reminder — only fires during these hours/days
  const [timeGateEnabled, setTimeGateEnabled] = useState<boolean>(!!existingEvent?.locationTimeGate);
  const [timeGateStartHour, setTimeGateStartHour] = useState<number>(existingEvent?.locationTimeGate?.startHour ?? 9);
  const [timeGateEndHour, setTimeGateEndHour] = useState<number>(existingEvent?.locationTimeGate?.endHour ?? 17);
  const [timeGateDays, setTimeGateDays] = useState<string[]>(
    existingEvent?.locationTimeGate?.days ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  );

  // Checklist (Tier 2)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(existingEvent?.checklist || []);
  const [newChecklistItem, setNewChecklistItem] = useState('');


  const [imageUri, setImageUri] = useState<string | undefined>(existingEvent?.image);
  const [videoUri, setVideoUri] = useState<string | undefined>(existingEvent?.video);
  const [linkedContact, setLinkedContact] = useState<LinkedContact | undefined>(existingEvent?.linkedContact);
  const [taskStatus] = useState<TaskStatus>(existingEvent?.status || 'pending');

  let initDurVal = existingEvent?.estimatedDuration || 30;
  let initDurUnit: 'minutes' | 'hours' | 'days' = 'minutes';
  if (initDurVal > 0 && initDurVal % 1440 === 0) {
    initDurUnit = 'days';
    initDurVal = initDurVal / 1440;
  } else if (initDurVal > 0 && initDurVal % 60 === 0) {
    initDurUnit = 'hours';
    initDurVal = initDurVal / 60;
  }
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days'>(initDurUnit);
  const [aiDurationHint, setAiDurationHint] = useState<number | null>(null);
  const [aiDurationApplied, setAiDurationApplied] = useState(false);


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
  const [modalType, setModalType] = useState<ReminderConfig['type']>('before');
  const [modalValue, setModalValue] = useState<string>('1');
  const [modalUnit, setModalUnit] = useState<'minutes'|'hours'|'days'|'weeks'>('days');
  const [modalTime, setModalTime] = useState(new Date());
  const [modalDate, setModalDate] = useState(new Date());
  const [modalDays, setModalDays] = useState<string[]>(['Monday']);
  const [modalDayOfMonth] = useState<string>('1');
  
  // Notification & Alarm Customization States
  const [modalNotificationPref] = useState<'banner_sound' | 'banner_only' | 'silent'>('banner_sound');
  const [modalAlarmPref, setModalAlarmPref] = useState<'notification' | 'alarm' | 'both'>('both');
  const [modalSnooze, setModalSnooze] = useState<number>(0);
  const [modalSound, setModalSound] = useState<'default'|'silent'|'custom'>('default');
  const [modalVibration] = useState<boolean>(true);

  // Picker States for Modal
  const [modalShowDatePicker, setModalShowDatePicker] = useState(false);
  const [modalShowTimePicker, setModalShowTimePicker] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);

  const formik = useFormik<EventFormData>({
    validationSchema: eventSchema,
    initialValues: existingEvent ? {
      title: existingEvent.title || '',
      description: existingEvent.description || '',
      category: existingEvent.category || 'Work',
      priority: existingEvent.priority || 'medium',
      estimatedDuration: initDurVal.toString(),
      color: existingEvent.color || COLORS[0],
      icon: existingEvent.icon || 'Calendar',
      notes: existingEvent.notes || ''
    } : {
      title: '',
      description: '',
      category: 'Work',
      priority: 'medium',
      estimatedDuration: '30',
      color: COLORS[0],
      icon: 'Calendar',
      notes: ''
    },
    onSubmit: async (data: EventFormData) => {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        let durationNum = parseInt(data.estimatedDuration || '30', 10) || 30;
        if (durationUnit === 'hours') durationNum *= 60;
        else if (durationUnit === 'days') durationNum *= 1440;
        
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
            isCritical: isCritical,
            locationTimeGate: timeGateEnabled ? {
              startHour: timeGateStartHour,
              endHour: timeGateEndHour,
              days: timeGateDays,
            } : undefined,
            checklist: checklist,
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
            isCritical: isCritical,
            locationTimeGate: timeGateEnabled ? {
              startHour: timeGateStartHour,
              endHour: timeGateEndHour,
              days: timeGateDays,
            } : undefined,
            checklist: checklist,
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
        
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        console.error('Submit Error:', err);
        Alert.alert('Error Saving Event', err?.message || 'An unexpected error occurred. Check console logs.');
      }
    }
  });

  const removeReminder = (idToRemove: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReminders(prev => prev.filter(r => r.id !== idToRemove));
  };

  const openEditReminder = (r: ReminderConfig) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingReminderId(r.id);
    setModalType(r.type);
    if (r.value) setModalValue(r.value.toString());
    if (r.unit) setModalUnit(r.unit);
    if (r.alarmPreference) setModalAlarmPref(r.alarmPreference);
    if (r.snooze) setModalSnooze(r.snooze);
    if (r.sound) setModalSound(r.sound);
    if (r.time) {
      const [h, m] = r.time.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      setModalTime(d);
    }
    if (r.date) {
      const parts = r.date.split('-');
      if (parts.length === 3) {
        setModalDate(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
      }
    }
    setShowReminderModal(true);
  };

  const toggleModalDay = (day: string) => {
    Haptics.selectionAsync();
    setModalDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
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
    let base = '';
    if (r.type === 'before') base = `${r.value} ${r.unit} before`;
    else if (r.type === 'daily') base = `Every day at ${r.time}`;
    else if (r.type === 'weekly') base = `Weekly on ${r.days?.map(d => d.slice(0,3)).join(', ')} at ${r.time}`;
    else if (r.type === 'exact') base = `${r.date} at ${r.time}`;
    else if (r.type === 'monthly') base = `Monthly on the ${r.dayOfMonth} at ${r.time}`;
    else if (r.type === 'yearly') base = `Yearly on ${r.date} at ${r.time}`;
    else base = `Custom ${r.type}`;

    const method = r.alarmPreference === 'both' ? '🔔+⏰ Both' : r.alarmPreference === 'alarm' ? '⏰ Alarm' : '🔔 Notification';
    return `${base} (${method})`;
  };

  const onSubmit = async (data: EventFormData) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      let durationNum = parseInt(data.estimatedDuration || '30', 10) || 30;
      if (durationUnit === 'hours') durationNum *= 60;
      else if (durationUnit === 'days') durationNum *= 1440;
      
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
          isCritical: isCritical,
          locationTimeGate: timeGateEnabled ? {
            startHour: timeGateStartHour,
            endHour: timeGateEndHour,
            days: timeGateDays,
          } : undefined,
          checklist: checklist,
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
          isCritical: isCritical,
          locationTimeGate: timeGateEnabled ? {
            startHour: timeGateStartHour,
            endHour: timeGateEndHour,
            days: timeGateDays,
          } : undefined,
          checklist: checklist,
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
    } catch (err: any) {
      console.error('Submit Error:', err);
      Alert.alert('Error Saving Event', err?.message || 'An unexpected error occurred. Check console logs.');
    }
  };

  // AI Duration Prediction: fetch when category changes
  useEffect(() => {
    const category = formik.values.category;
    if (!category) return;
    let cancelled = false;
    behaviorService.predictDuration(category).then(predicted => {
      if (!cancelled && predicted !== null) {
        setAiDurationHint(predicted);
        setAiDurationApplied(false);
      } else if (!cancelled) {
        setAiDurationHint(null);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [formik.values.category]);

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
              <View>
                <Text style={styles.label}>EVENT TITLE</Text>
                <View style={[styles.inputWrapper, formik.touched.title && formik.errors.title ? styles.inputError : null, { borderColor: colors.secondary, backgroundColor: colors.secondaryLight }]}>
                  <Type color={colors.secondary} size={20} strokeWidth={2.5} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Birthday Party"
                    placeholderTextColor={colors.textSecondary}
                    value={formik.values.title}
                    onChangeText={formik.handleChange('title')}
                    onBlur={formik.handleBlur('title')}
                  />
                </View>
                {formik.touched.title && formik.errors.title && <Text style={styles.errorText}>{formik.errors.title}</Text>}
              </View>

              <View style={styles.mt24}>
                <Text style={styles.label}>DESCRIPTION</Text>
                <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 14 }]}>
                  <AlignLeft color={colors.secondary} size={20} strokeWidth={2.5} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                    placeholder="Add details..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    value={formik.values.description}
                    onChangeText={formik.handleChange('description')}
                    onBlur={formik.handleBlur('description')}
                  />
                </View>
                {formik.touched.description && formik.errors.description && <Text style={styles.errorText}>{formik.errors.description}</Text>}
              </View>

              <View style={styles.mt24}>
                <Text style={styles.label}>DATE & TIME</Text>
                <View style={styles.row}>
                  <Pressable 
                    style={[styles.inputWrapper, styles.flex1, { backgroundColor: colors.inputBackground || colors.surface, borderColor: colors.border }]} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <CalendarIcon color={colors.secondary} size={20} strokeWidth={2.5} style={styles.inputIcon} />
                    <Text style={[styles.input, { fontFamily: 'Poppins_600SemiBold', marginTop: 14 }]}>{format(date, 'MMM dd, yyyy')}</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.inputWrapper, styles.flex1, { backgroundColor: colors.inputBackground || colors.surface, borderColor: colors.border }]} 
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
                  onChange={(_, selectedDate) => {
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
                  onChange={(_, selectedTime) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (selectedTime) setTime(selectedTime);
                  }}
                />
              )}

              <View style={styles.mt24}>
                <Text style={styles.label}>ESTIMATED DURATION</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground || colors.surface, borderColor: colors.border, flex: 1 }]}>
                    <Clock color={colors.secondary} size={20} strokeWidth={2.5} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="45"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={formik.values.estimatedDuration}
                      onChangeText={formik.handleChange('estimatedDuration')}
                      onBlur={formik.handleBlur('estimatedDuration')}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', backgroundColor: colors.inputBackground || colors.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }}>
                    {['minutes', 'hours', 'days'].map(u => (
                      <Pressable 
                        key={u}
                        style={[{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }, durationUnit === u && { backgroundColor: colors.secondary }]}
                        onPress={() => { Haptics.selectionAsync(); setDurationUnit(u as any); }}
                      >
                        <Text style={[{ fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }, durationUnit === u && { color: '#FFF' }]}>{u}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* ── AI Duration Prediction Hint ── */}
              {aiDurationHint !== null && !aiDurationApplied && (
                <Pressable
                  onPress={() => {
                    formik.setFieldValue('estimatedDuration', String(aiDurationHint));
                    setDurationUnit('minutes');
                    setAiDurationApplied(true);
                    Haptics.selectionAsync();
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: colors.secondary + '12', borderWidth: 1, borderColor: colors.secondary + '30' }}
                >
                  <Text style={{ fontSize: 16 }}>🧠</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: colors.secondary }}>
                      AI suggests {aiDurationHint} min based on your history
                    </Text>
                    <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 10, color: colors.textSecondary }}>Tap to apply</Text>
                  </View>
                </Pressable>
              )}
              {/* ─────────────────────────────── */}

              <View style={styles.mt24}>
                <Text style={styles.label}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContainer}>
                  {CATEGORY_ITEMS.map((item) => {
                    const isSelected = formik.values.category === item.name;
                    return (
                      <Pressable
                        key={item.name}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          formik.setFieldValue('category', item.name);
                        }}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{item.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {formik.touched.category && formik.errors.category && <Text style={styles.errorText}>{formik.errors.category}</Text>}
              </View>

              <View style={styles.mt24}>
                <Text style={styles.label}>IMPORTANCE LEVEL</Text>
                <View style={styles.row}>
                  {PRIORITIES.map((p) => {
                    const isSelected = formik.values.priority === p;
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
                          formik.setFieldValue('priority', p);
                        }}
                      >
                        <Text style={[styles.prioChipText, isSelected && { color: activeColor }]}>{p.toUpperCase()}</Text>
                        <View style={[styles.prioChipDot, { backgroundColor: isSelected ? activeColor : '#D1D9E6' }]} />
                      </Pressable>
                    );
                  })}
                </View>
                {formik.touched.priority && formik.errors.priority && <Text style={styles.errorText}>{formik.errors.priority}</Text>}
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
                    <Pressable onPress={() => openEditReminder(r)} style={[styles.reminderContent, { flex: 1 }]}>
                      <Bell color={colors.secondary} size={16} strokeWidth={2.5} />
                      <Text style={styles.reminderText}>{formatReminderString(r)}</Text>
                    </Pressable>
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
                radius={geofenceRadius}
                onChangeRadius={(rad) => setGeofenceRadius(rad)}
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
                    <View style={{ backgroundColor: colors.inputBackground || colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
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
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
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

                      {/* EC2: Time Gate — only fire alarm during these hours/days */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={[styles.label, { fontSize: 12 }]}>⏰ TIME-GATE THIS REMINDER</Text>
                        <Switch
                          value={timeGateEnabled}
                          onValueChange={setTimeGateEnabled}
                          trackColor={{ false: '#E2E8F0', true: colors.secondary }}
                          thumbColor="#FFF"
                        />
                      </View>
                      {timeGateEnabled && (
                        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16, gap: 10 }}>
                          <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 11, color: colors.textSecondary }}>Alarm will only fire if triggered within this time window.</Text>

                          {/* Start/End Hour */}
                          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>FROM (hour)</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {[6,7,8,9,10,11,12].map(h => (
                                  <Pressable key={h} style={[{paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.border}, timeGateStartHour === h && {backgroundColor: colors.secondary, borderColor: colors.secondary}]} onPress={() => setTimeGateStartHour(h)}>
                                    <Text style={[{fontFamily: 'Poppins_500Medium', fontSize: 11, color: colors.textSecondary}, timeGateStartHour === h && {color: '#FFF'}]}>{h}:00</Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>UNTIL (hour)</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {[13,14,15,16,17,18,19,20].map(h => (
                                  <Pressable key={h} style={[{paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.border}, timeGateEndHour === h && {backgroundColor: colors.secondary, borderColor: colors.secondary}]} onPress={() => setTimeGateEndHour(h)}>
                                    <Text style={[{fontFamily: 'Poppins_500Medium', fontSize: 11, color: colors.textSecondary}, timeGateEndHour === h && {color: '#FFF'}]}>{h}:00</Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          </View>

                          {/* Days selection */}
                          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>ACTIVE DAYS</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => {
                              const isActive = timeGateDays.includes(day);
                              return (
                                <Pressable
                                  key={day}
                                  style={[{paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.border}, isActive && {backgroundColor: colors.secondary, borderColor: colors.secondary}]}
                                  onPress={() => {
                                    Haptics.selectionAsync();
                                    setTimeGateDays(prev => isActive ? prev.filter(d => d !== day) : [...prev, day]);
                                  }}
                                >
                                  <Text style={[{fontFamily: 'Poppins_500Medium', fontSize: 11, color: colors.textSecondary}, isActive && {color: '#FFF'}]}>{day.slice(0,3)}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      {/* EC5: Critical Task toggle */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, marginBottom: 12 }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 13, color: colors.text }}>🚨 Critical Task</Text>
                          <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: colors.textSecondary }}>Override silent mode & max volume when alarm fires.</Text>
                        </View>
                        <Switch
                          value={isCritical}
                          onValueChange={setIsCritical}
                          trackColor={{ false: '#E2E8F0', true: colors.error || '#EF4444' }}
                          thumbColor="#FFF"
                        />
                      </View>

                      {/* Tier 2: Location-Triggered Checklist */}
                      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                        <Text style={[styles.label, { fontSize: 12, marginBottom: 8 }]}>📋 LOCATION CHECKLIST (OPTIONAL)</Text>
                        <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: colors.textSecondary, marginBottom: 12 }}>
                          Items to show when you arrive at this location (e.g. Shopping List)
                        </Text>
                        
                        {checklist.map((item, index) => (
                          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.secondary, marginRight: 10 }} />
                            <Text style={{ flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 13, color: colors.text }}>{item.text}</Text>
                            <Pressable 
                              onPress={() => setChecklist(prev => prev.filter(c => c.id !== item.id))}
                              style={{ padding: 4 }}
                            >
                              <X color={colors.textSecondary} size={16} />
                            </Pressable>
                          </View>
                        ))}

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.inputWrapper, { flex: 1, height: 44, paddingVertical: 0 }]}>
                            <TextInput
                              style={[styles.input, { height: 44 }]}
                              placeholder="Add checklist item..."
                              placeholderTextColor={colors.textSecondary}
                              value={newChecklistItem}
                              onChangeText={setNewChecklistItem}
                              onSubmitEditing={() => {
                                if (newChecklistItem.trim()) {
                                  setChecklist(prev => [...prev, { id: Date.now().toString(), text: newChecklistItem.trim(), completed: false }]);
                                  setNewChecklistItem('');
                                }
                              }}
                            />
                          </View>
                          <Pressable
                            style={{ backgroundColor: colors.secondary, height: 44, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => {
                              if (newChecklistItem.trim()) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setChecklist(prev => [...prev, { id: Date.now().toString(), text: newChecklistItem.trim(), completed: false }]);
                                setNewChecklistItem('');
                              }
                            }}
                          >
                            <Plus color="#FFF" size={20} strokeWidth={2.5} />
                          </Pressable>
                        </View>
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

            <Pressable style={styles.createEventBtnWrapper} onPress={() => {
              if (Object.keys(formik.errors).length > 0) {
                const errorFields = Object.keys(formik.errors).join(', ');
                Alert.alert('Validation Error', `Please check the following fields: ${errorFields}`);
              }
              formik.handleSubmit();
            }}>
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
                  {(['before', 'exact', 'daily', 'weekly'] as const).map(t => (
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
                    minimumDate={new Date()}
                    onChange={(_, selectedDate) => {
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
                    onChange={(_, selectedTime) => {
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
  saveBtnText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 20, color: colors.text },

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
  modalInputWrapper: { height: 52, backgroundColor: colors.inputBackground || colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
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
  visibilityRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, gap: 12 },
  visibilityRowActive: { backgroundColor: colors.text, borderColor: colors.text },
  visibilityText: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: colors.text },
  visibilityTextActive: { color: colors.card },
  friendSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  friendSelectAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  friendSelectAvatarText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 16, color: '#FFF' },
  friendSelectName: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: colors.text },
  friendSelectUsername: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: colors.textSecondary },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.success }
});
