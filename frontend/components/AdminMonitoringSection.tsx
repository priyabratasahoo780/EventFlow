import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import { ColorTheme } from '../constants/theme';

interface Props {
  colors: ColorTheme;
  isDark: boolean;
  onAuthError?: () => void;
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
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${sec % 60}s`;
}

export default function AdminMonitoringSection({ colors, isDark, onAuthError }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [updatingInterval, setUpdatingInterval] = useState(false);

  const fetchMonitoring = useCallback(async () => {
    try {
      const res = await api.get('/admin/monitoring');
      setData(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        onAuthError?.();
      }
    } finally {
      setLoading(false);
    }
  }, [onAuthError]);

  useEffect(() => {
    fetchMonitoring();
    const timer = setInterval(fetchMonitoring, 30000);
    return () => clearInterval(timer);
  }, [fetchMonitoring]);

  const handleRunProbe = async () => {
    if (probing) return;
    setProbing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const res = await api.post('/admin/monitoring/probe');
      setData(res.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert('Probe Failed', err?.response?.data?.error || 'Could not run health probe.');
    } finally {
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
    Alert.alert('Clear Glitch Logs', 'Clear all recorded glitch history from memory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await api.delete('/admin/monitoring/glitches');
            setData(res.data);
          } catch {
            Alert.alert('Error', 'Failed to clear glitch logs.');
          }
        },
      },
    ]);
  };

  if (loading && !data) {
    return (
      <View style={[styles.centerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.mutedText, { color: colors.textSecondary, marginTop: 10 }]}>
          Loading App Monitoring Center...
        </Text>
      </View>
    );
  }

  const statusColor =
    data?.overallStatus === 'critical'
      ? colors.error
      : data?.overallStatus === 'degraded'
        ? '#F59E0B'
        : colors.success;

  const statusCounts = data?.stats?.statusCounts || { s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0 };
  const subsystems: any[] = data?.subsystems || [];
  const glitches: any[] = data?.glitches || [];
  const probes: any[] = data?.probes || [];
  const modules: any[] = data?.modules || [];

  return (
    <View style={{ gap: 14 }}>
      {/* Hero Health Score Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: statusColor + '45',
          },
        ]}
      >
        <View style={styles.rowBetween}>
          <View style={styles.rowGap}>
            <View style={[styles.iconBox, { backgroundColor: statusColor + '18' }]}>
              <Activity color={statusColor} size={20} strokeWidth={2.4} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>App Monitoring Center</Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                Secured Admin Telemetry • Auto-Probe {data?.intervalMinutes || 5}m
              </Text>
            </View>
          </View>

          <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {String(data?.overallStatus || 'healthy').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.scoreRow}>
          <View>
            <Text style={[styles.scoreBig, { color: statusColor }]}>
              {data?.healthScore ?? 100}%
            </Text>
            <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
              Health Score
            </Text>
          </View>

          <View style={styles.metaCol}>
            <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
              Uptime: <Text style={{ color: colors.text, fontFamily: 'Poppins_600SemiBold' }}>{formatUptime(data?.uptimeSeconds || 0)}</Text>
            </Text>
            <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
              RAM: <Text style={{ color: colors.text, fontFamily: 'Poppins_600SemiBold' }}>{data?.memory?.rssMb || 0} MB</Text> (Heap {data?.memory?.heapUsedMb || 0} MB)
            </Text>
            <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
              Last Probe: <Text style={{ color: colors.text }}>{formatTime(data?.lastProbeAt)}</Text>
            </Text>
          </View>
        </View>

        {/* Auto-probe interval + Run Now */}
        <View style={[styles.controlsRow, { borderTopColor: colors.border }]}>
          <View style={styles.rowGap}>
            <Clock color={colors.textSecondary} size={14} />
            <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Probe Every:</Text>
            {([5, 10] as const).map((min) => {
              const active = data?.intervalMinutes === min;
              return (
                <Pressable
                  key={min}
                  onPress={() => handleSetInterval(min)}
                  style={[
                    styles.intervalChip,
                    {
                      backgroundColor: active ? colors.secondary : colors.surface,
                      borderColor: active ? colors.secondary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: active ? '#FFF' : colors.text }}>
                    {min}m
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleRunProbe}
            disabled={probing}
            style={[styles.probeBtn, { backgroundColor: colors.primary }]}
          >
            {probing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <RefreshCw color="#FFF" size={13} strokeWidth={2.4} />
                <Text style={styles.probeBtnText}>Run Probe</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* Request & Status Code Stats */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.rowGap, { marginBottom: 10 }]}>
          <Zap color={colors.secondary} size={17} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Live Traffic & Status Codes</Text>
        </View>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.kpiVal, { color: colors.text }]}>{data?.stats?.totalRequests ?? 0}</Text>
            <Text style={[styles.kpiLbl, { color: colors.textSecondary }]}>Requests</Text>
          </View>
          <View style={[styles.kpiBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.kpiVal, { color: colors.success }]}>{data?.stats?.successRate ?? 100}%</Text>
            <Text style={[styles.kpiLbl, { color: colors.textSecondary }]}>Success</Text>
          </View>
          <View style={[styles.kpiBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.kpiVal, { color: colors.primary }]}>{data?.stats?.avgLatencyMs ?? 0}ms</Text>
            <Text style={[styles.kpiLbl, { color: colors.textSecondary }]}>Avg Speed</Text>
          </View>
          <View style={[styles.kpiBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.kpiVal, { color: colors.secondary }]}>{data?.stats?.p95LatencyMs ?? 0}ms</Text>
            <Text style={[styles.kpiLbl, { color: colors.textSecondary }]}>P95</Text>
          </View>
        </View>

        <View style={styles.statusCodeRow}>
          <View style={[styles.codeBadge, { backgroundColor: colors.success + '18' }]}>
            <Text style={[styles.codeText, { color: colors.success }]}>2xx: {statusCounts.s2xx}</Text>
          </View>
          <View style={[styles.codeBadge, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.codeText, { color: colors.primary }]}>3xx: {statusCounts.s3xx}</Text>
          </View>
          <View style={[styles.codeBadge, { backgroundColor: '#F59E0B18' }]}>
            <Text style={[styles.codeText, { color: '#F59E0B' }]}>4xx: {statusCounts.s4xx}</Text>
          </View>
          <View style={[styles.codeBadge, { backgroundColor: colors.error + '18' }]}>
            <Text style={[styles.codeText, { color: colors.error }]}>5xx: {statusCounts.s5xx}</Text>
          </View>
        </View>
      </View>

      {/* Subsystem Health */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.rowGap, { marginBottom: 10 }]}>
          <Server color={colors.primary} size={17} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Subsystem Health</Text>
        </View>

        {subsystems.map((sub, idx) => {
          const c =
            sub.status === 'ok' ? colors.success : sub.status === 'degraded' ? '#F59E0B' : colors.error;
          return (
            <View
              key={sub.name}
              style={[
                styles.subRow,
                idx < subsystems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.subName, { color: colors.text }]}>{sub.name}</Text>
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>{sub.detail}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.statusPill, { backgroundColor: c + '18' }]}>
                  <Text style={[styles.statusPillText, { color: c }]}>
                    {sub.statusCode} • {String(sub.status).toUpperCase()}
                  </Text>
                </View>
                {sub.latencyMs > 0 ? (
                  <Text style={[styles.mutedText, { color: colors.textSecondary, marginTop: 2 }]}>
                    {sub.latencyMs} ms
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Glitch Locator */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.rowBetween, { marginBottom: 10 }]}>
          <View style={styles.rowGap}>
            <AlertTriangle color={glitches.length > 0 ? colors.error : colors.success} size={17} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Glitch Locator ({glitches.length})
            </Text>
          </View>
          {glitches.length > 0 ? (
            <Pressable onPress={handleClearGlitches} style={styles.rowGap}>
              <Trash2 color={colors.error} size={14} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: colors.error }}>
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>

        {glitches.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#ECFDF5' }]}>
            <CheckCircle2 color={colors.success} size={22} />
            <Text style={[styles.subName, { color: colors.success, marginTop: 4 }]}>
              Zero Glitches Detected
            </Text>
            <Text style={[styles.mutedText, { color: colors.textSecondary, textAlign: 'center' }]}>
              All API routes are running smoothly with no 4xx/5xx anomalies.
            </Text>
          </View>
        ) : (
          glitches.slice(0, 15).map((g) => {
            const c = g.severity === 'critical' ? colors.error : '#F59E0B';
            return (
              <View
                key={g.id}
                style={[styles.glitchItem, { backgroundColor: colors.surface, borderLeftColor: c }]}
              >
                <View style={styles.rowBetween}>
                  <Text style={[styles.glitchLoc, { color: c }]}>
                    {g.location} • {g.statusCode}
                  </Text>
                  <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                    {formatTime(g.timestamp)} ({g.durationMs}ms)
                  </Text>
                </View>
                <Text style={[styles.glitchPath, { color: colors.text }]}>
                  {g.method} {g.path}
                </Text>
                <Text style={[styles.mutedText, { color: colors.textSecondary }]}>{g.message}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Module Breakdown */}
      {modules.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.rowGap, { marginBottom: 10 }]}>
            <Cpu color={colors.secondary} size={17} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Module Performance</Text>
          </View>
          {modules.map((m) => (
            <View key={m.name} style={[styles.modRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.subName, { color: colors.text, flex: 1 }]}>{m.name}</Text>
              <Text style={[styles.mutedText, { color: colors.textSecondary }]}>
                {m.total} req • {m.avgMs}ms •{' '}
                <Text style={{ color: m.errors5xx > 0 ? colors.error : colors.success }}>
                  {m.errors5xx} err
                </Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Periodic Probe History */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.rowGap, { marginBottom: 10 }]}>
          <ShieldCheck color={colors.success} size={17} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Probe Timeline ({probes.length})
          </Text>
        </View>
        {probes.slice(0, 10).map((p) => {
          const c = p.status === 'critical' ? colors.error : p.status === 'degraded' ? '#F59E0B' : colors.success;
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  centerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 32,
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
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10.5,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 12,
  },
  scoreBig: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 34,
    lineHeight: 38,
  },
  metaCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metaLine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  smallLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11.5,
  },
  intervalChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  probeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  probeBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11.5,
    color: '#FFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  kpiVal: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
  },
  kpiLbl: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10.5,
  },
  statusCodeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  codeBadge: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  codeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 10,
  },
  subName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12.5,
  },
  emptyBox: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  glitchItem: {
    borderRadius: 10,
    borderLeftWidth: 3,
    padding: 10,
    marginBottom: 8,
    gap: 2,
  },
  glitchLoc: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11.5,
  },
  glitchPath: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
});
