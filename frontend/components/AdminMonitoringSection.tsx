import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import { ColorTheme } from '../constants/theme';

interface Props {
  colors: ColorTheme;
  isDark: boolean;
  onAuthError?: () => void;
}

type GlitchFilter = 'all' | 'critical' | 'warning';

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
  if (Number.isNaN(diffMs) || diffMs <= 0) return 'Due now';
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

export default function AdminMonitoringSection({ colors, isDark, onAuthError }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [updatingInterval, setUpdatingInterval] = useState(false);
  const [glitchFilter, setGlitchFilter] = useState<GlitchFilter>('all');
  const [expandedGlitchId, setExpandedGlitchId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('—');

  // Reanimated shared values
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.8);
  const healthBarWidth = useSharedValue(0);
  const probeBtnScale = useSharedValue(1);
  const spinDeg = useSharedValue(0);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.65, { duration: 1100, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 1100 }),
        withTiming(0.85, { duration: 900 })
      ),
      -1,
      false
    );
  }, [pulseScale, pulseOpacity]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const healthBarStyle = useAnimatedStyle(() => ({
    width: `${healthBarWidth.value}%`,
  }));

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
      healthBarWidth.value = withTiming(Math.max(0, Math.min(100, score)), {
        duration: 750,
        easing: Easing.out(Easing.cubic),
      });
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        onAuthError?.();
      }
    } finally {
      setLoading(false);
    }
  }, [onAuthError, healthBarWidth]);

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
    spinDeg.value = withRepeat(withTiming(360, { duration: 750, easing: Easing.linear }), -1, false);
    try {
      const res = await api.post('/admin/monitoring/probe');
      setData(res.data);
      healthBarWidth.value = withTiming(Number(res.data?.healthScore ?? 100), { duration: 600 });
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
        entering={FadeInDown.duration(300)}
        style={[styles.centerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.mutedText, { color: colors.textSecondary, marginTop: 12 }]}>
          Initializing Telemetry & Health Probes...
        </Text>
      </Animated.View>
    );
  }

  const isCrit = data?.overallStatus === 'critical';
  const isDeg = data?.overallStatus === 'degraded';
  const statusColor = isCrit ? '#EF4444' : isDeg ? '#F59E0B' : '#10B981';
  const heroGradient: [string, string] = isCrit
    ? ['#7F1D1D', '#B91C1C']
    : isDeg
      ? ['#78350F', '#D97706']
      : isDark
        ? ['#0F172A', '#1E293B']
        : ['#0F172A', '#1E1B4B'];

  const statusCounts = data?.stats?.statusCounts || { s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0 };
  const totalReq = Math.max(1, Number(data?.stats?.totalRequests || 0));
  const p2xx = Math.round((statusCounts.s2xx / totalReq) * 100);
  const p3xx = Math.round((statusCounts.s3xx / totalReq) * 100);
  const p4xx = Math.round((statusCounts.s4xx / totalReq) * 100);
  const p5xx = Math.max(0, 100 - p2xx - p3xx - p4xx);

  const subsystems: any[] = data?.subsystems || [];
  const allGlitches: any[] = data?.glitches || [];
  const filteredGlitches = allGlitches.filter((g) =>
    glitchFilter === 'all' ? true : g.severity === glitchFilter
  );
  const probes: any[] = data?.probes || [];
  const modules: any[] = data?.modules || [];

  return (
    <View style={{ gap: 14 }}>
      {/* 1. Animated NOC Hero Card */}
      <Animated.View entering={FadeInDown.duration(380).springify()}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.rowBetween}>
            <View style={styles.rowGap}>
              <View style={styles.beaconWrap}>
                <Animated.View
                  style={[styles.beaconRing, { backgroundColor: statusColor }, pulseRingStyle]}
                />
                <View style={[styles.beaconCore, { backgroundColor: statusColor }]} />
              </View>
              <View>
                <Text style={styles.heroEyebrow}>LIVE APP MONITORING</Text>
                <Text style={styles.heroTitle}>System Command Center</Text>
              </View>
            </View>

            <View style={[styles.heroStatusBadge, { backgroundColor: statusColor + '28', borderColor: statusColor + '70' }]}>
              <Radio color={statusColor} size={12} />
              <Text style={[styles.heroStatusText, { color: statusColor }]}>
                {String(data?.overallStatus || 'healthy').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.heroScoreRow}>
            <View>
              <Text style={[styles.heroScoreBig, { color: statusColor }]}>
                {data?.healthScore ?? 100}%
              </Text>
              <Text style={styles.heroSubText}>Overall Health Score</Text>
            </View>

            <View style={styles.heroMetaCol}>
              <Text style={styles.heroMetaLine}>
                Uptime: <Text style={styles.heroMetaStrong}>{formatUptime(data?.uptimeSeconds || 0)}</Text>
              </Text>
              <Text style={styles.heroMetaLine}>
                RAM: <Text style={styles.heroMetaStrong}>{data?.memory?.rssMb || 0} MB</Text> (Heap {data?.memory?.heapUsedMb || 0} MB)
              </Text>
              <Text style={styles.heroMetaLine}>
                Next Auto-Probe: <Text style={[styles.heroMetaStrong, { color: '#38BDF8' }]}>{countdown}</Text>
              </Text>
            </View>
          </View>

          {/* Animated Health Progress Bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, { backgroundColor: statusColor }, healthBarStyle]}
            />
          </View>

          {/* Interval Selector + Animated Run Probe */}
          <View style={styles.heroControls}>
            <View style={styles.rowGap}>
              <Clock color="#94A3B8" size={14} />
              <Text style={styles.heroSubText}>Auto-Check:</Text>
              {([5, 10] as const).map((min) => {
                const active = data?.intervalMinutes === min;
                return (
                  <Pressable
                    key={min}
                    onPress={() => handleSetInterval(min)}
                    style={[
                      styles.heroIntervalChip,
                      active && { backgroundColor: '#F97316', borderColor: '#F97316' },
                    ]}
                  >
                    <Text style={[styles.heroChipText, active && { color: '#FFF' }]}>
                      {min}m
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Animated.View style={probeBtnAnimStyle}>
              <Pressable onPress={handleRunProbe} disabled={probing} style={styles.heroProbeBtn}>
                <Animated.View style={spinStyle}>
                  <RefreshCw color="#FFF" size={13} strokeWidth={2.5} />
                </Animated.View>
                <Text style={styles.probeBtnText}>{probing ? 'Probing...' : 'Run Probe'}</Text>
              </Pressable>
            </Animated.View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* 2. Animated KPI Grid + HTTP Status Distribution Bar */}
      <Animated.View
        entering={FadeInDown.delay(80).duration(380).springify()}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.rowBetween, { marginBottom: 12 }]}>
          <View style={styles.rowGap}>
            <Zap color={colors.secondary} size={17} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Traffic & HTTP Status Codes</Text>
          </View>
          <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
            Last: {formatTime(data?.lastProbeAt)}
          </Text>
        </View>

        <View style={styles.kpiGrid}>
          {[
            { label: 'Requests', val: String(data?.stats?.totalRequests ?? 0), color: colors.text },
            { label: 'Success', val: `${data?.stats?.successRate ?? 100}%`, color: '#10B981' },
            { label: 'Avg Speed', val: `${data?.stats?.avgLatencyMs ?? 0}ms`, color: colors.primary },
            { label: 'P95 Speed', val: `${data?.stats?.p95LatencyMs ?? 0}ms`, color: colors.secondary },
          ].map((k, idx) => (
            <Animated.View
              key={k.label}
              entering={ZoomIn.delay(100 + idx * 50).duration(300)}
              style={[styles.kpiBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.kpiVal, { color: k.color }]}>{k.val}</Text>
              <Text style={[styles.kpiLbl, { color: colors.textSecondary }]}>{k.label}</Text>
            </Animated.View>
          ))}
        </View>

        {/* Proportional Status Bar */}
        {data?.stats?.totalRequests > 0 ? (
          <View style={styles.distBarTrack}>
            {p2xx > 0 && <View style={{ flex: p2xx, backgroundColor: '#10B981' }} />}
            {p3xx > 0 && <View style={{ flex: p3xx, backgroundColor: '#3B82F6' }} />}
            {p4xx > 0 && <View style={{ flex: p4xx, backgroundColor: '#F59E0B' }} />}
            {p5xx > 0 && <View style={{ flex: p5xx, backgroundColor: '#EF4444' }} />}
          </View>
        ) : null}

        <View style={styles.statusCodeRow}>
          {[
            { label: '2xx OK', count: statusCounts.s2xx, color: '#10B981' },
            { label: '3xx Redir', count: statusCounts.s3xx, color: '#3B82F6' },
            { label: '4xx Warn', count: statusCounts.s4xx, color: '#F59E0B' },
            { label: '5xx Err', count: statusCounts.s5xx, color: '#EF4444' },
          ].map((b) => (
            <View key={b.label} style={[styles.codeBadge, { backgroundColor: b.color + '16' }]}>
              <Text style={[styles.codeText, { color: b.color }]}>
                {b.label}: {b.count}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* 3. Subsystem Health Matrix */}
      <Animated.View
        entering={FadeInDown.delay(140).duration(380).springify()}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.rowGap, { marginBottom: 10 }]}>
          <Server color={colors.primary} size={17} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Subsystem Health Checks</Text>
        </View>

        {subsystems.map((sub, idx) => {
          const Icon = getSubsystemIcon(sub.name);
          const c = sub.status === 'ok' ? '#10B981' : sub.status === 'degraded' ? '#F59E0B' : '#EF4444';
          const barPct = Math.min(100, Math.max(8, Math.round((Number(sub.latencyMs || 5) / 250) * 100)));
          return (
            <Animated.View
              key={sub.name}
              entering={FadeInRight.delay(idx * 45).duration(280)}
              style={[
                styles.subRow,
                idx < subsystems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.subIconBox, { backgroundColor: c + '16' }]}>
                <Icon color={c} size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subName, { color: colors.text }]}>{sub.name}</Text>
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>{sub.detail}</Text>
                {sub.latencyMs > 0 ? (
                  <View style={[styles.miniBarTrack, { backgroundColor: colors.surface }]}>
                    <View style={[styles.miniBarFill, { width: `${barPct}%`, backgroundColor: c }]} />
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.statusPill, { backgroundColor: c + '18' }]}>
                  <Text style={[styles.statusPillText, { color: c }]}>
                    {sub.statusCode} • {String(sub.status).toUpperCase()}
                  </Text>
                </View>
                {sub.latencyMs > 0 ? (
                  <Text style={[styles.mutedText, { color: colors.textSecondary, marginTop: 3 }]}>
                    {sub.latencyMs} ms
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* 4. Interactive Glitch Locator */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(380).springify()}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.rowBetween, { marginBottom: 10 }]}>
          <View style={styles.rowGap}>
            <AlertTriangle color={allGlitches.length > 0 ? '#EF4444' : '#10B981'} size={17} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Glitch Locator ({allGlitches.length})
            </Text>
          </View>
          {allGlitches.length > 0 ? (
            <Pressable onPress={handleClearGlitches} style={styles.rowGap}>
              <Trash2 color="#EF4444" size={14} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#EF4444' }}>
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>

        {allGlitches.length > 0 ? (
          <View style={[styles.rowGap, { marginBottom: 10 }]}>
            {(['all', 'critical', 'warning'] as GlitchFilter[]).map((f) => {
              const active = glitchFilter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setGlitchFilter(f);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.secondary : colors.surface,
                      borderColor: active ? colors.secondary : colors.border,
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
                    {f === 'all' ? 'All' : f === 'critical' ? 'Critical (5xx)' : 'Warnings (4xx)'}
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
              styles.emptyBox,
              { backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#ECFDF5' },
            ]}
          >
            <CheckCircle2 color="#10B981" size={24} />
            <Text style={[styles.subName, { color: '#10B981', marginTop: 6 }]}>
              Zero Glitches Detected
            </Text>
            <Text style={[styles.mutedText, { color: colors.textSecondary, textAlign: 'center' }]}>
              All routes are responding cleanly with no anomalies.
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
                style={[styles.glitchItem, { backgroundColor: colors.surface, borderLeftColor: c }]}
              >
                <View style={styles.rowBetween}>
                  <View style={styles.rowGap}>
                    <View style={[styles.statusPill, { backgroundColor: c + '20' }]}>
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
                  <Animated.View entering={FadeInDown.duration(200)} style={styles.glitchDetailBox}>
                    <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                      Latency: <Text style={{ color: colors.text }}>{g.durationMs} ms</Text> • Severity:{' '}
                      <Text style={{ color: c, fontFamily: 'Poppins_600SemiBold' }}>
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

      {/* 5. Module Performance */}
      {modules.length > 0 ? (
        <Animated.View
          entering={FadeInDown.delay(240).duration(380).springify()}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.rowGap, { marginBottom: 10 }]}>
            <Cpu color={colors.secondary} size={17} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Module Performance</Text>
          </View>
          {modules.map((m) => (
            <View key={m.name} style={[styles.modRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.subName, { color: colors.text, flex: 1 }]}>{m.name}</Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                {m.total} req • {m.avgMs}ms •{' '}
                <Text style={{ color: m.errors5xx > 0 ? '#EF4444' : '#10B981', fontFamily: 'Poppins_600SemiBold' }}>
                  {m.errors5xx} err
                </Text>
              </Text>
            </View>
          ))}
        </Animated.View>
      ) : null}

      {/* 6. Visual Probe Sparkline & History */}
      <Animated.View
        entering={FadeInDown.delay(280).duration(380).springify()}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.rowBetween, { marginBottom: 12 }]}>
          <View style={styles.rowGap}>
            <Activity color="#10B981" size={17} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              5/10m Probe Timeline ({probes.length})
            </Text>
          </View>
        </View>

        {probes.length > 0 ? (
          <View style={[styles.sparkRow, { backgroundColor: colors.surface }]}>
            {probes
              .slice(0, 16)
              .reverse()
              .map((p) => {
                const c =
                  p.status === 'critical' ? '#EF4444' : p.status === 'degraded' ? '#F59E0B' : '#10B981';
                const h = Math.max(10, Math.round((Number(p.healthScore || 100) / 100) * 34));
                return <View key={p.id} style={[styles.sparkBar, { height: h, backgroundColor: c }]} />;
              })}
          </View>
        ) : null}

        {probes.slice(0, 8).map((p) => {
          const c = p.status === 'critical' ? '#EF4444' : p.status === 'degraded' ? '#F59E0B' : '#10B981';
          return (
            <View key={p.id} style={[styles.modRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subName, { color: colors.text }]}>
                  HTTP {p.statusCode} • {p.healthScore}% ({p.trigger})
                </Text>
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>{p.summary}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: c }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  heroEyebrow: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#94A3B8',
  },
  heroTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
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
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heroStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroStatusText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10.5,
  },
  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  heroScoreBig: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 38,
    lineHeight: 42,
  },
  heroSubText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
    color: '#CBD5E1',
  },
  heroMetaCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  heroMetaLine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
    color: '#CBD5E1',
  },
  heroMetaStrong: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFF',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  heroControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroIntervalChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroChipText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#CBD5E1',
  },
  heroProbeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F97316',
  },
  probeBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11.5,
    color: '#FFF',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  centerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 36,
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
    fontSize: 14,
  },
  mutedText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  kpiVal: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14.5,
  },
  kpiLbl: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
  },
  distBarTrack: {
    flexDirection: 'row',
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
    gap: 2,
  },
  statusCodeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  codeBadge: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  codeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10.5,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  subIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12.5,
  },
  miniBarTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 5,
    width: '85%',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  emptyBox: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  glitchItem: {
    borderRadius: 12,
    borderLeftWidth: 3.5,
    padding: 11,
    marginBottom: 8,
    gap: 4,
  },
  glitchLoc: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11.5,
  },
  glitchPath: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  glitchDetailBox: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.2)',
    gap: 3,
  },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 5,
    marginBottom: 10,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 4,
    minWidth: 6,
  },
});
