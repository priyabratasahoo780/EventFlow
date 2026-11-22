/**
 * GeofenceReminderSection.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * A self-contained, fully-working Location Reminder section for AddEvent.
 * - Enable/Disable toggle
 * - Trigger: Arrive / Leave
 * - Radius selector: 100m · 250m · 500m · 1km
 * - Time-Gate: From hour ↔ Until hour + Active Days
 * - Critical Task toggle (silent mode override)
 * - Location Checklist
 *
 * Designed for both Light & Dark mode (Day / Night).
 * ───────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  MapPin,
  Clock,
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  X,
  Plus,
} from 'lucide-react-native';
import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import { ChecklistItem } from '../models/Event';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeofenceConfig {
  locationReminderEnabled: boolean;
  triggerType: 'arrive' | 'leave';
  geofenceRadius: number;
  timeGateEnabled: boolean;
  timeGateStartHour: number;
  timeGateEndHour: number;
  timeGateDays: string[];
  isCritical: boolean;
  checklist: ChecklistItem[];
}

interface Props {
  config: GeofenceConfig;
  hasLocation: boolean;        // true once a lat/lng is pinned
  onChange: (updated: Partial<GeofenceConfig>) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RADII = [
  { label: '100m', val: 100 },
  { label: '250m', val: 250 },
  { label: '500m', val: 500 },
  { label: '1km',  val: 1000 },
];

const FROM_HOURS  = [6, 7, 8, 9, 10, 11, 12];
const UNTIL_HOURS = [13, 14, 15, 16, 17, 18, 19, 20];
const WEEKDAYS    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAY   = (d: string) => d.slice(0, 3);

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GeofenceReminderSection({ config, hasLocation, onChange }: Props) {
  const { getColors, isDark } = useThemeStore();
  const colors   = getColors();
  const dark     = isDark();
  const s        = getStyles(colors, dark);

  const [newChecklistItem, setNewChecklistItem] = useState('');

  // helper: animate layout transitions
  const animate = () =>
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const toggle = (key: keyof GeofenceConfig, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animate();
    onChange({ [key]: value });
  };

  const addChecklistItem = () => {
    const text = newChecklistItem.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({
      checklist: [
        ...config.checklist,
        { id: Date.now().toString(), text, completed: false },
      ],
    });
    setNewChecklistItem('');
  };

  const removeChecklistItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({ checklist: config.checklist.filter(c => c.id !== id) });
  };

  const toggleDay = (day: string) => {
    Haptics.selectionAsync();
    const days = config.timeGateDays.includes(day)
      ? config.timeGateDays.filter(d => d !== day)
      : [...config.timeGateDays, day];
    onChange({ timeGateDays: days });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.card}>

      {/* ── HEADER + ENABLE TOGGLE ── */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={s.iconPill}>
            <MapPin color={dark ? '#A78BFA' : '#6366F1'} size={17} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={s.headerTitle}>Location Reminder</Text>
            <Text style={s.headerSub}>
              {hasLocation
                ? (config.locationReminderEnabled
                    ? 'Geofence active 📍'
                    : 'Tap to enable geofence')
                : 'Set a location first'}
            </Text>
          </View>
        </View>
        <Switch
          value={config.locationReminderEnabled}
          onValueChange={v => { if (hasLocation) toggle('locationReminderEnabled', v); }}
          trackColor={{ false: dark ? '#374151' : '#E2E8F0', true: '#6366F1' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={dark ? '#374151' : '#E2E8F0'}
          disabled={!hasLocation}
        />
      </View>

      {/* ── BODY (only when enabled) ── */}
      {config.locationReminderEnabled && (
        <View style={s.body}>

          {/* ── TRIGGER: ARRIVE / LEAVE ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>TRIGGER WHEN I...</Text>
            <View style={s.segmentRow}>
              {(['arrive', 'leave'] as const).map(type => {
                const active = config.triggerType === type;
                return (
                  <Pressable
                    key={type}
                    style={[s.segment, active && s.segmentActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onChange({ triggerType: type });
                    }}
                  >
                    <Text style={[s.segmentText, active && s.segmentTextActive]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── RADIUS ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>RADIUS</Text>
            <View style={s.radiusRow}>
              {RADII.map(r => {
                const active = config.geofenceRadius === r.val;
                return (
                  <Pressable
                    key={r.val}
                    style={[s.radiusChip, active && s.radiusChipActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onChange({ geofenceRadius: r.val });
                    }}
                  >
                    <Text style={[s.radiusText, active && s.radiusTextActive]}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── TIME-GATE ── */}
          <View style={[s.section, s.sectionBox]}>
            <View style={s.toggleRow}>
              <View style={s.toggleLeft}>
                <Clock color={dark ? '#FCD34D' : '#D97706'} size={16} strokeWidth={2.4} />
                <Text style={s.toggleTitle}>⏰ TIME-GATE THIS REMINDER</Text>
              </View>
              <Switch
                value={config.timeGateEnabled}
                onValueChange={v => toggle('timeGateEnabled', v)}
                trackColor={{ false: dark ? '#374151' : '#E2E8F0', true: '#F97316' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={dark ? '#374151' : '#E2E8F0'}
              />
            </View>
            <Text style={s.toggleSub}>Alarm will only fire if triggered within this time window.</Text>

            {config.timeGateEnabled && (
              <View style={s.timeGateBody}>
                {/* From / Until hours */}
                <View style={s.hoursRow}>
                  {/* FROM */}
                  <View style={s.hourCol}>
                    <Text style={s.hourColLabel}>FROM (hour)</Text>
                    <View style={s.hourGrid}>
                      {FROM_HOURS.map(h => {
                        const active = config.timeGateStartHour === h;
                        return (
                          <Pressable
                            key={h}
                            style={[s.hourChip, active && s.hourChipActive]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              onChange({ timeGateStartHour: h });
                            }}
                          >
                            <Text style={[s.hourText, active && s.hourTextActive]}>
                              {h}:00
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* UNTIL */}
                  <View style={s.hourCol}>
                    <Text style={s.hourColLabel}>UNTIL (hour)</Text>
                    <View style={s.hourGrid}>
                      {UNTIL_HOURS.map(h => {
                        const active = config.timeGateEndHour === h;
                        return (
                          <Pressable
                            key={h}
                            style={[s.hourChip, active && s.hourChipActive]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              onChange({ timeGateEndHour: h });
                            }}
                          >
                            <Text style={[s.hourText, active && s.hourTextActive]}>
                              {h}:00
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Validation warning */}
                {config.timeGateEndHour <= config.timeGateStartHour && (
                  <View style={s.warningRow}>
                    <AlertTriangle color="#F59E0B" size={13} strokeWidth={2.5} />
                    <Text style={s.warningText}>
                      "Until" hour must be later than "From" hour.
                    </Text>
                  </View>
                )}

                {/* Active Days */}
                <Text style={[s.hourColLabel, { marginTop: 12, marginBottom: 6 }]}>
                  ACTIVE DAYS
                </Text>
                <View style={s.daysRow}>
                  {WEEKDAYS.map(day => {
                    const active = config.timeGateDays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        style={[s.dayChip, active && s.dayChipActive]}
                        onPress={() => toggleDay(day)}
                      >
                        <Text style={[s.dayText, active && s.dayTextActive]}>
                          {SHORT_DAY(day)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* ── CRITICAL TASK ── */}
          <View style={[s.section, s.sectionBox]}>
            <View style={s.toggleRow}>
              <View style={s.toggleLeft}>
                <AlertTriangle
                  color={config.isCritical ? '#EF4444' : (dark ? '#9CA3AF' : '#94A3B8')}
                  size={16}
                  strokeWidth={2.4}
                />
                <View>
                  <Text style={[s.toggleTitle, config.isCritical && { color: '#EF4444' }]}>
                    🚨 Critical Task
                  </Text>
                  <Text style={s.toggleSub}>
                    Override silent mode & max volume when alarm fires.
                  </Text>
                </View>
              </View>
              <Switch
                value={config.isCritical}
                onValueChange={v => toggle('isCritical', v)}
                trackColor={{ false: dark ? '#374151' : '#E2E8F0', true: '#EF4444' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={dark ? '#374151' : '#E2E8F0'}
              />
            </View>
          </View>

          {/* ── LOCATION CHECKLIST ── */}
          <View style={[s.section, s.sectionBox]}>
            <View style={s.toggleLeft}>
              <CheckSquare color={dark ? '#34D399' : '#10B981'} size={16} strokeWidth={2.4} />
              <View>
                <Text style={s.toggleTitle}>📋 LOCATION CHECKLIST (OPTIONAL)</Text>
                <Text style={s.toggleSub}>
                  Items to show when you arrive at this location (e.g. Shopping List)
                </Text>
              </View>
            </View>

            {/* Existing items */}
            {config.checklist.map(item => (
              <View key={item.id} style={s.checkItem}>
                <View style={s.checkDot} />
                <Text style={s.checkText} numberOfLines={1}>{item.text}</Text>
                <Pressable onPress={() => removeChecklistItem(item.id)} hitSlop={8}>
                  <X color={dark ? '#6B7280' : '#94A3B8'} size={15} strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}

            {/* Add input */}
            <View style={s.checkInputRow}>
              <TextInput
                style={s.checkInput}
                placeholder="Add checklist item..."
                placeholderTextColor={dark ? '#6B7280' : '#94A3B8'}
                value={newChecklistItem}
                onChangeText={setNewChecklistItem}
                onSubmitEditing={addChecklistItem}
                returnKeyType="done"
              />
              <Pressable
                style={[s.checkAddBtn, !newChecklistItem.trim() && { opacity: 0.45 }]}
                onPress={addChecklistItem}
                disabled={!newChecklistItem.trim()}
              >
                <Plus color="#FFF" size={18} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>

        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const getStyles = (colors: ColorTheme, dark: boolean) =>
  StyleSheet.create({
    card: {
      marginTop: 20,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: dark ? 'rgba(99,102,241,0.25)' : '#ECE9FB',
      backgroundColor: dark ? '#1A182E' : '#F9F8FD',
      overflow: 'hidden',
      shadowColor: dark ? '#000' : '#4338CA',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: dark ? 0.3 : 0.05,
      shadowRadius: 16,
      elevation: 4,
    },

    // Header
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    iconPill: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: dark ? 'rgba(99,102,241,0.2)' : '#EDEAFD',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14,
      color: dark ? '#A78BFA' : '#4F46E5',
      letterSpacing: -0.1,
    },
    headerSub: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      color: dark ? '#6B7280' : '#94A3B8',
      marginTop: 1,
    },

    // Body
    body: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: dark ? 'rgba(255,255,255,0.07)' : '#E8E5FB',
    },

    // Section
    section: {
      marginTop: 14,
    },
    sectionBox: {
      backgroundColor: dark ? 'rgba(255,255,255,0.03)' : colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: dark ? 'rgba(255,255,255,0.07)' : '#EEE9FC',
      padding: 12,
    },
    sectionLabel: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 10.5,
      color: dark ? '#9CA3AF' : '#94A3B8',
      letterSpacing: 0.6,
      marginBottom: 8,
      textTransform: 'uppercase',
    },

    // Segment (Arrive / Leave)
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#E8E5FB',
      borderRadius: 12,
      padding: 3,
    },
    segment: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: dark ? '#4F46E5' : '#4F46E5',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    segmentText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: dark ? '#9CA3AF' : '#6B7280',
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },

    // Radius
    radiusRow: {
      flexDirection: 'row',
      gap: 7,
    },
    radiusChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.2,
      borderColor: dark ? 'rgba(255,255,255,0.1)' : '#D1D5DB',
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#FFF',
      alignItems: 'center',
    },
    radiusChipActive: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
      shadowColor: '#F97316',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 3,
    },
    radiusText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
      color: dark ? '#9CA3AF' : '#6B7280',
    },
    radiusTextActive: {
      color: '#FFF',
    },

    // Toggle row
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      flexWrap: 'wrap',
    },
    toggleTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 12.5,
      color: dark ? '#E5E7EB' : '#1E293B',
      flexShrink: 1,
    },
    toggleSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 10.5,
      color: dark ? '#6B7280' : '#94A3B8',
      marginTop: 3,
      lineHeight: 15,
    },

    // Time-gate body
    timeGateBody: {
      marginTop: 12,
    },
    hoursRow: {
      flexDirection: 'row',
      gap: 10,
    },
    hourCol: {
      flex: 1,
    },
    hourColLabel: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 10,
      color: dark ? '#6B7280' : '#94A3B8',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    hourGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    hourChip: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: dark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#FFF',
    },
    hourChipActive: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
    },
    hourText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      color: dark ? '#9CA3AF' : '#6B7280',
    },
    hourTextActive: {
      color: '#FFF',
      fontFamily: 'Poppins_700Bold',
    },

    // Warning
    warningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      backgroundColor: 'rgba(245,158,11,0.1)',
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.3)',
    },
    warningText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 10.5,
      color: '#D97706',
      flex: 1,
    },

    // Days
    daysRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    dayChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9,
      borderWidth: 1.2,
      borderColor: dark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#FFF',
    },
    dayChipActive: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
    },
    dayText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11.5,
      color: dark ? '#9CA3AF' : '#6B7280',
    },
    dayTextActive: {
      color: '#FFF',
    },

    // Checklist
    checkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginTop: 8,
      borderWidth: 1,
      borderColor: dark ? 'rgba(255,255,255,0.07)' : '#E2E8F0',
    },
    checkDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: dark ? '#4F46E5' : '#6366F1',
      backgroundColor: 'transparent',
    },
    checkText: {
      flex: 1,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: dark ? '#E5E7EB' : '#1E293B',
    },
    checkInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    checkInput: {
      flex: 1,
      height: 44,
      backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#FFF',
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: dark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
      paddingHorizontal: 14,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: dark ? '#E5E7EB' : '#1E293B',
    },
    checkAddBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#F97316',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#F97316',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
  });
