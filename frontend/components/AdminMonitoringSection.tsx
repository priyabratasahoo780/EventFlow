import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Mail,
  Cloud,
  ShieldCheck,
  RefreshCw,
  Server,
  Trash2,
  Zap,
  ChevronDown,
  ChevronUp,
  Radio,
  Gauge,
  Layers,
  HardDrive,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import { ColorTheme } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  colors: ColorTheme;
  isDark: boolean;
  onAuthError?: () => void;
}

type GlitchFilter = 'all' | 'critical' | 'warning';
type SectionScope = 'all' | 'traffic' | 'subsystems' | 'glitches' | 'timeline';

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatUptime(sec: number): string {
  const days = Math.floor(sec / 86400);
  const hrs = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${sec % 60}s`;
}

function formatCountdown(nextIso?: string | null): string {
  if (!nextIso) return '—';
  const diffMs = new Date(nextIso).getTime() - Date.now();
  if (Number.isNaN(diffMs) || diffMs <= 0) return 'Probing...';
  const totalSec = Math.floor(diffMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function getSubsystemIcon(name: string) {
  if (name.includes('MongoDB')) return Database;
  if (name.includes('Auth')) return ShieldCheck;
  if (name.includes('Email')) return Mail;
  if (name.includes('Cloudinary')) return Cloud;
  return Server;
}

function getModuleIcon(name: string) {
  if (name.includes('Auth')) return ShieldCheck;
  if (name.includes('Events')) return Clock;
  if (name.includes('Friends')) return Activity;
  if (name.includes('Media')) return Cloud;
  if (name.includes('Festival')) return Sparkles;
  if (name.includes('Admin')) return Cpu;
  return Server;
}

function getLatencyColor(ms: number): string {
  if (ms <= 180) return '#10B981';
  if (ms <= 450) return '#F59E0B';
  return '#EF4444';
}

export default function AdminMonitoringSection({ colors, isDark, onAuthError }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [updatingInterval, setUpdatingInterval] = useState(false);
  const [glitchFilter, setGlitchFilter] = useState<GlitchFilter>('all');
  const [scope, setScope] = useState<SectionScope>('all');
  const [expandedGlitchId, setExpandedGlitchId] = useState<string | null>(null);
  const [selectedProbeIdx, setSelectedProbeIdx] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('—');

  // SVG Dual Concentric Ring Gauge constants
  const OUTER_SIZE = 118;
  const RING_SIZE = 100;
  const STROKE_WIDTH = 8;
  const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // Reanimated shared values for rich floating & radar animations
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.85);
  const animatedScore = useSharedValue(100);
  const floatY = useSharedValue(0);
  const floatAltY = useSharedValue(0);
  const orbFloatY = useSharedValue(0);
  const radarDeg = useSharedValue(0);
  const probeBtnScale = useSharedValue(1);
  const spinDeg = useSharedValue(0);

  useEffect(() => {
    // 1. Live pulse beacon
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.9, { duration: 1150, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.08, { duration: 1150 }),
        withTiming(0.85, { duration: 900 })
      ),
      -1,
      false
    );

    // 2. Smooth floating levitation for SVG gauge & zero-glitch shield
    floatY.value = withRepeat(
      withSequence(
        withTiming(-4.5, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(4.5, { duration: 1900, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // 3. Subtle counter-phase float for glassmorphic telemetry stack
    floatAltY.value = withRepeat(
      withSequence(
        withTiming(2.5, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(-2.5, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // 4. Drifting ambient orb glow inside hero card
    orbFloatY.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(-10, { duration: 3200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // 5. Continuous slow rotation of outer dashed radar ring
    radarDeg.value = withRepeat(
      withTiming(360, { duration: 18000, easing: Easing.linear }),
      -1,
      false
    );
  }, [pulseScale, pulseOpacity, floatY, floatAltY, orbFloatY, radarDeg]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const floatGaugeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const floatAltStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAltY.value }],
  }));

  const orbFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: orbFloatY.value }],
  }));

  const radarSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${radarDeg.value}deg` }],
  }));

  const gaugeAnimatedProps = useAnimatedProps(() => {
    const clamped = Math.max(0, Math.min(100, animatedScore.value));
    const dashOffset = CIRCUMFERENCE * (1 - clamped / 100);
    return { strokeDashoffset: dashOffset };
  });

  const probeBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: probeBtnScale.value }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinDeg.value}deg` }],
  }));

  const fetchMonitoring = useCallback(async () => {
    try {
      const res = await api.get('/admin/monitoring');
      setData(res.data);
      const score = Number(res.data?.healthScore ?? 100);
      animatedScore.value = withTiming(score, {
        duration: 850,
        easing: Easing.out(Easing.cubic),
      });
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        onAuthError?.();
      }
    } finally {
      setLoading(false);
    }
  }, [onAuthError, animatedScore]);

  useEffect(() => {
    fetchMonitoring();
    const poll = setInterval(fetchMonitoring, 30000);
    return () => clearInterval(poll);
  }, [fetchMonitoring]);

  useEffect(() => {
    setCountdown(formatCountdown(data?.nextProbeAt));
    const tick = setInterval(() => {
      setCountdown(formatCountdown(data?.nextProbeAt));
    }, 1000);
    return () => clearInterval(tick);
  }, [data?.nextProbeAt]);

  const handleRunProbe = async () => {
    if (probing) return;
    setProbing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    probeBtnScale.value = withSequence(withSpring(0.92), withSpring(1));
    spinDeg.value = withRepeat(withTiming(360, { duration: 700, easing: Easing.linear }), -1, false);
    try {
      const res = await api.post('/admin/monitoring/probe');
      setData(res.data);
      animatedScore.value = withTiming(Number(res.data?.healthScore ?? 100), { duration: 650 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert('Probe Failed', err?.response?.data?.error || 'Could not run health probe.');
    } finally {
      spinDeg.value = 0;
      setProbing(false);
    }
  };

  const handleSetInterval = async (minutes: 5 | 10) => {
    if (updatingInterval || data?.intervalMinutes === minutes) return;
    setUpdatingInterval(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const res = await api.patch('/admin/monitoring/interval', { intervalMinutes: minutes });
      setData(res.data);
    } catch (err: any) {
      Alert.alert('Update Failed', err?.response?.data?.error || 'Could not update interval.');
    } finally {
      setUpdatingInterval(false);
    }
  };

  const handleClearGlitches = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Alert.alert('Clear Glitch Logs', 'Clear all recorded glitch history from memory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await api.delete('/admin/monitoring/glitches');
            setData(res.data);
            setExpandedGlitchId(null);
          } catch {
            Alert.alert('Error', 'Failed to clear glitch logs.');
          }
        },
      },
    ]);
  };

  if (loading && !data) {
    return (
      <Animated.View
        entering={FadeIn.duration(280)}
        style={[
          styles.centerCard,
          { backgroundColor: colors.card, borderColor: '#F9731650', borderStyle: 'dashed' },
        ]}
      >
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={[styles.subName, { color: colors.text, marginTop: 14 }]}>
          Initializing Telemetry Stream...
        </Text>
        <Text style={[styles.mutedText, { color: colors.textSecondary, marginTop: 4 }]}>
          Probing server health, HTTP metrics & subsystems
        </Text>
      </Animated.View>
    );
  }

  const isCrit = data?.overallStatus === 'critical';
  const isDeg = data?.overallStatus === 'degraded';
  const statusColor = isCrit ? '#EF4444' : isDeg ? '#F59E0B' : '#10B981';
  const heroGradient: [string, string, string] = isCrit
    ? ['#450A0A', '#7F1D1D', '#991B1B']
    : isDeg
      ? ['#451A03', '#78350F', '#92400E']
      : ['#090F1E', '#111C33', '#1B1A4A'];

  const statusCounts = data?.stats?.statusCounts || { s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0 };
  const rawTotalReq = Number(data?.stats?.totalRequests || 0);
  const safeTotalReq = Math.max(1, rawTotalReq);
  const p2xx = Math.round((statusCounts.s2xx / safeTotalReq) * 100);
  const p3xx = Math.round((statusCounts.s3xx / safeTotalReq) * 100);
  const p4xx = Math.round((statusCounts.s4xx / safeTotalReq) * 100);
  const p5xx = rawTotalReq > 0 ? Math.max(0, 100 - p2xx - p3xx - p4xx) : 0;

  const subsystems: any[] = data?.subsystems || [];
  const allGlitches: any[] = data?.glitches || [];
  const critCount = allGlitches.filter((g) => g.severity === 'critical').length;
  const warnCount = allGlitches.filter((g) => g.severity === 'warning').length;
  const filteredGlitches = allGlitches.filter((g) =>
    glitchFilter === 'all' ? true : g.severity === glitchFilter
  );
  const probes: any[] = data?.probes || [];
  const sparkProbes = probes.slice(0, 16).reverse();
  const maxProbeLatency = Math.max(120, ...sparkProbes.map((p) => Number(p.latencyMs || 60)));
  const modules: any[] = data?.modules || [];
  const avgSpeed = Number(data?.stats?.avgLatencyMs ?? 0);
  const p95Speed = Number(data?.stats?.p95LatencyMs ?? 0);

  const showSection = (s: SectionScope) => scope === 'all' || scope === s;
  const dashedBorder = isDark ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.28)';

  return (
    <View style={{ gap: 15 }}>
      {/* 1. Dashed-Framed Animated NOC Hero Card */}
      <Animated.View entering={FadeInDown.duration(380).springify()}>
        <View style={[styles.heroOuterFrame, { borderColor: statusColor + '60' }]}>
          <LinearGradient
            colors={heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Floating Ambient Glow Orbs */}
            <Animated.View
              style={[styles.ambientOrbTop, { backgroundColor: statusColor + '1C' }, orbFloatStyle]}
            />
            <Animated.View
              style={[styles.ambientOrbBottom, { backgroundColor: '#6366F125' }, floatAltStyle]}
            />

            {/* Header */}
            <View style={styles.rowBetween}>
              <View style={styles.rowGap}>
                <View style={styles.beaconWrap}>
                  <Animated.View
                    style={[styles.beaconRing, { backgroundColor: statusColor }, pulseRingStyle]}
                  />
                  <View style={[styles.beaconCore, { backgroundColor: statusColor }]} />
                </View>
                <View>
                  <Text style={styles.heroEyebrow}>LIVE TELEMETRY STREAM</Text>
                  <Text style={styles.heroTitle}>System Command Center</Text>
                </View>
              </View>

              <View
                style={[
                  styles.heroStatusBadge,
                  { backgroundColor: statusColor + '20', borderColor: statusColor + '75' },
                ]}
              >
                <Radio color={statusColor} size={12} />
                <Text style={[styles.heroStatusText, { color: statusColor }]}>
                  {String(data?.overallStatus || 'healthy').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Floating Dual-Ring SVG Gauge + Dashed Glassmorphic Telemetry Stack */}
            <View style={styles.heroGaugeSection}>
              <Animated.View style={[styles.svgGaugeWrap, floatGaugeStyle]}>
                {/* Rotating Outer Dashed Radar Halo */}
                <Animated.View style={[styles.outerRadarWrap, radarSpinStyle]}>
                  <Svg width={OUTER_SIZE} height={OUTER_SIZE}>
                    <Circle
                      cx={OUTER_SIZE / 2}
                      cy={OUTER_SIZE / 2}
                      r={(OUTER_SIZE - 4) / 2}
                      stroke={statusColor + '55'}
                      strokeWidth={1.6}
                      strokeDasharray="5 6"
                      fill="none"
                    />
                  </Svg>
                </Animated.View>

                {/* Inner Health Ring */}
                <Svg width={RING_SIZE} height={RING_SIZE}>
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                  />
                  <AnimatedCircle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    stroke={statusColor}
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                    strokeDasharray={CIRCUMFERENCE}
                    animatedProps={gaugeAnimatedProps}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                  />
                </Svg>
                <View style={styles.svgGaugeCenter}>
                  <Text style={styles.gaugePercent}>{data?.healthScore ?? 100}%</Text>
                  <Text style={styles.gaugeLabel}>HEALTH</Text>
                </View>
              </Animated.View>

              <Animated.View style={[styles.glassMetaStack, floatAltStyle]}>
                <View style={styles.glassDashedPill}>
                  <Clock color="#94A3B8" size={13} />
                  <Text style={styles.glassPillLabel}>Uptime</Text>
                  <Text style={styles.glassPillValue}>
                    {formatUptime(data?.uptimeSeconds || 0)}
                  </Text>
                </View>

                <View style={styles.glassDashedPill}>
                  <HardDrive color="#A78BFA" size={13} />
                  <Text style={styles.glassPillLabel}>Memory</Text>
                  <Text style={styles.glassPillValue}>
                    {data?.memory?.rssMb || 0}M{' '}
                    <Text style={{ color: '#94A3B8', fontSize: 10 }}>
                      ({data?.memory?.heapUsedMb || 0}M)
                    </Text>
                  </Text>
                </View>

                <View style={styles.glassDashedPill}>
                  <Activity color="#38BDF8" size={13} />
                  <Text style={styles.glassPillLabel}>Next Probe</Text>
                  <Text style={[styles.glassPillValue, { color: '#38BDF8' }]}>{countdown}</Text>
                </View>
              </Animated.View>
            </View>

            {/* Bottom Dashed Dock */}
            <View style={styles.heroControls}>
              <View style={styles.intervalGroup}>
                <Text style={styles.heroSubText}>Auto-Check</Text>
                <View style={styles.segmentedTrack}>
                  {([5, 10] as const).map((min) => {
                    const active = data?.intervalMinutes === min;
                    return (
                      <Pressable
                        key={min}
                        onPress={() => handleSetInterval(min)}
                        style={[
                          styles.segmentedItem,
                          active && styles.segmentedItemActive,
                        ]}
                      >
                        <Text style={[styles.segmentedText, active && { color: '#FFF' }]}>
                          {min}m
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Animated.View style={probeBtnAnimStyle}>
                <Pressable onPress={handleRunProbe} disabled={probing}>
                  <LinearGradient
                    colors={['#FF7A00', '#EA580C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.heroProbeBtn}
                  >
                    <Animated.View style={spinStyle}>
                      <RefreshCw color="#FFF" size={13} strokeWidth={2.5} />
                    </Animated.View>
                    <Text style={styles.probeBtnText}>
                      {probing ? 'Probing...' : 'Run Probe'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </View>
          </LinearGradient>
        </View>
      </Animated.View>

      {/* Dashed Interactive Scope Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scopeBar}
      >
        {(
          [
            { key: 'all', label: 'All Telemetry' },
            { key: 'traffic', label: 'Traffic & Codes' },
            { key: 'subsystems', label: `Subsystems (${subsystems.length})` },
            { key: 'glitches', label: `Glitches (${allGlitches.length})` },
            { key: 'timeline', label: 'Probe Timeline' },
          ] as { key: SectionScope; label: string }[]
        ).map((item) => {
          const active = scope === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setScope(item.key);
              }}
              style={[
                styles.scopeChip,
                {
                  backgroundColor: active ? '#FF7A00' : colors.card,
                  borderColor: active ? '#FF7A00' : dashedBorder,
                  borderStyle: active ? 'solid' : 'dashed',
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: active ? 'Poppins_700Bold' : 'Poppins_600SemiBold',
                  fontSize: 11.5,
                  color: active ? '#FFF' : colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 2. Dashed 2x2 Floating KPI Grid & Status Matrix */}
      {showSection('traffic') && (
        <Animated.View
          entering={FadeInDown.delay(60).duration(360).springify()}
          style={[styles.card, { backgroundColor: colors.card, borderColor: dashedBorder }]}
        >
          <View style={[styles.rowBetween, { marginBottom: 14 }]}>
            <View style={styles.rowGap}>
              <View style={[styles.cardIconBadge, { backgroundColor: '#F9731618', borderColor: '#F9731650' }]}>
                <Zap color="#F97316" size={16} strokeWidth={2.4} />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Traffic & HTTP Status Codes
                </Text>
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                  Synced {formatTime(data?.lastProbeAt)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <Animated.View
              entering={ZoomIn.delay(80).duration(300)}
              style={[styles.kpiTile, { backgroundColor: colors.surface, borderColor: '#6366F145' }]}
            >
              <View style={styles.rowBetween}>
                <Text style={[styles.kpiTileLbl, { color: colors.textSecondary }]}>Total Requests</Text>
                <Layers color="#6366F1" size={14} />
              </View>
              <Text style={[styles.kpiTileVal, { color: colors.text }]}>{rawTotalReq}</Text>
              <Text style={[styles.kpiTag, { color: '#6366F1' }]}>Live Window</Text>
            </Animated.View>

            <Animated.View
              entering={ZoomIn.delay(130).duration(300)}
              style={[styles.kpiTile, { backgroundColor: colors.surface, borderColor: '#10B98145' }]}
            >
              <View style={styles.rowBetween}>
                <Text style={[styles.kpiTileLbl, { color: colors.textSecondary }]}>Success Rate</Text>
                <ShieldCheck color="#10B981" size={14} />
              </View>
              <Text style={[styles.kpiTileVal, { color: '#10B981' }]}>
                {data?.stats?.successRate ?? 100}%
              </Text>
              <Text style={[styles.kpiTag, { color: '#10B981' }]}>Zero 5xx Crash</Text>
            </Animated.View>
          </View>

          <View style={[styles.kpiRow, { marginTop: 10 }]}>
            <Animated.View
              entering={ZoomIn.delay(180).duration(300)}
              style={[
                styles.kpiTile,
                { backgroundColor: colors.surface, borderColor: getLatencyColor(avgSpeed) + '55' },
              ]}
            >
              <View style={styles.rowBetween}>
                <Text style={[styles.kpiTileLbl, { color: colors.textSecondary }]}>Avg Speed</Text>
                <Gauge color={getLatencyColor(avgSpeed)} size={14} />
              </View>
              <Text style={[styles.kpiTileVal, { color: getLatencyColor(avgSpeed) }]}>
                {avgSpeed} ms
              </Text>
              <Text style={[styles.kpiTag, { color: getLatencyColor(avgSpeed) }]}>
                {avgSpeed <= 180 ? 'Fast Response' : avgSpeed <= 450 ? 'Moderate' : 'Heavy Load'}
              </Text>
            </Animated.View>

            <Animated.View
              entering={ZoomIn.delay(230).duration(300)}
              style={[
                styles.kpiTile,
                { backgroundColor: colors.surface, borderColor: getLatencyColor(p95Speed) + '55' },
              ]}
            >
              <View style={styles.rowBetween}>
                <Text style={[styles.kpiTileLbl, { color: colors.textSecondary }]}>P95 Latency</Text>
                <Activity color={getLatencyColor(p95Speed)} size={14} />
              </View>
              <Text style={[styles.kpiTileVal, { color: getLatencyColor(p95Speed) }]}>
                {p95Speed} ms
              </Text>
              <Text style={[styles.kpiTag, { color: colors.textSecondary }]}>95th Percentile</Text>
            </Animated.View>
          </View>

          {/* Proportional Distribution Bar */}
          {rawTotalReq > 0 ? (
            <View style={[styles.distBarTrack, { backgroundColor: colors.surface }]}>
              {p2xx > 0 && <View style={{ flex: p2xx, backgroundColor: '#10B981' }} />}
              {p3xx > 0 && <View style={{ flex: p3xx, backgroundColor: '#3B82F6' }} />}
              {p4xx > 0 && <View style={{ flex: p4xx, backgroundColor: '#F59E0B' }} />}
              {p5xx > 0 && <View style={{ flex: p5xx, backgroundColor: '#EF4444' }} />}
            </View>
          ) : null}

          {/* 2x2 Dashed Status Legend Cards */}
          <View style={styles.statusGrid}>
            {[
              { label: '2xx Healthy', count: statusCounts.s2xx, pct: p2xx, color: '#10B981' },
              { label: '3xx Cached', count: statusCounts.s3xx, pct: p3xx, color: '#3B82F6' },
              { label: '4xx Client Warn', count: statusCounts.s4xx, pct: p4xx, color: '#F59E0B' },
              { label: '5xx Server Err', count: statusCounts.s5xx, pct: p5xx, color: '#EF4444' },
            ].map((item) => (
              <View
                key={item.label}
                style={[
                  styles.statusLegendCard,
                  { backgroundColor: item.color + '10', borderColor: item.color + '55' },
                ]}
              >
                <View style={styles.rowGap}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.legendLabel, { color: colors.text }]}>{item.label}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={[styles.legendCount, { color: item.color }]}>{item.count}</Text>
                  <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                    {item.pct}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* 3. Dashed Subsystem Health Matrix */}
      {showSection('subsystems') && (
        <Animated.View
          entering={FadeInDown.delay(110).duration(360).springify()}
          style={[styles.card, { backgroundColor: colors.card, borderColor: dashedBorder }]}
        >
          <View style={[styles.rowGap, { marginBottom: 12 }]}>
            <View style={[styles.cardIconBadge, { backgroundColor: '#6366F118', borderColor: '#6366F150' }]}>
              <Server color="#6366F1" size={16} strokeWidth={2.4} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Subsystem Health Checks
              </Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                Live probe diagnostics across core services
              </Text>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            {subsystems.map((sub, idx) => {
              const Icon = getSubsystemIcon(sub.name);
              const c =
                sub.status === 'ok' ? '#10B981' : sub.status === 'degraded' ? '#F59E0B' : '#EF4444';
              const lat = Number(sub.latencyMs || 0);
              const barPct = Math.min(100, Math.max(10, Math.round((Math.max(5, lat) / 300) * 100)));
              return (
                <Animated.View
                  key={sub.name}
                  entering={FadeInRight.delay(idx * 50).duration(300)}
                  style={[
                    styles.subCard,
                    { backgroundColor: colors.surface, borderColor: c + '45' },
                  ]}
                >
                  <View style={[styles.subIconBox, { backgroundColor: c + '18', borderColor: c + '50' }]}>
                    <Icon color={c} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subName, { color: colors.text }]}>{sub.name}</Text>
                    <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                      {sub.detail}
                    </Text>
                    {lat > 0 ? (
                      <View style={[styles.miniBarTrack, { backgroundColor: colors.card }]}>
                        <View
                          style={[
                            styles.miniBarFill,
                            { width: `${barPct}%`, backgroundColor: getLatencyColor(lat) },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.statusPill, { backgroundColor: c + '1A', borderColor: c + '50' }]}>
                      <Text style={[styles.statusPillText, { color: c }]}>
                        {sub.statusCode} • {String(sub.status).toUpperCase()}
                      </Text>
                    </View>
                    {lat > 0 ? (
                      <Text
                        style={{
                          fontFamily: 'Poppins_600SemiBold',
                          fontSize: 11,
                          color: getLatencyColor(lat),
                        }}
                      >
                        {lat} ms
                      </Text>
                    ) : null}
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* 4. Dashed & Floating Glitch Locator */}
      {showSection('glitches') && (
        <Animated.View
          entering={FadeInDown.delay(150).duration(360).springify()}
          style={[styles.card, { backgroundColor: colors.card, borderColor: dashedBorder }]}
        >
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <View style={styles.rowGap}>
              <View
                style={[
                  styles.cardIconBadge,
                  {
                    backgroundColor: (critCount > 0 ? '#EF4444' : '#10B981') + '18',
                    borderColor: (critCount > 0 ? '#EF4444' : '#10B981') + '50',
                  },
                ]}
              >
                <AlertTriangle
                  color={critCount > 0 ? '#EF4444' : allGlitches.length > 0 ? '#F59E0B' : '#10B981'}
                  size={16}
                />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Glitch Locator ({allGlitches.length})
                </Text>
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                  Tap any alert to inspect exact route & cause
                </Text>
              </View>
            </View>
            {allGlitches.length > 0 ? (
              <Pressable onPress={handleClearGlitches} style={styles.clearBtn}>
                <Trash2 color="#EF4444" size={13} />
                <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: '#EF4444' }}>
                  Clear
                </Text>
              </Pressable>
            ) : null}
          </View>

          {allGlitches.length > 0 ? (
            <View style={[styles.rowGap, { marginBottom: 12, flexWrap: 'wrap' }]}>
              {(
                [
                  { key: 'all', label: `All (${allGlitches.length})` },
                  { key: 'critical', label: `Critical 5xx (${critCount})` },
                  { key: 'warning', label: `Warnings 4xx (${warnCount})` },
                ] as { key: GlitchFilter; label: string }[]
              ).map((f) => {
                const active = glitchFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setGlitchFilter(f.key);
                    }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? '#FF7A00' : colors.surface,
                        borderColor: active ? '#FF7A00' : dashedBorder,
                        borderStyle: active ? 'solid' : 'dashed',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: 'Poppins_600SemiBold',
                        fontSize: 11,
                        color: active ? '#FFF' : colors.textSecondary,
                      }}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {filteredGlitches.length === 0 ? (
            <Animated.View
              entering={ZoomIn.duration(300)}
              style={[
                styles.emptyDashedBox,
                {
                  backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#ECFDF5',
                  borderColor: '#10B98165',
                },
              ]}
            >
              <Animated.View
                style={[styles.emptyIconCircle, { backgroundColor: '#10B98122' }, floatGaugeStyle]}
              >
                <CheckCircle2 color="#10B981" size={28} />
              </Animated.View>
              <Text style={[styles.subName, { color: '#10B981', marginTop: 10, fontSize: 14 }]}>
                Zero Glitches Detected
              </Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary, textAlign: 'center', marginTop: 2 }]}>
                All monitored routes and modules are operating smoothly with 0 anomalies.
              </Text>
            </Animated.View>
          ) : (
            filteredGlitches.slice(0, 15).map((g) => {
              const c = g.severity === 'critical' ? '#EF4444' : '#F59E0B';
              const expanded = expandedGlitchId === g.id;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setExpandedGlitchId(expanded ? null : g.id);
                  }}
                  style={[
                    styles.glitchItem,
                    { backgroundColor: colors.surface, borderColor: c + '60', borderLeftColor: c },
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <View style={styles.rowGap}>
                      <View style={[styles.statusPill, { backgroundColor: c + '22', borderColor: c + '50' }]}>
                        <Text style={[styles.statusPillText, { color: c }]}>{g.statusCode}</Text>
                      </View>
                      <Text style={[styles.glitchLoc, { color: c }]}>{g.location}</Text>
                    </View>
                    <View style={styles.rowGap}>
                      <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                        {formatTime(g.timestamp)}
                      </Text>
                      {expanded ? (
                        <ChevronUp color={colors.textSecondary} size={15} />
                      ) : (
                        <ChevronDown color={colors.textSecondary} size={15} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.glitchPath, { color: colors.text }]} numberOfLines={expanded ? 4 : 1}>
                    {g.method} {g.path}
                  </Text>
                  {expanded ? (
                    <Animated.View entering={FadeInDown.duration(180)} style={styles.glitchDetailBox}>
                      <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                        Latency: <Text style={{ color: colors.text }}>{g.durationMs} ms</Text> • Level:{' '}
                        <Text style={{ color: c, fontFamily: 'Poppins_700Bold' }}>
                          {String(g.severity).toUpperCase()}
                        </Text>
                      </Text>
                      <Text style={[styles.mutedText, { color: colors.text }]}>{g.message}</Text>
                    </Animated.View>
                  ) : (
                    <Text style={[styles.mutedText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {g.message}
                    </Text>
                  )}
                </Pressable>
              );
            })
          )}
        </Animated.View>
      )}

      {/* 5. Module Performance & Sparkline Timeline */}
      {showSection('timeline') && (
        <>
          {modules.length > 0 ? (
            <Animated.View
              entering={FadeInDown.delay(190).duration(360).springify()}
              style={[styles.card, { backgroundColor: colors.card, borderColor: dashedBorder }]}
            >
              <View style={[styles.rowGap, { marginBottom: 12 }]}>
                <View style={[styles.cardIconBadge, { backgroundColor: '#6366F118', borderColor: '#6366F150' }]}>
                  <Cpu color="#6366F1" size={16} />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Module Performance
                  </Text>
                  <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                    Per-route traffic, average speed & error rate
                  </Text>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                {modules.map((m, idx) => {
                  const ModIcon = getModuleIcon(m.name);
                  const speedCol = getLatencyColor(m.avgMs);
                  return (
                    <Animated.View
                      key={m.name}
                      entering={FadeInRight.delay(idx * 40).duration(260)}
                      style={[
                        styles.modCardRow,
                        { backgroundColor: colors.surface, borderColor: dashedBorder },
                      ]}
                    >
                      <View style={[styles.modIconCircle, { backgroundColor: '#6366F114' }]}>
                        <ModIcon color="#6366F1" size={14} />
                      </View>
                      <Text style={[styles.subName, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <View style={styles.rowGap}>
                        <View style={[styles.miniPill, { backgroundColor: colors.card, borderColor: dashedBorder }]}>
                          <Text style={[styles.mutedText, { color: colors.text, fontSize: 10.5 }]}>
                            {m.total} req
                          </Text>
                        </View>
                        <View style={[styles.miniPill, { backgroundColor: speedCol + '14', borderColor: speedCol + '45' }]}>
                          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: speedCol }}>
                            {m.avgMs}ms
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.miniPill,
                            {
                              backgroundColor: (m.errors5xx > 0 ? '#EF4444' : '#10B981') + '16',
                              borderColor: (m.errors5xx > 0 ? '#EF4444' : '#10B981') + '45',
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontFamily: 'Poppins_600SemiBold',
                              fontSize: 10.5,
                              color: m.errors5xx > 0 ? '#EF4444' : '#10B981',
                            }}
                          >
                            {m.errors5xx} err
                          </Text>
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInDown.delay(230).duration(360).springify()}
            style={[styles.card, { backgroundColor: colors.card, borderColor: dashedBorder }]}
          >
            <View style={[styles.rowBetween, { marginBottom: 12 }]}>
              <View style={styles.rowGap}>
                <View style={[styles.cardIconBadge, { backgroundColor: '#10B98118', borderColor: '#10B98150' }]}>
                  <Activity color="#10B981" size={16} />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    5/10m Probe Timeline ({probes.length})
                  </Text>
                  <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                    Tap any bar to inspect probe latency & code
                  </Text>
                </View>
              </View>
            </View>

            {sparkProbes.length > 0 ? (
              <View
                style={[
                  styles.sparkContainer,
                  { backgroundColor: colors.surface, borderColor: dashedBorder },
                ]}
              >
                {/* Dashed baseline inside chart */}
                <View style={[styles.sparkDashedMid, { borderColor: dashedBorder }]} />
                <View style={styles.sparkRow}>
                  {sparkProbes.map((p, idx) => {
                    const c =
                      p.status === 'critical'
                        ? '#EF4444'
                        : p.status === 'degraded'
                          ? '#F59E0B'
                          : '#10B981';
                    const lat = Number(p.latencyMs || 50);
                    const h = Math.max(14, Math.min(46, Math.round((lat / maxProbeLatency) * 44) + 10));
                    const isSel = selectedProbeIdx === idx;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setSelectedProbeIdx(isSel ? null : idx);
                        }}
                        style={[
                          styles.sparkBar,
                          {
                            height: h,
                            backgroundColor: c,
                            opacity: selectedProbeIdx === null || isSel ? 1 : 0.45,
                            borderWidth: isSel ? 2 : 0,
                            borderColor: '#FFFFFF',
                          },
                        ]}
                      />
                    );
                  })}
                </View>
                {selectedProbeIdx !== null && sparkProbes[selectedProbeIdx] ? (
                  <Animated.View entering={FadeInDown.duration(160)} style={styles.sparkSelectedTip}>
                    <Text style={[styles.mutedText, { color: colors.text }]}>
                      HTTP {sparkProbes[selectedProbeIdx].statusCode} •{' '}
                      <Text style={{ fontFamily: 'Poppins_700Bold', color: '#10B981' }}>
                        {sparkProbes[selectedProbeIdx].latencyMs} ms
                      </Text>{' '}
                      • {formatTime(sparkProbes[selectedProbeIdx].timestamp)} (
                      {sparkProbes[selectedProbeIdx].trigger})
                    </Text>
                  </Animated.View>
                ) : null}
              </View>
            ) : null}

            {probes.slice(0, 8).map((p, idx) => {
              const c =
                p.status === 'critical' ? '#EF4444' : p.status === 'degraded' ? '#F59E0B' : '#10B981';
              return (
                <View
                  key={p.id}
                  style={[
                    styles.modRow,
                    { borderBottomColor: dashedBorder },
                    idx === Math.min(7, probes.length - 1) && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowGap}>
                      <Text style={[styles.subName, { color: colors.text }]}>
                        HTTP {p.statusCode} • {p.healthScore}%
                      </Text>
                      <View style={[styles.triggerChip, { backgroundColor: colors.surface, borderColor: dashedBorder }]}>
                        <Text style={[styles.mutedText, { color: colors.textSecondary, fontSize: 10 }]}>
                          {String(p.trigger).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.mutedText, { color: colors.textSecondary }]}>{p.summary}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 11.5, color: c }}>
                      {p.latencyMs} ms
                    </Text>
                    <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                      {formatTime(p.timestamp)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroOuterFrame: {
    borderRadius: 26,
    padding: 3,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  heroCard: {
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 6,
  },
  ambientOrbTop: {
    position: 'absolute',
    top: -36,
    right: -28,
    width: 150,
    height: 150,
    borderRadius: 999,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -50,
    left: -25,
    width: 140,
    height: 140,
    borderRadius: 999,
  },
  heroEyebrow: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: '#94A3B8',
  },
  heroTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16.5,
    color: '#FFF',
  },
  beaconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  beaconCore: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  heroStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  heroStatusText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  heroGaugeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    marginBottom: 16,
  },
  svgGaugeWrap: {
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRadarWrap: {
    position: 'absolute',
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgGaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePercent: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 22,
    lineHeight: 26,
    color: '#FFFFFF',
  },
  gaugeLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: '#94A3B8',
  },
  glassMetaStack: {
    flex: 1,
    gap: 7,
  },
  glassDashedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(148,163,184,0.32)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6.5,
  },
  glassPillLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    flex: 1,
  },
  glassPillValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11.5,
    color: '#F8FAFC',
  },
  heroControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  intervalGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroSubText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11.5,
    color: '#CBD5E1',
  },
  segmentedTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.16)',
    padding: 3,
    gap: 3,
  },
  segmentedItem: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 7,
  },
  segmentedItemActive: {
    backgroundColor: '#F97316',
  },
  segmentedText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#94A3B8',
  },
  heroProbeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 11,
  },
  probeBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11.5,
    color: '#FFF',
  },
  scopeBar: {
    gap: 8,
    paddingVertical: 2,
  },
  scopeChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.2,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.3,
    borderStyle: 'dashed',
    padding: 16,
  },
  centerCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14.5,
  },
  mutedText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiTile: {
    flex: 1,
    borderRadius: 15,
    borderWidth: 1.3,
    borderStyle: 'dashed',
    padding: 12,
    gap: 4,
  },
  kpiTileLbl: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11.5,
  },
  kpiTileVal: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 20,
    lineHeight: 24,
  },
  kpiTag: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
  },
  distBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 14,
    gap: 2,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statusLegendCard: {
    width: '48.5%',
    borderRadius: 13,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11.5,
  },
  legendCount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
  },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 15,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    gap: 11,
  },
  subIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12.5,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  statusPillText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
  },
  miniBarTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
    width: '90%',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EF444414',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#EF444455',
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.2,
  },
  emptyDashedBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glitchItem: {
    borderRadius: 14,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 9,
    gap: 4,
  },
  glitchLoc: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11.5,
  },
  glitchPath: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12.5,
  },
  glitchDetailBox: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: 'rgba(148,163,184,0.28)',
    gap: 3,
  },
  modCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    gap: 8,
  },
  modIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  miniPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  triggerChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  sparkContainer: {
    borderRadius: 15,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  sparkDashedMid: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.45,
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 50,
    gap: 5,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 5,
    minWidth: 6,
  },
  sparkSelectedTip: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: 'rgba(148,163,184,0.25)',
    alignItems: 'center',
  },
});
