import { useMemo, useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  Modal, Animated, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEventStore } from '../../store/useEventStore';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import {
  Target, Check, Clock, PlayCircle, AlertTriangle,
  TrendingUp, ChevronDown, GraduationCap, Zap, X,
  Award, BarChart2, Flame, ChevronRight,
} from 'lucide-react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import * as Haptics from 'expo-haptics';
import { behaviorService } from '../../services/behaviorService';


type TimeFilter = 'week' | 'month' | 'year' | 'all';
const { width: SW } = Dimensions.get('window');

// ─── Circular Progress Ring ───────────────────────────────────────────────────
const RING = 170;
const SW2 = 16;
const R2 = (RING - SW2) / 2;
const CIRC = 2 * Math.PI * R2;

function ProgressRing({ rate, colors }: { rate: number; colors: ColorTheme }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: rate, duration: 1600,
      easing: Easing.out(Easing.exp), useNativeDriver: false,
    }).start();
  }, [rate]);

  const offset = anim.interpolate({
    inputRange: [0, 100], outputRange: [CIRC, 0],
  });

  return (
    <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
        <Defs>
          <SvgLinearGradient id="rg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <Stop offset="100%" stopColor="rgba(255,255,255,0.95)" />
          </SvgLinearGradient>
          <SvgLinearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <Stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
          </SvgLinearGradient>
        </Defs>
        {/* Outer glow ring */}
        <Circle cx={RING / 2} cy={RING / 2} r={R2 + SW2 / 2 + 5}
          stroke="rgba(255,255,255,0.08)" strokeWidth={12} fill="none" />
        {/* Track */}
        <Circle cx={RING / 2} cy={RING / 2} r={R2}
          stroke="url(#trackGrad)" strokeWidth={SW2} fill="none" />
        {/* Progress arc */}
        <Circle cx={RING / 2} cy={RING / 2} r={R2}
          stroke="url(#rg1)" strokeWidth={SW2} fill="none"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC - (CIRC * Math.min(rate, 100)) / 100}
          strokeLinecap="round" rotation="-90"
          origin={`${RING / 2}, ${RING / 2}`}
        />
      </Svg>
      {/* Inner glass circle */}
      <View style={rStyles.innerCircle}>
        <Text style={rStyles.rateNum}>{rate}<Text style={rStyles.ratePct}>%</Text></Text>
        <Text style={rStyles.rateLabel}>DONE</Text>
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  innerCircle: {
    width: RING - SW2 * 2 - 12,
    height: RING - SW2 * 2 - 12,
    borderRadius: (RING - SW2 * 2 - 12) / 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  rateNum: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 38, color: '#FFFFFF', letterSpacing: -2, lineHeight: 42,
  },
  ratePct: { fontSize: 22, letterSpacing: 0 },
  rateLabel: {
    fontFamily: 'Poppins_700Bold', fontSize: 9,
    color: 'rgba(255,255,255,0.6)', letterSpacing: 3,
  },
});

// ─── Animated Entry Wrapper ───────────────────────────────────────────────────
function FadeIn({ delay = 0, dy = 20, children }: { delay?: number; dy?: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(dy)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 550, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, tension: 65, friction: 11 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Premium Stat Pill ────────────────────────────────────────────────────────
function StatPill({
  icon, label, value, color, bg,
}: { icon: React.ReactNode; label: string; value: string | number; color: string; bg: string }) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 10 }).start();
  }, [value]);

  return (
    <View style={[pillStyles.pill, { backgroundColor: bg, borderColor: color + '30' }]}>
      {/* Gradient left accent bar */}
      <View style={[pillStyles.accentBar, { backgroundColor: color }]} />
      <View style={[pillStyles.iconBox, { backgroundColor: color + '20' }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[pillStyles.pillLabel, { color }]}>{label.toUpperCase()}</Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Text style={pillStyles.pillValue}>{value}</Text>
        </Animated.View>
      </View>
      <ChevronRight color={color + '60'} size={16} strokeWidth={2.5} />
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, padding: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    marginBottom: 10, overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    borderTopLeftRadius: 20, borderBottomLeftRadius: 20,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  pillLabel: {
    fontFamily: 'Poppins_700Bold', fontSize: 8, letterSpacing: 1.2, marginBottom: 2,
  },
  pillValue: {
    fontFamily: 'Poppins_800ExtraBold', fontSize: 22, color: '#182235', letterSpacing: -0.5,
  },
});

