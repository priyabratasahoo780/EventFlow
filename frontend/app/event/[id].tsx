import React, { useEffect, useState } from 'react';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { StyleSheet, View, Text, ScrollView, Pressable, Alert, Image, Share as RNShare, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEventStore } from '../../store/useEventStore';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, Tag, Bell, Share, Trash2, Edit2, CheckSquare, ChevronLeft, Check, User, Phone, Video, Play, CheckCircle2, Navigation } from 'lucide-react-native';
import BrutalCard from '../../components/BrutalCard';
import BrutalButton from '../../components/BrutalButton';
import * as Haptics from 'expo-haptics';
import { ReminderConfig } from '../../models/Event';
import { Theme } from '../../constants/theme';
import { Colors } from '../../constants/Colors';
import { priorityService } from '../../services/priorityService';
import * as Location from 'expo-location';
import MapViewWrapper from '../../components/MapViewWrapper';

const bgCol = Colors.light.background;
const primaryCol = Colors.light.primary;
const dangerCol = Colors.light.danger;
const successCol = Colors.light.success;
const warningCol = Colors.light.accent;

export default function EventDetailsScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { events, friendsEvents, deleteEvent, updateTaskStatus } = useEventStore();
  const [timeLeft, setTimeLeft] = useState('');
  const [showMap, setShowMap] = useState(false);

  const event = events.find(e => e.id === id) || friendsEvents.find(e => (e.id || e._id) === id);

  useEffect(() => {
    if (!event) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const eventDate = new Date(`${event.date.split('T')[0]}T${event.time.length <= 5 ? event.time + ':00' : event.time}`).getTime();
      const distance = eventDate - now;

      if (distance < 0) {
        setTimeLeft('Event started / passed');
        clearInterval(interval);
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${days}d ${hours}h ${minutes}m remaining`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [event?.date, event?.time]);

  // Request Location Permissions if Map is to be shown
  useEffect(() => {
    (async () => {
      if (showMap && event?.locationDetails?.latitude && event?.locationDetails?.longitude) {
        try {
          await Location.requestForegroundPermissionsAsync();
        } catch (e) {
          console.log('Location permission request failed', e);
        }
      }
    })();
  }, [showMap, event]);

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFound}>Task not found.</Text>
        <BrutalButton color={primaryCol} onPress={() => router.back()}>
          <Text style={styles.btnText}>GO BACK</Text>
        </BrutalButton>
      </SafeAreaView>
    );
  }

  const score = priorityService.calculateScore(event);
  const prioInfo = priorityService.getPriorityInfo(score);

  const formatReminderString = (r: ReminderConfig) => {
    if (r.type === 'before') return `${r.value} ${r.unit} before`;
    if (r.type === 'daily') return `Every day at ${r.time}`;
    if (r.type === 'weekly') return `Weekly on ${r.days?.map(d => d.slice(0,3)).join(', ')} at ${r.time}`;
    if (r.type === 'monthly') return `Every month on day ${r.dayOfMonth} at ${r.time}`;
    if (r.type === 'exact') return `Exact time: ${r.date} ${r.time}`;
    return `Custom ${r.type}`;
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete Task?', `Are you sure you want to delete "${event.title}"?`, [
      { text: 'CANCEL', style: 'cancel' },
      { 
        text: 'DELETE', 
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(event.id);
          router.back();
        }
      }
    ]);
  };

  const handleStartTask = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateTaskStatus(event.id, 'in_progress');
  };

  const handleComplete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateTaskStatus(event.id, event.completed ? 'pending' : 'completed');
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      let shareMessage = `🎯 Task: ${event.title}\n`;
      shareMessage += `📅 Due: ${format(new Date(event.date), 'MMM dd, yyyy')} at ${event.time}\n`;
      shareMessage += `🏷️ Category: ${event.category.toUpperCase()}\n`;
      
      if (event.description) {
        shareMessage += `\n📝 Description:\n${event.description}\n`;
      }

      if (event.location) {
        shareMessage += `\n📍 Location:\n${event.location}\n`;
        if (event.locationDetails?.latitude && event.locationDetails?.longitude) {
          shareMessage += `Map Link: https://www.google.com/maps/search/?api=1&query=${event.locationDetails.latitude},${event.locationDetails.longitude}\n`;
        }
      }

      await RNShare.share({
        message: shareMessage.trim(),
        url: event.image ? event.image : undefined,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/add-event?id=${event.id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()}
          style={({pressed}) => [styles.backBtn, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <ChevronLeft size={24} color={Colors.light.icon} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>TASK DETAILS</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <BrutalCard shadowOffset={6} color={event.color || Colors.light.accent} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.priorityBadge}>
              <Tag color="#000" size={14} strokeWidth={2.5} />
              <Text style={styles.categoryText}>{event.category.toUpperCase()}</Text>
            </View>

            <View style={[styles.priorityBadge, { backgroundColor: prioInfo.color }]}>
              <Text style={[styles.priorityText, { color: '#FFF' }]}>{prioInfo.level.toUpperCase()} ({score} PTS)</Text>
            </View>
          </View>

          <Text style={styles.title}>{event.title}</Text>
          <View style={styles.timeLeftContainer}>
            <Clock color="#000" size={16} strokeWidth={2.2} />
            <Text style={styles.timeLeft}>{timeLeft}</Text>
          </View>
        </BrutalCard>

        {event.description ? (
          <BrutalCard shadowOffset={4} color="#FFF" style={styles.infoCard}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <Text style={styles.description}>{event.description}</Text>
          </BrutalCard>
        ) : null}

        <View style={styles.grid}>
          <BrutalCard shadowOffset={4} color="#FFF" style={styles.gridItem}>
            <Calendar color="#000" size={22} strokeWidth={2} style={styles.gridIcon} />
            <Text style={styles.gridLabel}>DEADLINE DATE</Text>
            <Text style={styles.gridValue}>{format(new Date(event.date), 'MMM dd, yyyy')}</Text>
          </BrutalCard>
          
          <BrutalCard shadowOffset={4} color="#FFF" style={styles.gridItem}>
            <Clock color="#000" size={22} strokeWidth={2} style={styles.gridIcon} />
            <Text style={styles.gridLabel}>ESTIMATED TIME</Text>
            <Text style={styles.gridValue}>~{event.estimatedDuration || 30} Mins</Text>
          </BrutalCard>
        </View>

        {event.location ? (
          <BrutalCard shadowOffset={4} color="#FFF" style={styles.infoCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Theme.spacing.sm }}>
              <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>LOCATION</Text>
              {event.locationDetails?.latitude && event.locationDetails?.longitude && (
                <Pressable onPress={() => setShowMap(!showMap)}>
                  <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 12, color: Colors.light.primary }}>
                    {showMap ? 'HIDE MAP' : 'VIEW 3D MAP'}
                  </Text>
                </Pressable>
              )}
            </View>

            {event.locationDetails?.latitude && event.locationDetails?.longitude ? (
              showMap ? (
                <View style={styles.mapContainer}>
                  <MapViewWrapper
                    style={styles.map}
                    initialCamera={{
                      center: {
                        latitude: event.locationDetails.latitude,
                        longitude: event.locationDetails.longitude,
                      },
                      pitch: 60,
                      heading: 0,
                      altitude: 1000,
                      zoom: 18
                    }}
                    showsUserLocation={true}
                    markerCoordinate={{
                      latitude: event.locationDetails.latitude,
                      longitude: event.locationDetails.longitude,
                    }}
                    markerTitle={event.title}
                  />
                  <View style={styles.addressBox}>
                    <MapPin color={Colors.light.primary} size={20} strokeWidth={2.5} />
                    <Text style={styles.addressText}>{event.location}</Text>
                    <Pressable 
                      style={styles.directionsBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const latLng = `${event.locationDetails!.latitude},${event.locationDetails!.longitude}`;
                        const url = Platform.OS === 'ios' ? `maps:0,0?q=${event.title}@${latLng}` : `geo:0,0?q=${latLng}(${event.title})`;
                        Linking.openURL(url);
                      }}
                    >
                      <Navigation color="#FFF" size={16} strokeWidth={2.5} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.addressOnlyBox}>
                  <MapPin color={Colors.light.primary} size={24} strokeWidth={2.5} />
                  <Text style={styles.addressOnlyText}>{event.location}</Text>
                  <Pressable 
                    style={styles.directionsBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const latLng = `${event.locationDetails!.latitude},${event.locationDetails!.longitude}`;
                      const url = Platform.OS === 'ios' ? `maps:0,0?q=${event.title}@${latLng}` : `geo:0,0?q=${latLng}(${event.title})`;
                      Linking.openURL(url);
                    }}
                  >
                    <Navigation color="#FFF" size={16} strokeWidth={2.5} />
                  </Pressable>
                </View>
              )
            ) : (
              <View style={styles.addressOnlyBox}>
                <MapPin color={Colors.light.primary} size={24} strokeWidth={2.5} />
                <Text style={styles.addressOnlyText}>{event.location}</Text>
              </View>
            )}
          </BrutalCard>
        ) : null}

        {event.linkedContact ? (
          <BrutalCard shadowOffset={4} color={Colors.light.accent} style={styles.infoCard}>
            <Text style={[styles.sectionLabel, { color: 'rgba(255,255,255,0.7)' }]}>LINKED CONTACT</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <User color="#FFF" size={24} strokeWidth={2.5} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 16, color: '#FFF' }} numberOfLines={1}>{event.linkedContact.name}</Text>
                  {event.linkedContact.phone ? <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{event.linkedContact.phone}</Text> : null}
                </View>
              </View>
              
              {event.linkedContact.phone ? (
                <Pressable 
                  style={{ backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => Linking.openURL(`tel:${event.linkedContact?.phone}`)}
                >
                  <Phone color={Colors.light.accent} size={14} strokeWidth={3} />
                  <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 13, color: Colors.light.accent }}>CALL</Text>
                </Pressable>
              ) : null}
            </View>
          </BrutalCard>
        ) : null}

        {event.image ? (
          <BrutalCard shadowOffset={4} color="#FFF" style={styles.infoCard}>
            <Text style={styles.sectionLabel}>IMAGE ATTACHMENT</Text>
            <View style={{ height: 200, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.light.border }}>
              <Image source={{ uri: event.image }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            </View>
          </BrutalCard>
        ) : null}

        {event.video ? (
          <BrutalCard shadowOffset={4} color="#FFF" style={styles.infoCard}>
            <Text style={styles.sectionLabel}>VIDEO ATTACHMENT</Text>
            <View style={styles.videoBox}>
              <Video color="#000" size={24} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.videoTitle} numberOfLines={1} ellipsizeMode="middle">
                  {event.video.split('/').pop() || 'Video Instruction Attached'}
                </Text>
                <Text style={styles.videoSub}>Tap to preview video</Text>
              </View>
              <View style={styles.playBtnCircle}>
                <Play color="#FFF" size={14} fill="#FFF" />
              </View>
            </View>
          </BrutalCard>
        ) : null}

        {/* REMINDERS SUMMARY CARD */}
        <BrutalCard shadowOffset={4} color="#F5F3FF" style={styles.infoCard}>
          <View style={styles.remindersHeader}>
            <Bell color="#000" size={22} strokeWidth={2} />
            <Text style={[styles.sectionLabel, { marginBottom: 0, marginLeft: 8 }]}>REMINDERS</Text>
          </View>
          
          {(!event.reminders || event.reminders.length === 0) ? (
            <Text style={styles.description}>No reminders set.</Text>
          ) : (
            <View style={styles.remindersList}>
              {event.reminders.map((r: any, i: number) => (
                <View key={i} style={styles.reminderItem}>
                  <Check size={16} color="#10B981" strokeWidth={2.5} />
                  <Text style={styles.reminderItemText}>{formatReminderString(r)}</Text>
                </View>
              ))}
            </View>
          )}
        </BrutalCard>

        {/* PRIMARY ACTIONS */}
        <View style={styles.actionsContainer}>
          {event.status !== 'in_progress' && !event.completed ? (
            <BrutalButton 
              color={Colors.light.primary} 
              shadowOffset={6}
              style={styles.actionBtn}
              onPress={handleStartTask}
            >
              <View style={styles.btnContent}>
                <Play color="#FFF" size={22} fill="#FFF" style={{ marginRight: 10 }} />
                <Text style={[styles.mainActionText, { color: '#FFF' }]}>START TASK NOW</Text>
              </View>
            </BrutalButton>
          ) : null}

          <BrutalButton 
            color={event.completed ? warningCol : successCol} 
            shadowOffset={6}
            style={styles.actionBtn}
            onPress={handleComplete}
          >
            <View style={styles.btnContent}>
              {event.completed ? (
                <CheckSquare color="#000" size={22} strokeWidth={2.5} style={{ marginRight: 10 }} />
              ) : (
                <CheckCircle2 color="#000" size={22} strokeWidth={2.5} style={{ marginRight: 10 }} />
              )}
              <Text style={styles.mainActionText}>
                {event.completed ? 'MARK PENDING' : 'MARK COMPLETED'}
              </Text>
            </View>
          </BrutalButton>

          {/* SECONDARY ROW: EDIT | SHARE | DELETE */}
          <View style={styles.actionRow}>
            <BrutalButton color="#FFF" shadowOffset={4} style={styles.flex1} onPress={handleEdit}>
              <View style={styles.subBtnContent}>
                <Edit2 color="#000" size={18} strokeWidth={2.2} />
                <Text style={styles.subBtnText}>EDIT</Text>
              </View>
            </BrutalButton>
            
            <BrutalButton color="#FFF" shadowOffset={4} style={styles.flex1} onPress={handleShare}>
              <View style={styles.subBtnContent}>
                <Share color="#000" size={18} strokeWidth={2.2} />
                <Text style={styles.subBtnText}>SHARE</Text>
              </View>
            </BrutalButton>
            
            <BrutalButton color={dangerCol} shadowOffset={4} style={styles.flex1} onPress={handleDelete}>
              <View style={styles.subBtnContent}>
                <Trash2 color="#000" size={18} strokeWidth={2.2} />
                <Text style={styles.subBtnText}>DELETE</Text>
              </View>
            </BrutalButton>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (_colors: ColorTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: bgCol },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.md, paddingBottom: Theme.spacing.sm,
    backgroundColor: bgCol,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.light.card,
    borderWidth: Theme.borders.thick, borderColor: Colors.light.border, alignItems: 'center', justifyContent: 'center',
    ...Theme.shadows.small
  },
  headerTitle: { fontFamily: 'Poppins_800ExtraBold', fontSize: 22, color: Colors.light.text },
  scrollContent: { padding: Theme.spacing.lg, paddingBottom: 60 },
  notFound: { fontFamily: 'Poppins_500Medium', fontSize: 20, textAlign: 'center', marginTop: 40, marginBottom: 20 },
  btnText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 16 },
  heroCard: { padding: Theme.spacing.lg, marginBottom: Theme.spacing.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md, flexWrap: 'wrap', gap: 8 },
  priorityBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Theme.borderRadius.full, 
    backgroundColor: Colors.light.card, borderWidth: Theme.borders.medium, borderColor: Colors.light.border, 
    ...Theme.shadows.small 
  },
  categoryText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 11, color: Colors.light.text },
  priorityText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 11, color: Colors.light.text },
  title: { fontFamily: 'Poppins_800ExtraBold', fontSize: 28, color: '#FFF', marginBottom: Theme.spacing.md },
  timeLeftContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Theme.borderRadius.md, alignSelf: 'flex-start', borderWidth: Theme.borders.medium, borderColor: Colors.light.border
  },
  timeLeft: { fontFamily: 'Poppins_800ExtraBold', fontSize: 13, color: Colors.light.text },
  infoCard: { padding: Theme.spacing.lg, marginBottom: Theme.spacing.lg },
  sectionLabel: { fontFamily: 'Poppins_800ExtraBold', fontSize: 12, color: Colors.light.text, marginBottom: Theme.spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: Colors.light.text, lineHeight: 22 },
  grid: { flexDirection: 'row', gap: Theme.spacing.md, marginBottom: Theme.spacing.lg },
  gridItem: { flex: 1, padding: Theme.spacing.md },
  gridIcon: { marginBottom: Theme.spacing.xs },
  gridLabel: { fontFamily: 'Poppins_800ExtraBold', fontSize: 11, color: Colors.light.textSecondary, marginBottom: 2 },
  gridValue: { fontFamily: 'Poppins_800ExtraBold', fontSize: 15, color: Colors.light.text },
  videoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.light.accent, padding: 14, borderRadius: 10,
    borderWidth: 2, borderColor: '#000',
  },
  videoTitle: { fontFamily: 'Poppins_800ExtraBold', fontSize: 14, color: '#000', flexShrink: 1 },
  videoSub: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#333' },
  playBtnCircle: { backgroundColor: '#000', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  remindersHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.spacing.md, paddingBottom: Theme.spacing.sm, borderBottomWidth: Theme.borders.medium, borderColor: Colors.light.border },
  remindersList: { gap: Theme.spacing.md },
  reminderItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reminderItemText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 14, color: Colors.light.text },
  actionsContainer: { gap: Theme.spacing.md, marginTop: Theme.spacing.xs },
  actionBtn: { paddingVertical: 10 },
  btnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  mainActionText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 18, color: Colors.light.text },
  actionRow: { flexDirection: 'row', gap: Theme.spacing.sm },
  flex1: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  subBtnText: { fontFamily: 'Poppins_800ExtraBold', fontSize: 13, color: '#000' },
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#F8FAFC',
  },
  map: {
    width: '100%',
    height: 180,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: Colors.light.border,
  },
  addressText: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#000',
  },
  directionsBtn: {
    backgroundColor: '#000',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressOnlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  addressOnlyText: {
    flex: 1,
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#000',
  }
});
