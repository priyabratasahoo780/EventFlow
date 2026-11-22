// Geofence Reminder Section — Ultra Polished UI/UX
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
  X,
  Plus,
  Navigation2,
  List,
  Minus,
  Check,
  Briefcase,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react-native';
import { useThemeStore } from '../store/useThemeStore';
import { ChecklistItem } from '../models/Event';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

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

const RADII = [
  { label: '100m', val: 100 },
  { label: '250m', val: 250 },
  { label: '500m', val: 500 },
  { label: '1km', val: 1000 },
];

const PRESETS = [
  { label: 'Work (9-5)', icon: Briefcase, start: 9, end: 17 },
  { label: 'Morning (8-1)', icon: Sun, start: 8, end: 13 },
  { label: 'Evening (5-9)', icon: Sunset, start: 17, end: 21 },
  { label: 'All Day', icon: Moon, start: 0, end: 24 },
];

const FROM_HOURS = [6, 7, 8, 9, 10, 11, 12];
const UNTIL_HOURS = [13, 14, 15, 16, 17, 18, 19, 20];

const DAYS = [
  { key: 'Monday', short: 'Mon' },
  { key: 'Tuesday', short: 'Tue' },
  { key: 'Wednesday', short: 'Wed' },
  { key: 'Thursday', short: 'Thu' },
  { key: 'Friday', short: 'Fri' },
  { key: 'Saturday', short: 'Sat' },
  { key: 'Sunday', short: 'Sun' },
];

const formatHourDisplay = (h: number): string => {
  if (h === 0 || h === 24) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  if (h > 12) return `${h - 12}:00 PM`;
  return `${h}:00 AM`;
};