// ─── Premium Status Bar ───────────────────────────────────────────────────────
function StatusBar({
  label, count, total, color, icon, bg, textColor,
}: { label: string; count: number; total: number; color: string; icon: React.ReactNode; bg: string; textColor: string }) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const pct = total === 0 ? 0 : Math.min((count / total) * 100, 100);

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: pct, duration: 1100, delay: 400,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [pct]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={[sbStyles.row, { backgroundColor: bg, borderColor: color + '25' }]}>
      {/* Gradient icon box */}
      <View style={[sbStyles.iconBox, { backgroundColor: color + '20' }]}>{icon}</View>
      <View style={{ flex: 1, gap: 7 }}>
        <View style={sbStyles.topRow}>
          <Text style={[sbStyles.label, { color: textColor }]}>{label}</Text>
          <Text style={[sbStyles.count, { color }]}>{count}</Text>
        </View>
        {/* Animated bar track */}
        <View style={[sbStyles.trackBg, { backgroundColor: color + '15' }]}>
          <Animated.View style={[sbStyles.trackFill, { width: barWidth, backgroundColor: color }]} />
        </View>
        <Text style={[sbStyles.pct, { color: color + 'AA' }]}>{Math.round(pct)}% of total</Text>
      </View>
    </View>
  );
}

const sbStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 22, padding: 18, marginBottom: 10, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  count: { fontFamily: 'Poppins_800ExtraBold', fontSize: 22, letterSpacing: -0.5 },
  trackBg: {
    height: 7, borderRadius: 4, overflow: 'hidden',
  },
  trackFill: { height: 7, borderRadius: 4 },
  pct: { fontFamily: 'Poppins_500Medium', fontSize: 10 },
});

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, accentColor }: { title: string; subtitle?: string; accentColor: string }) {
  return (
    <View style={shStyles.wrap}>
      <LinearGradient
        colors={[accentColor, accentColor + 'AA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={shStyles.accent}
      />
      <View>
        <Text style={shStyles.title}>{title}</Text>
        {subtitle && <Text style={shStyles.sub}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const shStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, marginTop: 6 },
  accent: { width: 5, height: 36, borderRadius: 3 },
  title: { fontFamily: 'Poppins_800ExtraBold', fontSize: 17, color: '#182235', letterSpacing: -0.4 },
  sub: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: '#667085', marginTop: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StatisticsScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const { events } = useEventStore();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  // Load AI productivity insights from behavior records
  useEffect(() => {
    let cancelled = false;
    behaviorService.getAllRecords().then(records => {
      if (cancelled || records.length === 0) return;

      const insights: string[] = [];
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;

      // Insight 1: On-time vs late overall
      const onTime = records.filter(r => r.delayMins <= 15).length;
      const pct = Math.round((onTime / records.length) * 100);
      if (pct < 50) insights.push(`🚨 You complete ${100 - pct}% of tasks late. Consider scheduling 20% extra buffer time.`);
      else if (pct >= 80) insights.push(`✅ Great habit! You complete ${pct}% of tasks on time. Keep it up.`);
      else insights.push(`⏱️ You complete ${pct}% of tasks on time. Small optimizations can push this above 80%.`);

      // Insight 2: Worst delay category
      const catDelays: Record<string, number[]> = {};
      records.forEach(r => {
        if (!catDelays[r.category]) catDelays[r.category] = [];
        catDelays[r.category].push(r.delayMins);
      });
      const worstCat = Object.entries(catDelays)
        .map(([cat, delays]) => ({ cat, avg: delays.reduce((a, b) => a + b, 0) / delays.length }))
        .filter(x => x.avg > 30)
        .sort((a, b) => b.avg - a.avg)[0];
      if (worstCat) insights.push(`📌 ${worstCat.cat.charAt(0).toUpperCase() + worstCat.cat.slice(1)} tasks run ${Math.round(worstCat.avg)} min late on average. Schedule them earlier in the day.`);

      // Insight 3: Best productive hour
      const hourCounts: Record<number, number> = {};
      records.filter(r => r.delayMins <= 15).forEach(r => {
        const h = new Date(r.completedMs).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      });
      const bestHour = Object.entries(hourCounts).sort((a, b) => +b[1] - +a[1])[0];
      if (bestHour) {
        const h = parseInt(bestHour[0], 10);
        const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
        insights.push(`✨ You are most productive around ${label}. Schedule your hardest tasks then.`);
      }

      // Insight 4: Duration accuracy
      const withBoth = records.filter(r => r.estimatedDuration > 0 && r.actualDuration > 0);
      if (withBoth.length >= 3) {
        const avgRatio = withBoth.reduce((s, r) => s + r.actualDuration / r.estimatedDuration, 0) / withBoth.length;
        if (avgRatio > 1.3) insights.push(`📊 You underestimate task duration by ${Math.round((avgRatio - 1) * 100)}%. Use the AI suggestion when adding tasks.`);
        else if (avgRatio < 0.8) insights.push(`📊 You overestimate task duration by ${Math.round((1 - avgRatio) * 100)}%. You may be padding too much.`);
        else insights.push(`⚖️ Your duration estimates are accurate (within 20%). Well planned!`);
      }

      // Insight 5: Week-over-week trend
      const thisWeek = records.filter(r => r.completedMs > now - weekMs).length;
      const lastWeek = records.filter(r => r.completedMs > now - 2 * weekMs && r.completedMs <= now - weekMs).length;
      if (lastWeek > 0) {
        const change = thisWeek - lastWeek;
        if (change > 0) insights.push(`📈 You completed ${change} more tasks this week vs last week. Momentum is building!`);
        else if (change < 0) insights.push(`📉 You completed ${Math.abs(change)} fewer tasks this week vs last week. What changed?`);
      }

      if (!cancelled) setAiInsights(insights.slice(0, 4));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [events]);


  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter(e => {
      if (!e.date) return true;
      const ed = new Date(e.date);
      if (timeFilter === 'all') return true;
      if (timeFilter === 'week') {
        const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const sow = new Date(now); sow.setDate(now.getDate() - day); sow.setHours(0, 0, 0, 0);
        const eow = new Date(sow); eow.setDate(sow.getDate() + 6); eow.setHours(23, 59, 59, 999);
        return ed >= sow && ed <= eow;
      }
      if (timeFilter === 'month') return now.getMonth() === ed.getMonth() && now.getFullYear() === ed.getFullYear();
      if (timeFilter === 'year') return now.getFullYear() === ed.getFullYear();
      return true;
    });
  }, [events, timeFilter]);

  const stats = useMemo(() => {
    const total = filteredEvents.length;
    let completed = 0, lateCompleted = 0, inProgress = 0, overdue = 0, pending = 0;
    const now = new Date();
    filteredEvents.forEach(e => {
      const isLateCompleted = (e.status as string) === 'late_completed';
      const isCompleted = e.completed || e.status === 'completed';
      const isInProgress = e.status === 'in_progress';
      const dateStr = e.date ? e.date.split('T')[0] : '';
      const timeStr = e.time || '23:59';
      let isOverdue = false;
      if (dateStr) {
        const dl = new Date(`${dateStr}T${timeStr.length <= 5 ? timeStr + ':00' : timeStr}`);
        isOverdue = dl < now;
      }
      
      if (isLateCompleted) lateCompleted++;
      else if (isCompleted) completed++;
      else if (isOverdue) overdue++;
      else if (isInProgress) inProgress++;
      else pending++;
    });

    const completionRate = total === 0 ? 0 : Math.round(((completed + lateCompleted) / total) * 100);
    let totalFocusMins = 0;
    filteredEvents.forEach(e => {
      if (e.completed && e.startedAt && e.completedAt) {
        totalFocusMins += Math.max(1, Math.round((new Date(e.completedAt).getTime() - new Date(e.startedAt).getTime()) / (1000 * 60)));
      } else if (e.completed) totalFocusMins += (e.estimatedDuration || 30);
    });

    const catCount: Record<string, number> = {};
    filteredEvents.forEach(e => { const c = e.category || 'Other'; catCount[c] = (catCount[c] || 0) + 1; });
    const topPair = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    const topCategory = total === 0 ? 'None' : (topPair ? topPair[0] : 'Academic');

    const fh = Math.floor(totalFocusMins / 60), fm = totalFocusMins % 60;
    const focusTime = totalFocusMins === 0 ? '0 min' : fh > 0 ? `${fh}h ${fm}m` : `${fm}m`;

    return { total, completed, lateCompleted, inProgress, pending, overdue, completionRate, focusTime, topCategory };
  }, [filteredEvents]);

  // Weekly bar chart data (last 7 days)
  const barData = useMemo(() => {
    const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    const now = new Date();
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    return days.map((label, i) => {
      const d = new Date(now); d.setDate(now.getDate() - day + i); d.setHours(0, 0, 0, 0);
      const de = new Date(d); de.setHours(23, 59, 59, 999);
      const count = events.filter(e => {
        if (!e.date) return false;
        const ed = new Date(e.date);
        return (e.completed || e.status === 'completed') && ed >= d && ed <= de;
      }).length;
      const isToday = i === day;
      return {
        value: count,
        label,
        frontColor: isToday ? colors.secondary : colors.primary + 'BB',
        gradientColor: isToday ? colors.secondary + '44' : colors.primary + '22',
        topLabelComponent: count > 0 ? () => (
          <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 9, color: isToday ? colors.secondary : colors.primary, marginBottom: 3 }}>{count}</Text>
        ) : undefined,
      };
    });
  }, [events, colors]);

  const pieData = useMemo(() => {
    if (stats.total === 0) return [{ value: 1, color: colors.border }];
    const d: { value: number; color: string }[] = [];
    if (stats.completed > 0) d.push({ value: stats.completed, color: colors.success });
    if (stats.lateCompleted > 0) d.push({ value: stats.lateCompleted, color: '#F59E0B' }); // Amber/Orange
    if (stats.inProgress > 0) d.push({ value: stats.inProgress, color: colors.primary });
    if (stats.pending > 0) d.push({ value: stats.pending, color: colors.warning });
    if (stats.overdue > 0) d.push({ value: stats.overdue, color: colors.error });
    return d.length > 0 ? d : [{ value: 1, color: colors.border }];
  }, [stats, colors]);

  const getFilterLabel = () => ({ week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' }[timeFilter]);

  const filterOptions: { key: TimeFilter; label: string; emoji: string; desc: string }[] = [
    { key: 'week', label: 'This Week', emoji: '📅', desc: 'Mon – Sun' },
    { key: 'month', label: 'This Month', emoji: '🗓️', desc: 'Current month' },
    { key: 'year', label: 'This Year', emoji: '📆', desc: 'Jan – Dec' },
    { key: 'all', label: 'All Time', emoji: '🌐', desc: 'Every event' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── HEADER ── */}
      <FadeIn dy={-12} delay={0}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>📊 {getFilterLabel().toUpperCase()}</Text>
            <Text style={styles.headerTitle}>Analytics</Text>
          </View>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilterModal(true); }}
            style={styles.filterPressable}
          >
            <LinearGradient colors={[colors.secondary, '#E05500']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.filterGrad}>
              <Clock color="#FFF" size={12} strokeWidth={2.5} />
              <Text style={styles.filterGradText}>{getFilterLabel()}</Text>
              <ChevronDown color="#FFF" size={12} strokeWidth={3} />
            </LinearGradient>
          </Pressable>
        </View>
      </FadeIn>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HERO CARD ── */}
        <FadeIn delay={50}>
          <LinearGradient colors={['#FF7A00', '#E63000', '#C0200A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            {/* Decorative blobs */}
            <View style={[styles.blob, { width: 240, height: 240, top: -80, right: -70, opacity: 0.07 }]} />
            <View style={[styles.blob, { width: 140, height: 140, bottom: -60, left: -30, opacity: 0.07 }]} />
            <View style={[styles.blob, { width: 90, height: 90, top: 30, left: '45%', opacity: 0.05 }]} />

            {/* Header badges */}
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Flame color="#FF7A00" size={12} strokeWidth={2.5} />
                <Text style={styles.heroBadgeText}>COMPLETION RATE</Text>
              </View>
              <View style={styles.heroBadge}>
                <Award color="#FF7A00" size={12} strokeWidth={2.5} />
                <Text style={styles.heroBadgeText}>{stats.total} EVENTS</Text>
              </View>
            </View>

            {/* Ring + stats */}
            <View style={styles.heroBody}>
              <ProgressRing rate={stats.completionRate} colors={colors} />

              <View style={styles.heroStats}>
                <View style={styles.heroStatRow}>
                  <View style={styles.heroStatIcon}>
                    <Clock color="rgba(255,255,255,0.75)" size={13} strokeWidth={2.5} />
                  </View>
                  <View>
                    <Text style={styles.heroStatLabel}>Focus Time</Text>
                    <Text style={styles.heroStatValue}>{stats.focusTime}</Text>
                  </View>
                </View>

                <View style={styles.heroSep} />

                <View style={styles.heroStatRow}>
                  <View style={styles.heroStatIcon}>
                    <Check color="rgba(255,255,255,0.75)" size={13} strokeWidth={3} />
                  </View>
                  <View>
                    <Text style={styles.heroStatLabel}>Completed</Text>
                    <Text style={styles.heroStatValue}>{stats.completed} / {stats.total}</Text>
                  </View>
                </View>

                <View style={styles.heroSep} />

                <View style={styles.heroStatRow}>
                  <View style={styles.heroStatIcon}>
                    <Zap color="rgba(255,255,255,0.75)" size={13} strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroStatLabel}>Top Category</Text>
                    <Text style={styles.heroStatValue} numberOfLines={1}>{stats.topCategory}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Completion rate progress bar */}
            <View style={{ marginTop: 20 }}>
              <View style={styles.heroBarTrack}>
                <Animated.View
                  style={[styles.heroBarFill, { width: `${stats.completionRate}%` as any }]}
                />
              </View>
              <Text style={styles.heroBarLabel}>{stats.completionRate}% completion rate</Text>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* ── QUICK STAT PILLS ── */}
        <FadeIn delay={120}>
          <SectionHeader title="Event Overview" subtitle="All events in period" accentColor={colors.secondary} />
          <StatPill
            icon={<Target color={colors.primary} size={20} strokeWidth={2.5} />}
            label="Total Events" value={stats.total}
            color={colors.primary} bg={colors.card}
          />
          <StatPill
            icon={<Check color={colors.success} size={20} strokeWidth={3} />}
            label="Completed (On Time)" value={stats.completed}
            color={colors.success} bg={colors.successLight}
          />
          {stats.lateCompleted > 0 && (
            <StatPill
              icon={<Clock color="#F59E0B" size={20} strokeWidth={2.5} />}
              label="Completed (Late)" value={stats.lateCompleted}
              color="#F59E0B" bg="rgba(245, 158, 11, 0.12)"
            />
          )}
          <StatPill
            icon={<PlayCircle color={colors.primary} size={20} strokeWidth={2.5} />}
            label="In Progress" value={stats.inProgress}
            color={colors.primary} bg={colors.primaryLight}
          />
          <StatPill
            icon={<AlertTriangle color={colors.error} size={20} strokeWidth={2.5} />}
            label="Overdue" value={stats.overdue}
            color={colors.error} bg={colors.dangerLight}
          />
        </FadeIn>

        {/* ── WEEKLY BAR CHART ── */}
        <FadeIn delay={180}>
          <View style={{ marginTop: 6 }}>
            <SectionHeader title="Weekly Activity" subtitle="Completed events by day" accentColor={colors.primary} />
            <View style={[styles.card, { paddingTop: 24, paddingBottom: 8 }]}>
              <BarChart
                data={barData}
                barWidth={32}
                spacing={10}
                roundedTop
                roundedBottom={false}
                hideRules
                hideYAxisText
                xAxisThickness={1}
                xAxisColor={colors.border}
                yAxisThickness={0}
                noOfSections={3}
                maxValue={Math.max(...barData.map(b => b.value), 3)}
                height={130}
                barBorderRadius={8}
                showGradient
                gradientColor={colors.primaryLight}
                xAxisLabelTextStyle={{
                  fontFamily: 'Poppins_600SemiBold',
                  fontSize: 10,
                  color: colors.textSecondary,
                }}
                width={SW - 90}
                initialSpacing={12}
                endSpacing={12}
              />
            </View>
          </View>
        </FadeIn>

        {/* ── STATUS BREAKDOWN ── */}
        <FadeIn delay={240}>
          <View style={{ marginTop: 6 }}>
            <SectionHeader title="Status Breakdown" subtitle="Visual progress per status" accentColor={colors.primary} />

            <StatusBar
              label="Completed (On-time)" count={stats.completed} total={stats.total}
              color={colors.success} bg={colors.successLight}
              icon={<Check color={colors.success} size={20} strokeWidth={3} />}
              textColor={colors.text}
            />
            {stats.lateCompleted > 0 && (
              <StatusBar
                label="Completed (Late)" count={stats.lateCompleted} total={stats.total}
                color="#F59E0B" bg="rgba(245, 158, 11, 0.15)"
                icon={<Clock color="#F59E0B" size={20} strokeWidth={3} />}
                textColor={colors.text}
              />
            )}
            <StatusBar
              label="In Progress" count={stats.inProgress} total={stats.total}
              color={colors.primary} bg={colors.primaryLight}
              icon={<PlayCircle color={colors.primary} size={20} strokeWidth={2.5} />}
              textColor={colors.text}
            />
            <StatusBar
              label="Pending" count={stats.pending} total={stats.total}
              color="#F59E0B" bg="#FFFBEB"
              icon={<Clock color="#F59E0B" size={20} strokeWidth={2.5} />}
              textColor={colors.text}
            />
            <StatusBar
              label="Overdue" count={stats.overdue} total={stats.total}
              color={colors.error} bg={colors.dangerLight}
              icon={<AlertTriangle color={colors.error} size={20} strokeWidth={2.5} />}
              textColor={colors.text}
            />
          </View>
        </FadeIn>

        {/* ── DONUT CHART ── */}
        <FadeIn delay={300}>
          <View style={{ marginTop: 6 }}>
            <SectionHeader title="Distribution" subtitle="Proportional event breakdown" accentColor={colors.secondary} />
            <View style={styles.card}>
              <View style={styles.donutRow}>
                <PieChart
                  data={pieData}
                  donut radius={92} innerRadius={62}
                  innerCircleColor={colors.card}
                  strokeColor={colors.card} strokeWidth={3}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 26, color: colors.text, lineHeight: 30 }}>
                        {stats.completionRate}%
                      </Text>
                      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 9, color: colors.textSecondary, letterSpacing: 1.4 }}>
                        DONE
                      </Text>
                    </View>
                  )}
                />
                <View style={styles.donutLegend}>
                  {[
                    { color: colors.success, label: 'Completed', count: stats.completed },
                    ...(stats.lateCompleted > 0 ? [{ color: '#F59E0B', label: 'Done (Late)', count: stats.lateCompleted }] : []),
                    { color: colors.primary, label: 'In Progress', count: stats.inProgress },
                    { color: '#F59E0B', label: 'Pending', count: stats.pending },
                    { color: colors.error, label: 'Overdue', count: stats.overdue },
                  ].map(item => (
                    <View key={item.label} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                      <Text style={[styles.legendCount, { color: colors.text }]}>{item.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </FadeIn>

        {/* ── TOP CATEGORY CARD ── */}
        <FadeIn delay={360}>
          <View style={{ marginTop: 6 }}>
            <SectionHeader title="Top Category" subtitle="Most active this period" accentColor={colors.primary} />
            <LinearGradient
              colors={[colors.primary, '#3B30C8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.catCard}
            >
              <View style={styles.catBlob} />
              <View style={[styles.catIconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <GraduationCap color="#FFF" size={28} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.catLabel}>MOST ACTIVE</Text>
                <Text style={styles.catValue} numberOfLines={1}>{stats.topCategory}</Text>
                <Text style={styles.catSub}>
                  {stats.total === 0 ? 'No events' : `${filteredEvents.filter(e => (e.category || 'Other') === stats.topCategory).length} events this period`}
                </Text>
              </View>
              <View style={[styles.trendBox, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                <TrendingUp color="#FFF" size={20} strokeWidth={2.5} />
              </View>
            </LinearGradient>
          </View>
        </FadeIn>

        {/* ── AI PRODUCTIVITY INSIGHT ENGINE ── */}
        {aiInsights.length > 0 && (
          <FadeIn delay={400}>
            <View style={{ marginTop: 6 }}>
              <SectionHeader title="AI Insight" subtitle="What your data says about you" accentColor={colors.secondary} />
              <View style={{ gap: 10 }}>
                {aiInsights.map((insight, i) => {
                  const spaceIndex = insight.indexOf(' ');
                  const hasEmoji = spaceIndex > 0 && spaceIndex < 4; // Ensure the space is near the start
                  const icon = hasEmoji ? insight.substring(0, spaceIndex) : '💡';
                  const text = hasEmoji ? insight.substring(spaceIndex + 1) : insight;

                  return (
                    <LinearGradient
                      key={i}
                      colors={isDarkMode ? [colors.primary + '15', colors.secondary + '0A'] : [colors.primary + '08', colors.secondary + '03']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 20, padding: 16, 
                        flexDirection: 'row', alignItems: 'center', gap: 14,
                        borderWidth: 1, borderColor: isDarkMode ? colors.primary + '25' : colors.primary + '15',
                      }}
                    >
                      <View style={{
                        width: 42, height: 42, borderRadius: 12,
                        backgroundColor: isDarkMode ? colors.primary + '25' : colors.primary + '15',
                        alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Text style={{ fontSize: 20 }}>{icon}</Text>
                      </View>
                      <Text style={{ flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 13, color: colors.text, lineHeight: 22 }}>
                        {text}
                      </Text>
                    </LinearGradient>
                  );
                })}
              </View>
            </View>
          </FadeIn>
        )}
        {/* ────────────────────────────────── */}

        <View style={{ height: 56 }} />
      </ScrollView>

      {/* ── FILTER MODAL ── */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowFilterModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Time Period</Text>
                <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>Filter your analytics</Text>
              </View>
              <Pressable onPress={() => setShowFilterModal(false)} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
                <X color={colors.textSecondary} size={18} strokeWidth={2.5} />
              </Pressable>
            </View>

            {filterOptions.map((opt) => {
              const isActive = timeFilter === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => { Haptics.selectionAsync(); setTimeFilter(opt.key); setShowFilterModal(false); }}
                  style={[
                    styles.sheetOption,
                    {
                      backgroundColor: isActive ? colors.secondary + '14' : colors.surface,
                      borderColor: isActive ? colors.secondary : 'transparent',
                    },
                  ]}
                >
                  <Text style={styles.optEmoji}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optLabel, { color: isActive ? colors.secondary : colors.text }]}>{opt.label}</Text>
                    <Text style={[styles.optDesc, { color: colors.textSecondary }]}>{opt.desc}</Text>
                  </View>
                  {isActive && (
                    <View style={[styles.checkBadge, { backgroundColor: colors.secondary }]}>
                      <Check color="#FFF" size={11} strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 120 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  eyebrow: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 10,
    color: colors.textSecondary, letterSpacing: 1.2, marginBottom: 2,
  },
  headerTitle: {
    fontFamily: 'Poppins_800ExtraBold', fontSize: 34,
    color: colors.text, letterSpacing: -1.2, lineHeight: 38,
  },
  filterPressable: {
    shadowColor: colors.secondary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  filterGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24,
  },
  filterGradText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: '#FFF' },

  // Hero
  heroCard: {
    borderRadius: 32, padding: 24, marginBottom: 20, overflow: 'hidden',
    shadowColor: '#FF5000', shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45, shadowRadius: 30, elevation: 16,
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: '#FFFFFF' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 20,
  },
  heroBadgeText: { fontFamily: 'Poppins_700Bold', fontSize: 9, color: '#FFF', letterSpacing: 0.8 },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  heroStats: { flex: 1, gap: 0 },
  heroStatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  heroStatIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  heroStatLabel: { fontFamily: 'Poppins_500Medium', fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },
  heroStatValue: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: '#FFF', letterSpacing: -0.3 },
  heroSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginLeft: 40 },
  heroBarTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3, overflow: 'hidden', marginBottom: 6,
  },
  heroBarFill: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)',
  },
  heroBarLabel: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 10,
    color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3,
  },

  // Card
  card: {
    backgroundColor: colors.card, borderRadius: 24, padding: 20,
    shadowColor: colors.text, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 14, elevation: 4,
    borderWidth: 1, borderColor: colors.border,
  },

  // Donut
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutLegend: { flex: 1, gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: 'Poppins_500Medium', fontSize: 12, flex: 1 },
  legendCount: { fontFamily: 'Poppins_800ExtraBold', fontSize: 16 },

  // Category card
  catCard: {
    borderRadius: 26, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16,
    overflow: 'hidden',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35, shadowRadius: 24, elevation: 10,
  },
  catBlob: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40,
  },
  catIconBox: {
    width: 60, height: 60, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  catLabel: { fontFamily: 'Poppins_700Bold', fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, marginBottom: 3 },
  catValue: { fontFamily: 'Poppins_800ExtraBold', fontSize: 20, color: '#FFF', letterSpacing: -0.5 },
  catSub: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  trendBox: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    padding: 24, paddingBottom: 52,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 16,
  },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontFamily: 'Poppins_800ExtraBold', fontSize: 22 },
  sheetSub: { fontFamily: 'Poppins_500Medium', fontSize: 12, marginTop: 2 },
  closeBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1.5, marginBottom: 10,
  },
  optEmoji: { fontSize: 24 },
  optLabel: { fontFamily: 'Poppins_700Bold', fontSize: 15 },
  optDesc: { fontFamily: 'Poppins_400Regular', fontSize: 11, marginTop: 1 },
  checkBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
