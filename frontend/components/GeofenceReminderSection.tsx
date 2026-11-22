/**
 * GeofenceReminderSection.tsx  — v2 Perfect
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained, fully-working Location Reminder section.
 *
 * Features:
 *  • Enable / Disable toggle (disabled when no location pinned)
 *  • Arrive / Leave segmented control
 *  • Radius: 100m · 250m · 500m · 1km
 *  • Time-Gate: FROM hour ↔ UNTIL hour  +  Active Days (smooth LayoutAnimation)
 *  • Validation: "Until" must be > "From"
 *  • Critical Task toggle (silent mode override)
 *  • Location Checklist (add / remove items, self-contained state)
 *  • Full Day + Night mode
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  Pressable,
  TextInput,
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
  X,
  Plus,
  Navigation,
  List,
} from 'lucide-react-native';
import { useThemeStore } from '../store/useThemeStore';
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
  hasLocation: boolean;
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

// ─── Helper ──────────────────────────────────────────────────────────────────

const animate = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  const { isDark } = useThemeStore();
  return (
    <Text style={[sectionTitleStyle, { color: isDark() ? '#6B7280' : '#94A3B8' }]}>
      {children}
    </Text>
  );
}

const sectionTitleStyle: any = {
  fontFamily: 'Poppins_700Bold',
  fontSize: 10.5,
  letterSpacing: 0.7,
  textTransform: 'uppercase',
  marginBottom: 8,
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GeofenceReminderSection({ config, hasLocation, onChange }: Props) {
  const { isDark } = useThemeStore();
  const dark = isDark();
  const s = getStyles(dark);

  const [checklistInput, setChecklistInput] = useState('');

  // ── handlers ───────────────────────────────────────────────────────────────

  const setEnabled = (v: boolean) => {
    if (!hasLocation && v) return; // guard: can't enable without location
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animate();
    onChange({ locationReminderEnabled: v });
  };

  const setTrigger = (t: 'arrive' | 'leave') => {
    Haptics.selectionAsync();
    onChange({ triggerType: t });
  };

  const setRadius = (r: number) => {
    Haptics.selectionAsync();
    onChange({ geofenceRadius: r });
  };

  const setTimeGate = (v: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animate();
    onChange({ timeGateEnabled: v });
  };

  const setFromHour = (h: number) => {
    Haptics.selectionAsync();
    onChange({ timeGateStartHour: h });
  };

  const setUntilHour = (h: number) => {
    Haptics.selectionAsync();
    onChange({ timeGateEndHour: h });
  };

  const toggleDay = (day: string) => {
    Haptics.selectionAsync();
    const next = config.timeGateDays.includes(day)
      ? config.timeGateDays.filter(d => d !== day)
      : [...config.timeGateDays, day];
    onChange({ timeGateDays: next });
  };

  const setCritical = (v: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animate();
    onChange({ isCritical: v });
  };

  const addItem = () => {
    const text = checklistInput.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({
      checklist: [
        ...config.checklist,
        { id: `${Date.now()}`, text, completed: false },
      ],
    });
    setChecklistInput('');
  };

  const removeItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({ checklist: config.checklist.filter(c => c.id !== id) });
  };

  const timeGateInvalid = config.timeGateEndHour <= config.timeGateStartHour;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.card}>

      {/* ══ HEADER + MASTER TOGGLE ══════════════════════════════════════════ */}
      <View style={s.headerRow}>
        <View style={s.headerIconBox}>
          <MapPin color={dark ? '#A78BFA' : '#6366F1'} size={18} strokeWidth={2.3} />
        </View>
        <View style={s.headerText}>
          <Text style={s.headerTitle}>Location Reminder</Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {!hasLocation
              ? 'Set a location above to enable'
              : config.locationReminderEnabled
              ? '📍 Geofence active'
              : 'Tap toggle to enable geofence'}
          </Text>
        </View>
        <Switch
          value={config.locationReminderEnabled}
          onValueChange={setEnabled}
          trackColor={{
            false: dark ? '#374151' : '#E2E8F0',
            true: '#6366F1',
          }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={dark ? '#374151' : '#E2E8F0'}
          disabled={!hasLocation}
          style={{ opacity: hasLocation ? 1 : 0.4 }}
        />
      </View>

      {/* ══ BODY (visible only when enabled) ════════════════════════════════ */}
      {config.locationReminderEnabled && (
        <View style={s.body}>

          {/* ── TRIGGER ARRIVE / LEAVE ─────────────────────────────────────── */}
          <View style={s.block}>
            <SectionTitle>TRIGGER WHEN I...</SectionTitle>
            <View style={s.segRow}>
              {(['arrive', 'leave'] as const).map(type => {
                const active = config.triggerType === type;
                return (
                  <Pressable
                    key={type}
                    style={[s.seg, active && s.segActive]}
                    onPress={() => setTrigger(type)}
                  >
                    <Navigation
                      color={active ? '#FFF' : (dark ? '#6B7280' : '#94A3B8')}
                      size={12}
                      strokeWidth={2.5}
                      style={{ transform: [{ rotate: type === 'leave' ? '180deg' : '0deg' }] }}
                    />
                    <Text style={[s.segText, active && s.segTextActive]}>
                      {type === 'arrive' ? 'Arrive' : 'Leave'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── RADIUS ─────────────────────────────────────────────────────── */}
          <View style={s.block}>
            <View style={s.labelRow}>
              <SectionTitle>RADIUS</SectionTitle>
              <Text style={s.radiusTag}>
                {config.geofenceRadius < 1000
                  ? `${config.geofenceRadius}m`
                  : `${config.geofenceRadius / 1000}km`}
              </Text>
            </View>
            <View style={s.radiusRow}>
              {RADII.map(r => {
                const active = config.geofenceRadius === r.val;
                return (
                  <Pressable
                    key={r.val}
                    style={[s.radiusChip, active && s.radiusChipActive]}
                    onPress={() => setRadius(r.val)}
                  >
                    <Text style={[s.radiusText, active && s.radiusTextActive]}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── TIME-GATE ──────────────────────────────────────────────────── */}
          <View style={[s.block, s.boxed]}>
            {/* Toggle row */}
            <View style={s.toggleRow}>
              <Clock color={dark ? '#FCD34D' : '#D97706'} size={15} strokeWidth={2.4} />
              <Text style={s.toggleTitle}>⏰ TIME-GATE THIS REMINDER</Text>
              <Switch
                value={config.timeGateEnabled}
                onValueChange={setTimeGate}
                trackColor={{ false: dark ? '#374151' : '#E2E8F0', true: '#F97316' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={dark ? '#374151' : '#E2E8F0'}
              />
            </View>
            <Text style={s.toggleSub}>
              Alarm will only fire if triggered within this time window.
            </Text>

            {/* Expanded time-gate settings */}
            {config.timeGateEnabled && (
              <View style={s.timeGateInner}>

                {/* FROM / UNTIL columns */}
                <View style={s.hoursRow}>
                  {/* FROM */}
                  <View style={s.hourCol}>
                    <Text style={[sectionTitleStyle, { color: dark ? '#6B7280' : '#94A3B8', marginBottom: 6 }]}>
                      FROM (hour)
                    </Text>
                    <View style={s.hourGrid}>
                      {FROM_HOURS.map(h => {
                        const active = config.timeGateStartHour === h;
                        return (
                          <Pressable
                            key={h}
                            style={[s.hourChip, active && s.hourChipActive]}
                            onPress={() => setFromHour(h)}
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
                    <Text style={[sectionTitleStyle, { color: dark ? '#6B7280' : '#94A3B8', marginBottom: 6 }]}>
                      UNTIL (hour)
                    </Text>
                    <View style={s.hourGrid}>
                      {UNTIL_HOURS.map(h => {
                        const active = config.timeGateEndHour === h;
                        return (
                          <Pressable
                            key={h}
                            style={[s.hourChip, active && s.hourChipActive]}
                            onPress={() => setUntilHour(h)}
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
                {timeGateInvalid && (
                  <View style={s.warning}>
                    <AlertTriangle color="#F59E0B" size={13} strokeWidth={2.5} />
                    <Text style={s.warningText}>
                      "Until" must be later than "From" hour.
                    </Text>
                  </View>
                )}

                {/* Active days */}
                <Text style={[sectionTitleStyle, {
                  color: dark ? '#6B7280' : '#94A3B8',
                  marginTop: 14,
                  marginBottom: 6,
                }]}>
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
                          {day.slice(0, 3)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* ── CRITICAL TASK ──────────────────────────────────────────────── */}
          <View style={[s.block, s.boxed]}>
            <View style={s.toggleRow}>
              <AlertTriangle
                color={config.isCritical ? '#EF4444' : (dark ? '#6B7280' : '#94A3B8')}
                size={15}
                strokeWidth={2.4}
              />
              <View style={s.toggleTextGroup}>
                <Text style={[s.toggleTitle, config.isCritical && { color: '#EF4444' }]}>
                  🚨 Critical Task
                </Text>
                <Text style={s.toggleSub}>
                  Override silent mode & max volume when alarm fires.
                </Text>
              </View>
              <Switch
                value={config.isCritical}
                onValueChange={setCritical}
                trackColor={{ false: dark ? '#374151' : '#E2E8F0', true: '#EF4444' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={dark ? '#374151' : '#E2E8F0'}
              />
            </View>
          </View>

          {/* ── LOCATION CHECKLIST ─────────────────────────────────────────── */}
          <View style={[s.block, s.boxed]}>
            {/* Header */}
            <View style={s.checkHeader}>
              <List color={dark ? '#34D399' : '#10B981'} size={15} strokeWidth={2.4} />
              <View style={s.toggleTextGroup}>
                <Text style={s.toggleTitle}>📋 LOCATION CHECKLIST</Text>
                <Text style={s.toggleSub}>
                  Items shown when you arrive (e.g. Shopping List)
                </Text>
              </View>
            </View>

            {/* Items */}
            {config.checklist.length > 0 && (
              <View style={s.checkList}>
                {config.checklist.map(item => (
                  <View key={item.id} style={s.checkItem}>
                    <View style={s.checkDot} />
                    <Text style={s.checkItemText} numberOfLines={2}>
                      {item.text}
                    </Text>
                    <Pressable onPress={() => removeItem(item.id)} hitSlop={10}>
                      <X color={dark ? '#6B7280' : '#94A3B8'} size={15} strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Add input */}
            <View style={s.checkInputRow}>
              <TextInput
                style={s.checkInput}
                placeholder="Add checklist item..."
                placeholderTextColor={dark ? '#4B5563' : '#94A3B8'}
                value={checklistInput}
                onChangeText={setChecklistInput}
                onSubmitEditing={addItem}
                returnKeyType="done"
              />
              <Pressable
                style={[s.checkAddBtn, !checklistInput.trim() && { opacity: 0.4 }]}
                onPress={addItem}
                disabled={!checklistInput.trim()}
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

function getStyles(dark: boolean) {
  const border   = dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const surface  = dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
  const textMain = dark ? '#E5E7EB' : '#111827';
  const textSub  = dark ? '#6B7280' : '#94A3B8';

  return StyleSheet.create({

    // ── Card shell ──────────────────────────────────────────────────────────
    card: {
      marginTop: 20,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: dark ? 'rgba(99,102,241,0.3)' : '#E0DCFB',
      backgroundColor: dark ? '#161424' : '#F8F7FE',
      overflow: 'hidden',
      shadowColor: dark ? '#000' : '#4F46E5',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: dark ? 0.35 : 0.06,
      shadowRadius: 16,
      elevation: 4,
    },

    // ── Header ──────────────────────────────────────────────────────────────
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    headerIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: dark ? 'rgba(99,102,241,0.2)' : '#EDEAFD',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14,
      color: dark ? '#A78BFA' : '#4F46E5',
      letterSpacing: -0.1,
    },
    headerSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11,
      color: textSub,
      marginTop: 1,
    },

    // ── Body ────────────────────────────────────────────────────────────────
    body: {
      paddingHorizontal: 14,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: dark ? 'rgba(255,255,255,0.06)' : '#EAE7FB',
    },

    block: {
      marginTop: 14,
    },
    boxed: {
      backgroundColor: surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: border,
      padding: 12,
    },

    // label row (label + badge side by side)
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    radiusTag: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 11,
      color: dark ? '#A78BFA' : '#4F46E5',
    },

    // ── Arrive / Leave segment ───────────────────────────────────────────────
    segRow: {
      flexDirection: 'row',
      backgroundColor: dark ? 'rgba(255,255,255,0.06)' : '#EDEAFD',
      borderRadius: 12,
      padding: 3,
      gap: 3,
    },
    seg: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6,
    },
    segActive: {
      backgroundColor: '#4F46E5',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 3,
    },
    segText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: dark ? '#6B7280' : '#94A3B8',
    },
    segTextActive: {
      color: '#FFFFFF',
    },

    // ── Radius ──────────────────────────────────────────────────────────────
    radiusRow: {
      flexDirection: 'row',
      gap: 7,
    },
    radiusChip: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1.2,
      borderColor: border,
      backgroundColor: surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radiusChipActive: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
      shadowColor: '#F97316',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 3,
    },
    radiusText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
      color: textSub,
    },
    radiusTextActive: {
      color: '#FFFFFF',
      fontFamily: 'Poppins_700Bold',
    },

    // ── Toggle rows ─────────────────────────────────────────────────────────
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toggleTextGroup: {
      flex: 1,
    },
    toggleTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 12.5,
      color: textMain,
    },
    toggleSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 10.5,
      color: textSub,
      marginTop: 3,
      lineHeight: 15,
    },

    // ── Time-gate inner ─────────────────────────────────────────────────────
    timeGateInner: {
      marginTop: 12,
    },
    hoursRow: {
      flexDirection: 'row',
      gap: 10,
    },
    hourCol: {
      flex: 1,
    },
    hourGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    hourChip: {
      paddingHorizontal: 7,
      paddingVertical: 5,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surface,
    },
    hourChipActive: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
    },
    hourText: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 11,
      color: textSub,
    },
    hourTextActive: {
      color: '#FFFFFF',
      fontFamily: 'Poppins_700Bold',
    },

    // ── Validation warning ───────────────────────────────────────────────────
    warning: {
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

    // ── Days ────────────────────────────────────────────────────────────────
    daysRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    dayChip: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 9,
      borderWidth: 1.2,
      borderColor: border,
      backgroundColor: surface,
    },
    dayChipActive: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
    },
    dayText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11.5,
      color: textSub,
    },
    dayTextActive: {
      color: '#FFFFFF',
    },

    // ── Checklist ───────────────────────────────────────────────────────────
    checkHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 10,
    },
    checkList: {
      gap: 6,
      marginBottom: 10,
    },
    checkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: border,
    },
    checkDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: dark ? '#6366F1' : '#4F46E5',
      flexShrink: 0,
    },
    checkItemText: {
      flex: 1,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: textMain,
    },
    checkInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkInput: {
      flex: 1,
      height: 44,
      backgroundColor: surface,
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: border,
      paddingHorizontal: 14,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: textMain,
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
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 3,
    },
  });
}