function anim() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export default function GeofenceReminderSection({ config, hasLocation, onChange }: Props) {
  const { isDark } = useThemeStore();
  const dark = isDark();
  const c = colors(dark);
  const s = styles(dark);

  const [checklistInput, setChecklistInput] = useState('');

  const setEnabled = (v: boolean) => {
    if (!hasLocation && v) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    anim();
    onChange({ locationReminderEnabled: v });
  };

  const addItem = () => {
    const text = checklistInput.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({ checklist: [...config.checklist, { id: `${Date.now()}`, text, completed: false }] });
    setChecklistInput('');
  };

  const removeItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({ checklist: config.checklist.filter((ci) => ci.id !== id) });
  };

  const toggleDay = (key: string) => {
    Haptics.selectionAsync();
    const next = config.timeGateDays.includes(key)
      ? config.timeGateDays.filter((d) => d !== key)
      : [...config.timeGateDays, key];
    onChange({ timeGateDays: next });
  };

  const stepHour = (type: 'start' | 'end', delta: number) => {
    Haptics.selectionAsync();
    if (type === 'start') {
      const next = Math.max(0, Math.min(23, config.timeGateStartHour + delta));
      onChange({ timeGateStartHour: next });
    } else {
      const next = Math.max(1, Math.min(24, config.timeGateEndHour + delta));
      onChange({ timeGateEndHour: next });
    }
  };

  const timeGateInvalid =
    config.timeGateEnabled &&
    config.timeGateStartHour !== 0 &&
    config.timeGateEndHour !== 24 &&
    config.timeGateEndHour <= config.timeGateStartHour;

  return (
    <View style={s.card}>
      {/* ── 1. MASTER HEADER & TOGGLE ── */}
      <View style={s.headerRow}>
        <View style={s.iconBox}>
          <MapPin color={dark ? '#A78BFA' : '#6366F1'} size={18} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Location Reminder</Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {!hasLocation
              ? 'Set a location pin above first'
              : config.locationReminderEnabled
              ? '📍 Geofence actively watching'
              : 'Trigger alarms on arrival or departure'}
          </Text>
        </View>
        <Switch
          value={config.locationReminderEnabled}
          onValueChange={setEnabled}
          trackColor={{ false: c.switchOff, true: '#6366F1' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={c.switchOff}
          disabled={!hasLocation}
          style={{ opacity: hasLocation ? 1 : 0.4 }}
        />
      </View>

      {/* ── 2. EXPANDED CONTENT ── */}
      {config.locationReminderEnabled && (
        <View style={s.body}>
          {/* Trigger Segmented Control */}
          <View style={s.section}>
            <Text style={s.sLabel}>TRIGGER EVENT</Text>
            <View style={s.segWrap}>
              {(['arrive', 'leave'] as const).map((type) => {
                const active = config.triggerType === type;
                return (
                  <Pressable
                    key={type}
                    style={[s.seg, active && s.segOn]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onChange({ triggerType: type });
                    }}
                  >
                    <Navigation2
                      color={active ? '#FFF' : c.muted}
                      size={14}
                      strokeWidth={2.5}
                      style={{ transform: [{ rotate: type === 'leave' ? '180deg' : '0deg' }] }}
                    />
                    <Text style={[s.segTxt, active && s.segTxtOn]}>
                      {type === 'arrive' ? 'When I Arrive' : 'When I Leave'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Radius Selector */}
          <View style={s.section}>
            <Text style={s.sLabel}>GEOFENCE RADIUS</Text>
            <View style={s.radiusRow}>
              {RADII.map((r) => {
                const on = config.geofenceRadius === r.val;
                return (
                  <Pressable
                    key={r.val}
                    style={[s.rChip, on && s.rChipOn]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onChange({ geofenceRadius: r.val });
                    }}
                  >
                    <Text style={[s.rTxt, on && s.rTxtOn]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── 3. TIME-GATE WINDOW BOX ── */}
          <View style={[s.section, s.box]}>
            <View style={s.rowBetween}>
              <View style={s.rowGap}>
                <Clock color="#F59E0B" size={16} strokeWidth={2.4} />
                <View>
                  <Text style={s.boxTitle}>Time-Gate Reminder</Text>
                  <Text style={s.boxSub}>Only trigger alarm within this schedule</Text>
                </View>
              </View>
              <Switch
                value={config.timeGateEnabled}
                onValueChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  anim();
                  onChange({ timeGateEnabled: v });
                }}
                trackColor={{ false: c.switchOff, true: '#FF7A00' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={c.switchOff}
              />
            </View>

            {config.timeGateEnabled && (
              <View style={{ marginTop: 14 }}>
                {/* Quick Presets */}
                <Text style={s.subSectionLabel}>QUICK PRESETS</Text>
                <View style={s.presetRow}>
                  {PRESETS.map((preset) => {
                    const active =
                      config.timeGateStartHour === preset.start &&
                      config.timeGateEndHour === preset.end;
                    const IconComp = preset.icon;
                    return (
                      <Pressable
                        key={preset.label}
                        style={[s.presetChip, active && s.presetChipActive]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          onChange({
                            timeGateStartHour: preset.start,
                            timeGateEndHour: preset.end,
                          });
                        }}
                      >
                        <IconComp color={active ? '#FFF' : c.muted} size={12} strokeWidth={2.4} />
                        <Text style={[s.presetTxt, active && s.presetTxtActive]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Symmetrical Hour Selector Columns */}
                <View style={s.hoursContainer}>
                  {/* FROM COLUMN */}
                  <View style={s.hourCol}>
                    <Text style={s.colHeader}>FROM</Text>
                    <View style={s.stepperBox}>
                      <Pressable
                        onPress={() => stepHour('start', -1)}
                        style={s.stepperBtn}
                        hitSlop={6}
                      >
                        <Minus color={c.muted} size={14} strokeWidth={2.6} />
                      </Pressable>
                      <Text style={s.stepperValue}>
                        {formatHourDisplay(config.timeGateStartHour)}
                      </Text>
                      <Pressable
                        onPress={() => stepHour('start', 1)}
                        style={s.stepperBtn}
                        hitSlop={6}
                      >
                        <Plus color={c.muted} size={14} strokeWidth={2.6} />
                      </Pressable>
                    </View>

                    {/* Symmetrical 2-per-row chips */}
                    <View style={s.hourWrapGrid}>
                      {FROM_HOURS.map((h) => {
                        const on = config.timeGateStartHour === h;
                        return (
                          <Pressable
                            key={h}
                            style={[s.hChip, on && s.hChipOn]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              onChange({ timeGateStartHour: h });
                            }}
                          >
                            <Text style={[s.hTxt, on && s.hTxtOn]}>{h}:00</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={s.hourDivider} />

                  {/* UNTIL COLUMN */}
                  <View style={s.hourCol}>
                    <Text style={s.colHeader}>UNTIL</Text>
                    <View style={s.stepperBox}>
                      <Pressable
                        onPress={() => stepHour('end', -1)}
                        style={s.stepperBtn}
                        hitSlop={6}
                      >
                        <Minus color={c.muted} size={14} strokeWidth={2.6} />
                      </Pressable>
                      <Text style={s.stepperValue}>
                        {formatHourDisplay(config.timeGateEndHour)}
                      </Text>
                      <Pressable
                        onPress={() => stepHour('end', 1)}
                        style={s.stepperBtn}
                        hitSlop={6}
                      >
                        <Plus color={c.muted} size={14} strokeWidth={2.6} />
                      </Pressable>
                    </View>

                    {/* Symmetrical 2-per-row chips */}
                    <View style={s.hourWrapGrid}>
                      {UNTIL_HOURS.map((h) => {
                        const on = config.timeGateEndHour === h;
                        return (
                          <Pressable
                            key={h}
                            style={[s.hChip, on && s.hChipOn]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              onChange({ timeGateEndHour: h });
                            }}
                          >
                            <Text style={[s.hTxt, on && s.hTxtOn]}>{h}:00</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Validation Warning */}
                {timeGateInvalid && (
                  <View style={s.warn}>
                    <AlertTriangle color="#F59E0B" size={13} strokeWidth={2.5} />
                    <Text style={s.warnTxt}>
                      "Until" time must be later than "From" time.
                    </Text>
                  </View>
                )}

                {/* Active Days (Even 7-day pill row) */}
                <Text style={[s.subSectionLabel, { marginTop: 14 }]}>ACTIVE DAYS</Text>
                <View style={s.daysRow}>
                  {DAYS.map((d) => {
                    const on = config.timeGateDays.includes(d.key);
                    return (
                      <Pressable
                        key={d.key}
                        style={[s.dayChip, on && s.dayChipOn]}
                        onPress={() => toggleDay(d.key)}
                      >
                        <Text style={[s.dayTxt, on && s.dayTxtOn]}>{d.short}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* ── 4. CRITICAL TASK BOX ── */}
          <View style={[s.section, s.box]}>
            <View style={s.rowBetween}>
              <View style={s.rowGap}>
                <AlertTriangle
                  color={config.isCritical ? '#EF4444' : c.muted}
                  size={16}
                  strokeWidth={2.4}
                />
                <View>
                  <Text style={[s.boxTitle, config.isCritical && { color: '#EF4444' }]}>
                    Critical Task Override
                  </Text>
                  <Text style={s.boxSub}>
                    Rings at maximum volume even if phone is on silent
                  </Text>
                </View>
              </View>
              <Switch
                value={config.isCritical}
                onValueChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  anim();
                  onChange({ isCritical: v });
                }}
                trackColor={{ false: c.switchOff, true: '#EF4444' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={c.switchOff}
              />
            </View>
          </View>

          {/* ── 5. LOCATION CHECKLIST BOX ── */}
          <View style={[s.section, s.box]}>
            <View style={[s.rowGap, { marginBottom: 6 }]}>
              <List color="#10B981" size={16} strokeWidth={2.4} />
              <View>
                <Text style={s.boxTitle}>Location Checklist</Text>
                <Text style={s.boxSub}>
                  Items to show upon arrival (e.g. Shopping List)
                </Text>
              </View>
            </View>

            {config.checklist.length > 0 && (
              <View style={{ marginTop: 8, gap: 6 }}>
                {config.checklist.map((item) => (
                  <View key={item.id} style={s.clItem}>
                    <View style={s.clDot} />
                    <Text style={s.clTxt} numberOfLines={2}>
                      {item.text}
                    </Text>
                    <Pressable onPress={() => removeItem(item.id)} hitSlop={12}>
                      <X color={c.muted} size={14} strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={s.clInputRow}>
              <TextInput
                style={s.clInput}
                placeholder="Add checklist item..."
                placeholderTextColor={c.placeholder}
                value={checklistInput}
                onChangeText={setChecklistInput}
                onSubmitEditing={addItem}
                returnKeyType="done"
              />
              <Pressable
                style={[s.clAddBtn, !checklistInput.trim() && { opacity: 0.4 }]}
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

function colors(dark: boolean) {
  return {
    border: dark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
    surface: dark ? '#1A182E' : '#FFFFFF',
    cardBg: dark ? '#131122' : '#F8FAFC',
    muted: dark ? '#94A3B8' : '#64748B',
    text: dark ? '#F8FAFC' : '#0F172A',
    switchOff: dark ? '#334155' : '#CBD5E1',
    placeholder: dark ? '#475569' : '#94A3B8',
  };
}

function styles(dark: boolean) {
  const c = colors(dark);

  return StyleSheet.create({
    card: {
      marginTop: 20,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: dark ? 'rgba(99,102,241,0.25)' : '#E2E8F0',
      backgroundColor: c.cardBg,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: dark ? 0.35 : 0.05,
      shadowRadius: 16,
      elevation: 4,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    iconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: dark ? 'rgba(99,102,241,0.18)' : '#EDEAFD',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14,
      color: dark ? '#A78BFA' : '#4F46E5',
      letterSpacing: -0.2,
    },
    headerSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11,
      color: c.muted,
      marginTop: 1,
    },
    body: {
      paddingHorizontal: 14,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    section: {
      marginTop: 14,
    },
    box: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
    },
    sLabel: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 11,
      letterSpacing: 0.6,
      color: c.muted,
      marginBottom: 8,
    },
    subSectionLabel: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 10,
      letterSpacing: 0.6,
      color: c.muted,
      marginBottom: 6,
    },
    boxTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 13,
      color: c.text,
    },
    boxSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 10.5,
      color: c.muted,
      marginTop: 2,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowGap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    segWrap: {
      flexDirection: 'row',
      backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#EDEAFD',
      borderRadius: 12,
      padding: 3,
      gap: 4,
    },
    seg: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      gap: 8,
    },
    segOn: {
      backgroundColor: '#4F46E5',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 3,
    },
    segTxt: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12.5,
      color: c.muted,
    },
    segTxtOn: {
      color: '#FFFFFF',
    },
    radiusRow: {
      flexDirection: 'row',
      gap: 8,
    },
    rChip: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1.2,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    rChipOn: {
      backgroundColor: '#FF7A00',
      borderColor: '#FF7A00',
      shadowColor: '#FF7A00',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    rTxt: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 12,
      color: c.muted,
    },
    rTxtOn: {
      color: '#FFFFFF',
      fontFamily: 'Poppins_700Bold',
    },
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    presetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: dark ? 'rgba(255,255,255,0.03)' : '#F1F5F9',
    },
    presetChipActive: {
      backgroundColor: '#FF7A00',
      borderColor: '#FF7A00',
    },
    presetTxt: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 10.5,
      color: c.muted,
    },
    presetTxtActive: {
      color: '#FFFFFF',
      fontFamily: 'Poppins_600SemiBold',
    },
    hoursContainer: {
      flexDirection: 'row',
      gap: 10,
    },
    hourCol: {
      flex: 1,
    },
    colHeader: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 10,
      letterSpacing: 0.6,
      color: c.muted,
      marginBottom: 4,
    },
    stepperBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 6,
      marginBottom: 8,
    },
    stepperBtn: {
      width: 24,
      height: 24,
      borderRadius: 6,
      backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 11.5,
      color: c.text,
    },
    hourDivider: {
      width: 1,
      backgroundColor: c.border,
      marginVertical: 4,
    },
    hourWrapGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    hChip: {
      width: '30%',
      paddingVertical: 6,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: dark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    hChipOn: {
      backgroundColor: '#FF7A00',
      borderColor: '#FF7A00',
    },
    hTxt: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 10.5,
      color: c.muted,
    },
    hTxtOn: {
      color: '#FFFFFF',
      fontFamily: 'Poppins_700Bold',
    },
    warn: {
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
    warnTxt: {
      fontFamily: 'Poppins_500Medium',
      fontSize: 10.5,
      color: '#D97706',
      flex: 1,
    },
    daysRow: {
      flexDirection: 'row',
      gap: 5,
    },
    dayChip: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1.2,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    dayChipOn: {
      backgroundColor: '#FF7A00',
      borderColor: '#FF7A00',
    },
    dayTxt: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 10.5,
      color: c.muted,
    },
    dayTxtOn: {
      color: '#FFFFFF',
    },
    clItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    clDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: '#10B981',
    },
    clTxt: {
      flex: 1,
      fontFamily: 'Poppins_500Medium',
      fontSize: 12.5,
      color: c.text,
    },
    clInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    clInput: {
      flex: 1,
      height: 40,
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      fontFamily: 'Poppins_500Medium',
      fontSize: 12.5,
      color: c.text,
    },
    clAddBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: '#FF7A00',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
