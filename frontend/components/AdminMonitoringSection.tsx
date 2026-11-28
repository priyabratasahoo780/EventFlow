import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Rect } from 'react-native-svg';
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
  SharedValue,
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
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface Props {
  colors: ColorTheme;
  isDark: boolean;
  onAuthError?: () => void;
}

type GlitchFilter = 'all' | 'critical' | 'warning';
type SectionScope = 'all' | 'traffic' | 'subsystems' | 'glitches' | 'timeline';

/**
 * Renders a razor-sharp SVG dashed border around any box size on Android & iOS
 * (avoids Android's native View borderStyle:'dashed' + borderRadius rendering limits).
 */
function SvgDashedFrame({
  borderColor,
  borderRadius = 18,
  strokeWidth = 1.5,
  dashArray = '7 5',
  animatedOffset,
  backgroundColor = 'transparent',
  style,
  children,
}: {
  borderColor: string;
  borderRadius?: number;
  strokeWidth?: number;
  dashArray?: string;
  animatedOffset?: SharedValue<number>;
  backgroundColor?: string;
  style?: any;
  children: React.ReactNode;
}) {
  const [dim, setDim] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - dim.w) > 1 || Math.abs(height - dim.h) > 1) {
      setDim({ w: Math.round(width), h: Math.round(height) });
    }
  };

  const animRectProps = useAnimatedProps(() => ({
    strokeDashoffset: animatedOffset ? animatedOffset.value : 0,
  }));

  const half = strokeWidth / 2;

  return (
    <View onLayout={onLayout} style={[{ borderRadius, backgroundColor, position: 'relative' }, style]}>
      {dim.w > 0 && dim.h > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 2 }]}>
          <Svg width={dim.w} height={dim.h}>
            {animatedOffset ? (
              <AnimatedRect
                x={half}
                y={half}
                width={Math.max(0, dim.w - strokeWidth)}
                height={Math.max(0, dim.h - strokeWidth)}
                rx={borderRadius}
                ry={borderRadius}
                stroke={borderColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                fill="none"
                animatedProps={animRectProps}
              />
            ) : (
              <Rect
                x={half}
                y={half}
                width={Math.max(0, dim.w - strokeWidth)}
                height={Math.max(0, dim.h - strokeWidth)}
                rx={borderRadius}
                ry={borderRadius}
                stroke={borderColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                fill="none"
              />
            )}
          </Svg>
        </View>
      )}
      {children}
    </View>
  );
}

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
  if (name.includes('Gateway') || name.includes('HTTP')) return Activity;
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

  // SVG Ring constants
  const OUTER_SIZE = 114;
  const RING_SIZE = 96;
  const STROKE_WIDTH = 8;
  const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // Reanimated shared values
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.85);
  const animatedScore = useSharedValue(0);
  const floatY = useSharedValue(0);
  const floatAltY = useSharedValue(0);
  const cardFloatY = useSharedValue(0);
  const orbFloatY = useSharedValue(0);
  const radarDeg = useSharedValue(0);
  const dashFlowOffset = useSharedValue(0);
  const probeBtnScale = useSharedValue(1);
  const spinDeg = useSharedValue(0);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.9, { duration: 1100, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.08, { duration: 1100 }),
        withTiming(0.85, { duration: 900 })
      ),
      -1,
      false
    );

    floatY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1850, easing: Easing.inOut(Easing.sin) }),
        withTiming(5, { duration: 1850, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    floatAltY.value = withRepeat(
      withSequence(
        withTiming(3.5, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(-3.5, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    cardFloatY.value = withRepeat(
      withSequence(
        withTiming(-2.5, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(2.5, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    orbFloatY.value = withRepeat(
      withSequence(
        withTiming(12, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-12, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    radarDeg.value = withRepeat(
      withTiming(360, { duration: 16000, easing: Easing.linear }),
      -1,
      false
    );

    // Flowing dashed border animation around Hero Command Center
    dashFlowOffset.value = withRepeat(
      withTiming(-28, { duration: 1600, easing: Easing.linear }),
      -1,
      false
    );
  }, [pulseScale, pulseOpacity, floatY, floatAltY, cardFloatY, orbFloatY, radarDeg, dashFlowOffset]);

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

  const cardFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardFloatY.value }],
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
      const score = Number(res.data?.healthScore ?? 0);
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
      animatedScore.value = withTiming(Number(res.data?.healthScore ?? 0), { duration: 650 });
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
      <Animated.View entering={FadeIn.duration(280)}>
        <SvgDashedFrame
          borderColor="#F9731680"
          borderRadius={20}
          backgroundColor={colors.card}
          style={styles.centerCard}
        >
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={[styles.subName, { color: colors.text, marginTop: 14 }]}>
            Initializing Telemetry Stream...
          </Text>
          <Text style={[styles.mutedText, { color: colors.textSecondary, marginTop: 4 }]}>
            Probing server health, HTTP metrics & subsystems
          </Text>
        </SvgDashedFrame>
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
  const dashedBorder = isDark ? 'rgba(148,163,184,0.38)' : 'rgba(100,116,139,0.32)';

  return (
    <View style={{ gap: 16 }}>
      {/* 1. Floating Hero Card with Animated Flowing Dashed SVG Border */}
      <Animated.View entering={FadeInDown.duration(380).springify()} style={cardFloatStyle}>
        <SvgDashedFrame
          borderColor={statusColor + '95'}
          borderRadius={26}
          strokeWidth={2}
          dashArray="9 5"
          animatedOffset={dashFlowOffset}
          style={{ padding: 4 }}
        >
          <LinearGradient
            colors={heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Floating Ambient Glow Orbs */}
            <Animated.View
              style={[styles.ambientOrbTop, { backgroundColor: statusColor + '1F' }, orbFloatStyle]}
            />
            <Animated.View
              style={[styles.ambientOrbBottom, { backgroundColor: '#6366F128' }, floatAltStyle]}
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

              <SvgDashedFrame
                borderColor={statusColor + '90'}
                borderRadius={999}
                strokeWidth={1.2}
                dashArray="4 3"
                backgroundColor={statusColor + '20'}
              >
                <View style={styles.heroStatusBadge}>
                  <Radio color={statusColor} size={12} />
                  <Text style={[styles.heroStatusText, { color: statusColor }]}>
                    {String(data?.overallStatus || 'healthy').toUpperCase()}
                  </Text>
                </View>
              </SvgDashedFrame>
            </View>

            {/* Floating Dual-Ring SVG Gauge + Dashed Glassmorphic Pills */}
            <View style={styles.heroGaugeSection}>
              <Animated.View style={[styles.svgGaugeWrap, floatGaugeStyle]}>
                {/* Rotating Outer Dashed Radar Ring */}
                <Animated.View style={[styles.outerRadarWrap, radarSpinStyle]}>
                  <Svg width={OUTER_SIZE} height={OUTER_SIZE}>
                    <Circle
                      cx={OUTER_SIZE / 2}
                      cy={OUTER_SIZE / 2}
                      r={(OUTER_SIZE - 4) / 2}
                      stroke={statusColor + '85'}
                      strokeWidth={1.8}
                      strokeDasharray="6 5"
                      fill="none"
                    />
                  </Svg>
                </Animated.View>

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
                  <Text style={styles.gaugePercent}>
                    {typeof data?.healthScore === 'number' ? `${data.healthScore}%` : '—'}
                  </Text>
                  <Text style={styles.gaugeLabel}>HEALTH</Text>
                </View>
              </Animated.View>

              <Animated.View style={[styles.glassMetaStack, floatAltStyle]}>
                {[
                  { icon: Clock, iconColor: '#94A3B8', label: 'Uptime', value: formatUptime(data?.uptimeSeconds || 0), valColor: '#F8FAFC' },
                  {
                    icon: HardDrive,
                    iconColor: '#A78BFA',
                    label: 'Memory',
                    value: `${data?.memory?.rssMb || 0}M (${data?.memory?.heapUsedMb || 0}M)`,
                    valColor: '#F8FAFC',
                  },
                  { icon: Activity, iconColor: '#38BDF8', label: 'Next Probe', value: countdown, valColor: '#38BDF8' },
                ].map((pill) => {
                  const PillIcon = pill.icon;
                  return (
                    <SvgDashedFrame
                      key={pill.label}
                      borderColor="rgba(148,163,184,0.38)"
                      borderRadius={12}
                      strokeWidth={1.2}
                      dashArray="5 4"
                      backgroundColor="rgba(255,255,255,0.06)"
                    >
                      <View style={styles.glassDashedPill}>
                        <PillIcon color={pill.iconColor} size={13} />
                        <Text style={styles.glassPillLabel}>{pill.label}</Text>
                        <Text style={[styles.glassPillValue, { color: pill.valColor }]}>
                          {pill.value}
                        </Text>
                      </View>
                    </SvgDashedFrame>
                  );
                })}
              </Animated.View>
            </View>

            {/* Bottom Dashed Dock */}
            <View style={styles.heroControls}>
              <View style={styles.intervalGroup}>
                <Text style={styles.heroSubText}>Auto-Check</Text>
                <SvgDashedFrame
                  borderColor="rgba(255,255,255,0.22)"
                  borderRadius={10}
                  strokeWidth={1.1}
                  dashArray="4 3"
                  backgroundColor="rgba(255,255,255,0.06)"
                >
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
                </SvgDashedFrame>
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
        </SvgDashedFrame>
      </Animated.View>

      {/* Dashed Scope Switcher Pills */}
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
            >
              <SvgDashedFrame
                borderColor={active ? '#FF7A00' : dashedBorder}
                borderRadius={999}
                strokeWidth={1.3}
                dashArray={active ? '10 0' : '5 4'}
                backgroundColor={active ? '#FF7A00' : colors.card}
              >
                <View style={styles.scopeChipInner}>
                  <Text
                    style={{
                      fontFamily: active ? 'Poppins_700Bold' : 'Poppins_600SemiBold',
                      fontSize: 11.5,
                      color: active ? '#FFF' : colors.textSecondary,
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              </SvgDashedFrame>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 2. Dashed 2x2 Floating KPI Grid & Status Matrix */}
      {showSection('traffic') && (
        <Animated.View entering={FadeInDown.delay(60).duration(360).springify()}>
          <SvgDashedFrame
            borderColor={dashedBorder}
            borderRadius={22}
            strokeWidth={1.5}
            dashArray="7 5"
            backgroundColor={colors.card}
            style={styles.cardShadow}
          >
            <View style={styles.cardInner}>
              <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                <View style={styles.rowGap}>
                  <SvgDashedFrame
                    borderColor="#F9731670"
                    borderRadius={11}
                    strokeWidth={1.2}
                    dashArray="4 3"
                    backgroundColor="#F9731618"
                  >
                    <View style={styles.cardIconBadge}>
                      <Zap color="#F97316" size={16} strokeWidth={2.4} />
                    </View>
                  </SvgDashedFrame>
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
                <Animated.View entering={ZoomIn.delay(80).duration(300)} style={[{ flex: 1 }, floatAltStyle]}>
                  <SvgDashedFrame
                    borderColor="#6366F170"
                    borderRadius={15}
                    strokeWidth={1.4}
                    dashArray="6 4"
                    backgroundColor={colors.surface}
                  >
                    <View style={styles.kpiTile}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.kpiTileLbl, { color: colors.textSecondary }]}>Total Requests</Text>
                        <Layers color="#6366F1" size={14} />
                      </View>
                      <Text style={[styles.kpiTileVal, { color: colors.text }]}>{rawTotalReq}</Text>
                      <Text style={[styles.kpiTag, { color: '#6366F1' }]}>Live Window</Text>
                    </View>
                  </SvgDashedFrame>
                </Animated.View>

                <Animated.View entering={ZoomIn.delay(130).duration(300)} style={[{ flex: 1 }, floatGaugeStyle]}>
                  <SvgDashedFrame
                    borderColor="#10B98170"
                    borderRadius={15}
                    strokeWidth={1.4}
                    dashArray="6 4"
                    backgroundColor={colors.surface}
                  >
                    <View style={styles.kpiTile}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.kpiTileLbl, { color: colors.textSecondary }]}>Success Rate</Text>
                        <ShieldCheck color="#10B981" size={14} />
                      </View>
                      <Text style={[styles.kpiTileVal, { color: '#10B981' }]}>
                        {typeof data?.stats?.successRate === 'number' ? `${data.stats.successRate}%` : '—'}
                      </Text>
                      <Text style={[styles.kpiTag, { color: '#10B981' }]}>
                        {rawTotalReq > 0 ? `${statusCounts.s5xx} Server Err` : 'Awaiting Traffic'}
                      </Text>
                    </View>
                  </SvgDashedFrame>
                </Animated.View>
              </View>

              <View style={[styles.kpiRow, { marginTop: 10 }]}>
                <Animated.View entering={ZoomIn.delay(180).duration(300)} style={[{ flex: 1 }, floatGaugeStyle]}>
                  <SvgDashedFrame
                    borderColor={getLatencyColor(avgSpeed) + '75'}
                    borderRadius={15}
                    strokeWidth={1.4}
                    dashArray="6 4"
                    backgroundColor={colors.surface}
                  >
                    <View style={styles.kpiTile}>
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
                    </View>
                  </SvgDashedFrame>
                </Animated.View>

                <Animated.View entering={ZoomIn.delay(230).duration(300)} style={[{ flex: 1 }, floatAltStyle]}>
                  <SvgDashedFrame
                    borderColor={getLatencyColor(p95Speed) + '75'}
                    borderRadius={15}
                    strokeWidth={1.4}
                    dashArray="6 4"
                    backgroundColor={colors.surface}
                  >
                    <View style={styles.kpiTile}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.kpiTileLbl, { color: colors.textSecondary }]}>P95 Latency</Text>
                        <Activity color={getLatencyColor(p95Speed)} size={14} />
                      </View>
                      <Text style={[styles.kpiTileVal, { color: getLatencyColor(p95Speed) }]}>
                        {p95Speed} ms
                      </Text>
                      <Text style={[styles.kpiTag, { color: colors.textSecondary }]}>95th Percentile</Text>
                    </View>
                  </SvgDashedFrame>
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

              {/* 2x2 Dashed Status Legend Pods */}
              <View style={styles.statusGrid}>
                {[
                  { label: '2xx Healthy', count: statusCounts.s2xx, pct: p2xx, color: '#10B981' },
                  { label: '3xx Cached', count: statusCounts.s3xx, pct: p3xx, color: '#3B82F6' },
                  { label: '4xx Client Warn', count: statusCounts.s4xx, pct: p4xx, color: '#F59E0B' },
                  { label: '5xx Server Err', count: statusCounts.s5xx, pct: p5xx, color: '#EF4444' },
                ].map((item) => (
                  <View key={item.label} style={{ width: '48.5%' }}>
                    <SvgDashedFrame
                      borderColor={item.color + '75'}
                      borderRadius={13}
                      strokeWidth={1.3}
                      dashArray="5 4"
                      backgroundColor={item.color + '10'}
                    >
                      <View style={styles.statusLegendCard}>
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
                    </SvgDashedFrame>
                  </View>
                ))}
              </View>
            </View>
          </SvgDashedFrame>
        </Animated.View>
      )}

      {/* 3. Dashed Subsystem Health Checks */}
      {showSection('subsystems') && (
        <Animated.View entering={FadeInDown.delay(110).duration(360).springify()}>
          <SvgDashedFrame
            borderColor={dashedBorder}
            borderRadius={22}
            strokeWidth={1.5}
            dashArray="7 5"
            backgroundColor={colors.card}
            style={styles.cardShadow}
          >
            <View style={styles.cardInner}>
              <View style={[styles.rowGap, { marginBottom: 12 }]}>
                <SvgDashedFrame
                  borderColor="#6366F170"
                  borderRadius={11}
                  strokeWidth={1.2}
                  dashArray="4 3"
                  backgroundColor="#6366F118"
                >
                  <View style={styles.cardIconBadge}>
                    <Server color="#6366F1" size={16} strokeWidth={2.4} />
                  </View>
                </SvgDashedFrame>
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
                  const barPct = Math.min(100, Math.round((lat / 500) * 100));
                  return (
                    <Animated.View key={sub.name} entering={FadeInRight.delay(idx * 50).duration(300)}>
                      <SvgDashedFrame
                        borderColor={c + '65'}
                        borderRadius={15}
                        strokeWidth={1.3}
                        dashArray="6 4"
                        backgroundColor={colors.surface}
                      >
                        <View style={styles.subCard}>
                          <SvgDashedFrame
                            borderColor={c + '70'}
                            borderRadius={11}
                            strokeWidth={1.2}
                            dashArray="4 3"
                            backgroundColor={c + '18'}
                          >
                            <View style={styles.subIconBox}>
                              <Icon color={c} size={18} />
                            </View>
                          </SvgDashedFrame>
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
                            <SvgDashedFrame
                              borderColor={c + '65'}
                              borderRadius={999}
                              strokeWidth={1}
                              dashArray="3 2"
                              backgroundColor={c + '18'}
                            >
                              <View style={styles.statusPill}>
                                <Text style={[styles.statusPillText, { color: c }]}>
                                  {sub.statusCode} • {String(sub.status).toUpperCase()}
                                </Text>
                              </View>
                            </SvgDashedFrame>
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
                        </View>
                      </SvgDashedFrame>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          </SvgDashedFrame>
        </Animated.View>
      )}

      {/* 4. Dashed & Floating Glitch Locator */}
      {showSection('glitches') && (
        <Animated.View entering={FadeInDown.delay(150).duration(360).springify()}>
          <SvgDashedFrame
            borderColor={dashedBorder}
            borderRadius={22}
            strokeWidth={1.5}
            dashArray="7 5"
            backgroundColor={colors.card}
            style={styles.cardShadow}
          >
            <View style={styles.cardInner}>
              <View style={[styles.rowBetween, { marginBottom: 12 }]}>
                <View style={styles.rowGap}>
                  <SvgDashedFrame
                    borderColor={(critCount > 0 ? '#EF4444' : '#10B981') + '70'}
                    borderRadius={11}
                    strokeWidth={1.2}
                    dashArray="4 3"
                    backgroundColor={(critCount > 0 ? '#EF4444' : '#10B981') + '18'}
                  >
                    <View style={styles.cardIconBadge}>
                      <AlertTriangle
                        color={critCount > 0 ? '#EF4444' : allGlitches.length > 0 ? '#F59E0B' : '#10B981'}
                        size={16}
                      />
                    </View>
                  </SvgDashedFrame>
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
                  <Pressable onPress={handleClearGlitches}>
                    <SvgDashedFrame
                      borderColor="#EF444475"
                      borderRadius={999}
                      strokeWidth={1.2}
                      dashArray="4 3"
                      backgroundColor="#EF444412"
                    >
                      <View style={styles.clearBtn}>
                        <Trash2 color="#EF4444" size={13} />
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: '#EF4444' }}>
                          Clear
                        </Text>
                      </View>
                    </SvgDashedFrame>
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
                      >
                        <SvgDashedFrame
                          borderColor={active ? '#FF7A00' : dashedBorder}
                          borderRadius={999}
                          strokeWidth={1.2}
                          dashArray={active ? '10 0' : '4 3'}
                          backgroundColor={active ? '#FF7A00' : colors.surface}
                        >
                          <View style={styles.filterChip}>
                            <Text
                              style={{
                                fontFamily: 'Poppins_600SemiBold',
                                fontSize: 11,
                                color: active ? '#FFF' : colors.textSecondary,
                              }}
                            >
                              {f.label}
                            </Text>
                          </View>
                        </SvgDashedFrame>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {filteredGlitches.length === 0 ? (
                <Animated.View entering={ZoomIn.duration(300)}>
                  <SvgDashedFrame
                    borderColor="#10B98180"
                    borderRadius={16}
                    strokeWidth={1.6}
                    dashArray="7 5"
                    backgroundColor={isDark ? 'rgba(16,185,129,0.08)' : '#ECFDF5'}
                  >
                    <View style={styles.emptyDashedBox}>
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
                    </View>
                  </SvgDashedFrame>
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
                      style={{ marginBottom: 9 }}
                    >
                      <SvgDashedFrame
                        borderColor={c + '85'}
                        borderRadius={14}
                        strokeWidth={1.4}
                        dashArray="6 4"
                        backgroundColor={colors.surface}
                      >
                        <View style={styles.glitchItem}>
                          <View style={styles.rowBetween}>
                            <View style={styles.rowGap}>
                              <SvgDashedFrame
                                borderColor={c + '75'}
                                borderRadius={999}
                                strokeWidth={1}
                                dashArray="3 2"
                                backgroundColor={c + '20'}
                              >
                                <View style={styles.statusPill}>
                                  <Text style={[styles.statusPillText, { color: c }]}>{g.statusCode}</Text>
                                </View>
                              </SvgDashedFrame>
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
                        </View>
                      </SvgDashedFrame>
                    </Pressable>
                  );
                })
              )}
            </View>
          </SvgDashedFrame>
        </Animated.View>
      )}

      {/* 5. Module Performance & Probe Timeline */}
      {showSection('timeline') && (
        <>
          {modules.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(190).duration(360).springify()}>
              <SvgDashedFrame
                borderColor={dashedBorder}
                borderRadius={22}
                strokeWidth={1.5}
                dashArray="7 5"
                backgroundColor={colors.card}
                style={styles.cardShadow}
              >
                <View style={styles.cardInner}>
                  <View style={[styles.rowGap, { marginBottom: 12 }]}>
                    <SvgDashedFrame
                      borderColor="#6366F170"
                      borderRadius={11}
                      strokeWidth={1.2}
                      dashArray="4 3"
                      backgroundColor="#6366F118"
                    >
                      <View style={styles.cardIconBadge}>
                        <Cpu color="#6366F1" size={16} />
                      </View>
                    </SvgDashedFrame>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Module Performance
                      </Text>
                      <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                        Per-route traffic, speed & error rate
                      </Text>
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    {modules.map((m, idx) => {
                      const ModIcon = getModuleIcon(m.name);
                      const speedCol = getLatencyColor(m.avgMs);
                      return (
                        <Animated.View key={m.name} entering={FadeInRight.delay(idx * 40).duration(260)}>
                          <SvgDashedFrame
                            borderColor={dashedBorder}
                            borderRadius={13}
                            strokeWidth={1.2}
                            dashArray="5 4"
                            backgroundColor={colors.surface}
                          >
                            <View style={styles.modCardRow}>
                              <View style={[styles.modIconCircle, { backgroundColor: '#6366F116' }]}>
                                <ModIcon color="#6366F1" size={14} />
                              </View>
                              <Text style={[styles.subName, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                                {m.name}
                              </Text>
                              <View style={styles.rowGap}>
                                <View style={[styles.miniPill, { backgroundColor: colors.card }]}>
                                  <Text style={[styles.mutedText, { color: colors.text, fontSize: 10.5 }]}>
                                    {m.total} req
                                  </Text>
                                </View>
                                <View style={[styles.miniPill, { backgroundColor: speedCol + '16' }]}>
                                  <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: speedCol }}>
                                    {m.avgMs}ms
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.miniPill,
                                    { backgroundColor: (m.errors5xx > 0 ? '#EF4444' : '#10B981') + '18' },
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
                            </View>
                          </SvgDashedFrame>
                        </Animated.View>
                      );
                    })}
                  </View>
                </View>
              </SvgDashedFrame>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(230).duration(360).springify()}>
            <SvgDashedFrame
              borderColor={dashedBorder}
              borderRadius={22}
              strokeWidth={1.5}
              dashArray="7 5"
              backgroundColor={colors.card}
              style={styles.cardShadow}
            >
              <View style={styles.cardInner}>
                <View style={[styles.rowBetween, { marginBottom: 12 }]}>
                  <View style={styles.rowGap}>
                    <SvgDashedFrame
                      borderColor="#10B98170"
                      borderRadius={11}
                      strokeWidth={1.2}
                      dashArray="4 3"
                      backgroundColor="#10B98118"
                    >
                      <View style={styles.cardIconBadge}>
                        <Activity color="#10B981" size={16} />
                      </View>
                    </SvgDashedFrame>
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
                  <SvgDashedFrame
                    borderColor={dashedBorder}
                    borderRadius={15}
                    strokeWidth={1.3}
                    dashArray="5 4"
                    backgroundColor={colors.surface}
                    style={{ marginBottom: 12 }}
                  >
                    <View style={styles.sparkContainer}>
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
                  </SvgDashedFrame>
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
                          <View style={[styles.triggerChip, { backgroundColor: colors.surface }]}>
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
              </View>
            </SvgDashedFrame>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 22,
    padding: 17,
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
    marginTop: 16,
    marginBottom: 15,
  },
  svgGaugeWrap: {
    width: 114,
    height: 114,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRadarWrap: {
    position: 'absolute',
    width: 114,
    height: 114,
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
    fontSize: 21.5,
    lineHeight: 25,
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
    borderTopColor: 'rgba(255,255,255,0.14)',
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
  scopeChipInner: {
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardInner: {
    padding: 16,
  },
  centerCard: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBadge: {
    width: 36,
    height: 36,
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
    gap: 11,
  },
  subIconBox: {
    width: 38,
    height: 38,
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
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  emptyDashedBox: {
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
    padding: 12,
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
    borderTopColor: 'rgba(148,163,184,0.22)',
    gap: 3,
  },
  modCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 10,
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
    gap: 8,
  },
  miniPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  triggerChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sparkContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sparkDashedMid: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    borderTopWidth: 1,
    opacity: 0.35,
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
    borderTopColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center',
  },
});
