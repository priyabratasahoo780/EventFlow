// Geofence Reminder Section
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
  ScrollView,
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
  ChevronRight,
} from 'lucide-react-native';
import { useThemeStore } from '../store/useThemeStore';
import { ChecklistItem } from '../models/Event';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

//  Types

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

// Constants 

const RADII = [
  { label: '100m',  val: 100  },
  { label: '250m',  val: 250  },
  { label: '500m',  val: 500  },
  { label: '1km',   val: 1000 },
];

// 3-per-row for FROM (6 → 12 = 7 hours)
const FROM_HOURS  = [6, 7, 8, 9, 10, 11, 12];
// 2-per-row for UNTIL (13 → 20 = 8 hours)
const UNTIL_HOURS = [13, 14, 15, 16, 17, 18, 19, 20];

const DAYS = [
  { key: 'Monday',    short: 'Mon' },
  { key: 'Tuesday',   short: 'Tue' },
  { key: 'Wednesday', short: 'Wed' },
  { key: 'Thursday',  short: 'Thu' },
  { key: 'Friday',    short: 'Fri' },
  { key: 'Saturday',  short: 'Sat' },
  { key: 'Sunday',    short: 'Sun' },
];

function anim() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

//  Main Component 

export default function GeofenceReminderSection({ config, hasLocation, onChange }: Props) {
  const { isDark } = useThemeStore();
  const dark = isDark();
  const c = colors(dark);
  const s = styles(dark);

  const [checklistInput, setChecklistInput] = useState('');

  //  Handlers 

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
    onChange({ checklist: config.checklist.filter(ci => ci.id !== id) });
  };

  const toggleDay = (key: string) => {
    Haptics.selectionAsync();
    const next = config.timeGateDays.includes(key)
      ? config.timeGateDays.filter(d => d !== key)
      : [...config.timeGateDays, key];
    onChange({ timeGateDays: next });
  };

  const timeGateInvalid = config.timeGateEnabled && config.timeGateEndHour <= config.timeGateStartHour;

  //  Render 

  return (
    <View style={s.card}>

      {/*  HEADER + MASTER TOGGLE  */}
      <View style={s.headerRow}>
        <View style={[s.iconBox, { backgroundColor: dark ? 'rgba(99,102,241,0.18)' : '#EDEAFD' }]}>
          <MapPin color={dark ? '#A78BFA' : '#6366F1'} size={18} strokeWidth={2.3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: dark ? '#A78BFA' : '#4F46E5' }]}>
            Location Reminder
          </Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {!hasLocation
              ? 'Set a location above to enable'
              : config.locationReminderEnabled
              ? '📍 Geofence active & watching'
              : 'Enable to trigger alarm on arrival'}
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

      {/*  BODY */}
      {config.locationReminderEnabled && (
        <View style={s.body}>

          {/*  TRIGGER  */}
          <View style={s.section}>
            <Text style={s.sLabel}>TRIGGER WHEN I...</Text>
            <View style={s.segWrap}>
              {(['arrive', 'leave'] as const).map(type => {
                const active = config.triggerType === type;
                return (
                  <Pressable
                    key={type}
                    style={[s.seg, active && s.segOn]}
                    onPress={() => { Haptics.selectionAsync(); onChange({ triggerType: type }); }}
                  >
                    <Navigation2
                      color={active ? '#FFF' : c.muted}
                      size={13}
                      strokeWidth={2.5}
                      style={{ transform: [{ rotate: type === 'leave' ? '180deg' : '0deg' }] }}
                    />
                    <Text style={[s.segTxt, active && s.segTxtOn]}>
                      {type === 'arrive' ? 'Arrive' : 'Leave'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── RADIUS */}
          <View style={[s.section, { marginBottom: 6 }]}>
            <Text style={s.sLabel}>RADIUS</Text>
            <View style={s.radiusRow}>
              {RADII.map(r => {
                const on = config.geofenceRadius === r.val;
                return (
                  <Pressable
                    key={r.val}
                    style={[s.rChip, on && s.rChipOn]}
                    onPress={() => { Haptics.selectionAsync(); onChange({ geofenceRadius: r.val }); }}
                  >
                    <Text style={[s.rTxt, on && s.rTxtOn]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── TIME-GATE  */}
          <View style={[s.section, s.box]}>
            {/* Toggle header */}
            <View style={s.rowBetween}>
              <View style={s.rowGap}>
                <Clock color={dark ? '#FCD34D' : '#D97706'} size={15} strokeWidth={2.4} />
                <Text style={[s.boxTitle, { color: dark ? '#E5E7EB' : '#111827' }]}>
                  TIME-GATE THIS REMINDER
                </Text>
              </View>
              <Switch
                value={config.timeGateEnabled}
                onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); anim(); onChange({ timeGateEnabled: v }); }}
                trackColor={{ false: c.switchOff, true: '#F97316' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={c.switchOff}
              />
            </View>
            <Text style={s.boxSub}>
              Alarm will only fire if triggered within this time window.
            </Text>

            {config.timeGateEnabled && (
              <View style={{ marginTop: 14 }}>

                {/* FROM + UNTIL side by side */}
                <View style={s.hoursContainer}>

                  {/* FROM column */}
                  <View style={s.hourCol}>
                    <Text style={[s.colLabel, { color: c.muted }]}>FROM (hour)</Text>
                    {/* 3 per row */}
                    {[0, 3, 6].map(rowStart => (
                      <View key={rowStart} style={s.hourRow3}>
                        {FROM_HOURS.slice(rowStart, rowStart + 3).map(h => {
                          const on = config.timeGateStartHour === h;
                          return (
                            <Pressable
                              key={h}
                              style={[s.hChip, on && s.hChipOn, { flex: 1 }]}
                              onPress={() => { Haptics.selectionAsync(); onChange({ timeGateStartHour: h }); }}
                            >
                              <Text style={[s.hTxt, on && s.hTxtOn]}>{h}:00</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>

                  {/* Divider */}
                  <View style={s.hourDivider} />

                  {/* UNTIL column */}
                  <View style={s.hourCol}>
                    <Text style={[s.colLabel, { color: c.muted }]}>UNTIL (hour)</Text>
                    {/* 2 per row */}
                    {[0, 2, 4, 6].map(rowStart => (
                      <View key={rowStart} style={s.hourRow2}>
                        {UNTIL_HOURS.slice(rowStart, rowStart + 2).map(h => {
                          const on = config.timeGateEndHour === h;
                          return (
                            <Pressable
                              key={h}
                              style={[s.hChip, on && s.hChipOn, { flex: 1 }]}
                              onPress={() => { Haptics.selectionAsync(); onChange({ timeGateEndHour: h }); }}
                            >
                              <Text style={[s.hTxt, on && s.hTxtOn]}>{h}:00</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Validation warning */}
                {timeGateInvalid && (
                  <View style={s.warn}>
                    <AlertTriangle color="#F59E0B" size={12} strokeWidth={2.5} />
                    <Text style={s.warnTxt}>"Until" must be later than "From" hour.</Text>
                  </View>
                )}

                {/* Active Days */}
                <Text style={[s.colLabel, { color: c.muted, marginTop: 14, marginBottom: 8 }]}>
                  ACTIVE DAYS
                </Text>
                <View style={s.daysRow}>
                  {DAYS.map(d => {
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

          {/* ── CRITICAL TASK  */}
          <View style={[s.section, s.box]}>
            <View style={s.rowBetween}>
              <View style={s.rowGap}>
                <AlertTriangle
                  color={config.isCritical ? '#EF4444' : c.muted}
                  size={15}
                  strokeWidth={2.4}
                />
                <View>
                  <Text style={[s.boxTitle, config.isCritical && { color: '#EF4444' }]}>
                    Critical Task
                  </Text>
                  <Text style={s.boxSub}>
                    Override silent mode & max volume when{'\n'}alarm fires.
                  </Text>
                </View>
              </View>
              <Switch
                value={config.isCritical}
                onValueChange={v => {
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

          {/* ── LOCATION CHECKLIST  */}
          <View style={[s.section, s.box]}>
            {/* Title */}
            <View style={[s.rowGap, { marginBottom: 4 }]}>
              <List color={dark ? '#34D399' : '#10B981'} size={15} strokeWidth={2.4} />
              <View>
                <Text style={[s.boxTitle, { color: dark ? '#E5E7EB' : '#111827' }]}>
                  LOCATION CHECKLIST
                  <Text style={[s.boxTitle, { color: c.muted, fontFamily: 'Poppins_500Medium' }]}>
                    {' '}(OPTIONAL)
                  </Text>
                </Text>
                <Text style={s.boxSub}>
                  Items shown when you arrive (e.g. Shopping List)
                </Text>
              </View>
            </View>

            {/* Items list */}
            {config.checklist.length > 0 && (
              <View style={{ marginTop: 10, gap: 6 }}>
                {config.checklist.map(item => (
                  <View key={item.id} style={s.clItem}>
                    <View style={s.clDot} />
                    <Text style={s.clTxt} numberOfLines={2}>{item.text}</Text>
                    <Pressable onPress={() => removeItem(item.id)} hitSlop={12}>
                      <X color={c.muted} size={14} strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Add input */}
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

// ─── Color tokens 

function colors(dark: boolean) {
  return {
    border:      dark ? 'rgba(255,255,255,0.09)' : '#E5E7EB',
    surface:     dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    muted:       dark ? '#6B7280' : '#94A3B8',
    text:        dark ? '#E5E7EB' : '#111827',
    switchOff:   dark ? '#374151' : '#D1D5DB',
    placeholder: dark ? '#4B5563' : '#94A3B8',
  };
}

// ─── Styles 

function styles(dark: boolean) {
  const c      = colors(dark);
  const radius = 20;

  return StyleSheet.create({

    card: {
      marginTop: 20,
      borderRadius: radius,
      borderWidth: 1.5,
      borderColor: dark ? 'rgba(99,102,241,0.3)' : '#DDD9F9',
      backgroundColor: dark ? '#141222' : '#F9F8FE',
      overflow: 'hidden',
      shadowColor: dark ? '#000' : '#4F46E5',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: dark ? 0.4 : 0.07,
      shadowRadius: 18,
      elevation: 5,
    },

    // ── Header 
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 15,
      gap: 12,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 14.5,
      letterSpacing: -0.1,
    },
    headerSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 11,
      color: c.muted,
      marginTop: 1,
    },

    // ── Body 
    body: {
      paddingHorizontal: 14,
      paddingBottom: 18,
      borderTopWidth: 1,
      borderTopColor: dark ? 'rgba(255,255,255,0.06)' : '#EAE7FB',
    },

    section: { marginTop: 18 },

    box: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginTop: 18,
    },

    // ── Labels 
    sLabel: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 10.5,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: c.muted,
      marginBottom: 8,
    },
    boxTitle: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 12.5,
      color: c.text,
    },
    boxSub: {
      fontFamily: 'Poppins_400Regular',
      fontSize: 10.5,
      color: c.muted,
      marginTop: 2,
      lineHeight: 15,
    },
    colLabel: {
      fontFamily: 'Poppins_700Bold',
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 7,
    },

    // ── Layout helpers 
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowGap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      flex: 1,
    },

    // ── Arrive / Leave segment 
    segWrap: {
      flexDirection: 'row',
      backgroundColor: dark ? 'rgba(255,255,255,0.06)' : '#EDEAFD',
      borderRadius: 13,
      padding: 3,
      gap: 3,
    },
    seg: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 11,
      gap: 6,
    },
    segOn: {
      backgroundColor: '#4F46E5',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    segTxt: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 13,
      color: c.muted,
    },
    segTxtOn: { color: '#FFFFFF' },

    // ── Radius 
    radiusRow: {
      flexDirection: 'row',
      gap: 7,
      marginBottom: 8,
    },
    rChip: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1.3,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    rChipOn: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
      shadowColor: '#F97316',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
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

    // ── Hour grid 
    hoursContainer: {
      flexDirection: 'row',
      gap: 10,
    },
    hourCol: {
      flex: 1,
    },
    hourDivider: {
      width: 1,
      backgroundColor: c.border,
      marginVertical: 4,
    },
    hourRow3: {
      flexDirection: 'row',
      gap: 4,
      marginBottom: 4,
    },
    hourRow2: {
      flexDirection: 'row',
      gap: 4,
      marginBottom: 4,
    },
    hChip: {
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hChipOn: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
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

    // ── Validation warning 
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

    // ── Active days 
    daysRow: {
      flexDirection: 'row',
      gap: 5,
    },
    dayChip: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 9,
      borderWidth: 1.3,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    dayChipOn: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
    },
    dayTxt: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 10.5,
      color: c.muted,
    },
    dayTxtOn: {
      color: '#FFFFFF',
    },

    // ── Checklist 
    clItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    clDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: dark ? '#6366F1' : '#4F46E5',
      flexShrink: 0,
    },
    clTxt: {
      flex: 1,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: c.text,
    },
    clInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    clInput: {
      flex: 1,
      height: 44,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1.3,
      borderColor: c.border,
      paddingHorizontal: 14,
      fontFamily: 'Poppins_500Medium',
      fontSize: 13,
      color: c.text,
    },
    clAddBtn: {
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
