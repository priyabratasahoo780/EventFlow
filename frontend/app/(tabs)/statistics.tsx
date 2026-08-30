import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEventStore } from '../../store/useEventStore';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Target, 
  Check, 
  Clock, 
  PlayCircle, 
  AlertTriangle, 
  BarChart as BarChartIcon, 
  ChevronDown,
  GraduationCap
} from 'lucide-react-native';
import { PieChart } from 'react-native-gifted-charts';
import * as Haptics from 'expo-haptics';

type TimeFilter = 'week' | 'month' | 'year' | 'all';

export default function StatisticsScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const { events } = useEventStore();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter(e => {
      if (!e.date) return true;
      const eventDate = new Date(e.date);
      
      if (timeFilter === 'all') return true;
      
      if (timeFilter === 'week') {
        // Make Monday the start of the week
        const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1; 
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - currentDay);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        return eventDate >= startOfWeek && eventDate <= endOfWeek;
      }
      if (timeFilter === 'month') {
        return now.getMonth() === eventDate.getMonth() && now.getFullYear() === eventDate.getFullYear();
      }
      if (timeFilter === 'year') {
        return now.getFullYear() === eventDate.getFullYear();
      }
      return true;
    });
  }, [events, timeFilter]);

  const stats = useMemo(() => {
    const total = filteredEvents.length;
    let completed = 0;
    let inProgress = 0;
    let overdue = 0;
    let pending = 0;

    const now = new Date();
    
    filteredEvents.forEach(e => {
      const isCompleted = e.completed || e.status === 'completed';
      const isInProgress = e.status === 'in_progress';
      
      const dateStr = e.date ? e.date.split('T')[0] : '';
      const timeStr = e.time || '23:59';
      let isOverdue = false;
      
      if (dateStr) {
        const deadline = new Date(`${dateStr}T${timeStr.length <= 5 ? timeStr + ':00' : timeStr}`);
        isOverdue = deadline < now;
      }

      if (isCompleted) {
        completed++;
      } else if (isOverdue) {
        overdue++;
      } else if (isInProgress) {
        inProgress++;
      } else {
        pending++;
      }
    });

    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

    let totalFocusMinutes = 0;
    filteredEvents.forEach(e => {
      if (e.completed && e.startedAt && e.completedAt) {
        const diffMs = new Date(e.completedAt).getTime() - new Date(e.startedAt).getTime();
        totalFocusMinutes += Math.max(1, Math.round(diffMs / (1000 * 60)));
      } else if (e.completed) {
        totalFocusMinutes += (e.estimatedDuration || 30);
      }
    });

    const categoryCount: Record<string, number> = {};
    filteredEvents.forEach(e => {
      const cat = e.category || 'Other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const topCategoryPair = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
    const topCategoryName = total === 0 ? 'None' : (topCategoryPair ? topCategoryPair[0] : 'Academic');

    const focusHoursPart = Math.floor(totalFocusMinutes / 60);
    const focusMinsPart = totalFocusMinutes % 60;
    const formattedFocusTime = totalFocusMinutes === 0 ? '0 Minutes' : `${focusHoursPart} Hours ${focusMinsPart} Minutes`;

    return {
      total,
      completed,
      inProgress,
      pending,
      overdue,
      completionRate,
      formattedFocusTime,
      topCategoryName,
    };
  }, [filteredEvents]);

  const pieData = useMemo(() => {
    if (stats.total === 0) {
      return [{ value: 1, color: colors.border, label: 'No Tasks' }];
    }

    const data: { value: number; color: string; label: string }[] = [];

    if (stats.completed > 0) {
      data.push({ value: stats.completed, color: colors.success, label: 'Completed' });
    }
    if (stats.inProgress > 0) {
      data.push({ value: stats.inProgress, color: colors.primary, label: 'In Progress' });
    }
    if (stats.pending > 0) {
      data.push({ value: stats.pending, color: '#F59E0B', label: 'Pending' });
    }
    if (stats.overdue > 0) {
      data.push({ value: stats.overdue, color: colors.error, label: 'Overdue' });
    }

    return data.length > 0 ? data : [{ value: 1, color: colors.border, label: 'No Tasks' }];
  }, [stats]);

  const getFilterLabel = () => {
    if (timeFilter === 'week') return 'This Week';
    if (timeFilter === 'month') return 'This Month';
    if (timeFilter === 'year') return 'This Year';
    return 'All Time';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── HEADER ── */}
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <Pressable 
          style={styles.timeFilterBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowFilterModal(true);
          }}
        >
          <LinearGradient colors={[colors.secondary, colors.secondary]} style={styles.timeFilterGrad}>
            <Clock color={colors.card} size={14} strokeWidth={2.5} />
            <Text style={styles.timeFilterText}>{getFilterLabel()}</Text>
            <ChevronDown color={colors.card} size={16} strokeWidth={3} />
          </LinearGradient>
        </Pressable>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{getFilterLabel().toUpperCase()} PERFORMANCE</Text>

        {/* ── COMPLETION RATE HERO CARD ── */}
        <LinearGradient colors={[colors.secondary, colors.secondary]} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroSubTitle}>COMPLETION RATE</Text>
            <BarChartIcon color={colors.card} size={24} strokeWidth={2.5} />
          </View>
          
          <Text style={styles.heroRateText}>{stats.completionRate}%</Text>
          
          <View style={styles.heroBottomRow}>
            <Clock color={colors.card} size={16} strokeWidth={2} />
            <Text style={styles.heroFocusTimeText}>Total Focus Time: {stats.formattedFocusTime}</Text>
          </View>
        </LinearGradient>

        {/* ── METRICS GRID ── */}
        <View style={styles.gridRow}>
          {/* Card 1: Most Active Category */}
          <View style={[styles.gridCard, { backgroundColor: '#F5F3FF', borderWidth: 0 }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <GraduationCap color={colors.primary} size={20} strokeWidth={2} />
            </View>
            <Text style={[styles.cardLabelTop, { color: colors.primary }]}>MOST ACTIVE CATEGORY</Text>
            <Text style={[styles.cardValueSmall, { color: colors.text }]} numberOfLines={1}>
              {stats.topCategoryName}
            </Text>
          </View>

          <View style={styles.gridGap} />

          {/* Card 2: Focus Time */}
          <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.secondaryLight }]}>
              <Clock color={colors.secondary} size={20} strokeWidth={2} />
            </View>
            <Text style={[styles.cardLabelTop, { color: colors.textSecondary }]}>FOCUS TIME</Text>
            <Text style={[styles.cardValueSmall, { color: colors.secondary }]} numberOfLines={1}>
              {stats.formattedFocusTime}
            </Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          {/* Card 3: Total Tasks */}
          <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
              <Target color={colors.error} size={22} strokeWidth={2.5} />
            </View>
            <Text style={[styles.cardValueLarge, { color: colors.text }]}>{stats.total}</Text>
            <Text style={[styles.cardLabelBottom, { color: colors.textSecondary }]}>TOTAL TASKS</Text>
          </View>

          <View style={styles.gridGap} />

          {/* Card 4: Completed */}
          <View style={[styles.gridCard, { backgroundColor: colors.successLight, borderWidth: 0 }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.successLight }]}>
              <Check color={colors.success} size={22} strokeWidth={3} />
            </View>
            <Text style={[styles.cardValueLarge, { color: colors.success }]}>{stats.completed}</Text>
            <Text style={[styles.cardLabelBottom, { color: colors.success }]}>COMPLETED</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          {/* Card 5: In Progress */}
          <View style={[styles.gridCard, { backgroundColor: '#F5F3FF', borderWidth: 0 }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <PlayCircle color={colors.primary} size={22} strokeWidth={2.5} />
            </View>
            <Text style={[styles.cardValueLarge, { color: colors.text }]}>{stats.inProgress}</Text>
            <Text style={[styles.cardLabelBottom, { color: colors.primary }]}>IN PROGRESS</Text>
          </View>

          <View style={styles.gridGap} />

          {/* Card 6: Overdue */}
          <View style={[styles.gridCard, { backgroundColor: '#FEF2F2', borderWidth: 0 }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.dangerLight }]}>
              <AlertTriangle color={colors.error} size={22} strokeWidth={2.5} />
            </View>
            <Text style={[styles.cardValueLarge, { color: colors.text }]}>{stats.overdue}</Text>
            <Text style={[styles.cardLabelBottom, { color: colors.error }]}>OVERDUE</Text>
          </View>
        </View>

        <View style={{ height: 16 }} />

        {/* ── TASK STATUS BREAKDOWN GRAPH ── */}
        <Text style={styles.sectionTitle}>TASK STATUS BREAKDOWN</Text>
        <View style={styles.pieCard}>
          <View style={styles.pieChartWrapper}>
            <PieChart
              data={pieData}
              donut
              radius={75}
              innerRadius={45}
              innerCircleColor={colors.card}
              centerLabelComponent={() => (
                <View style={styles.centerLabelBox}>
                  <Text style={styles.centerLabelRate}>{stats.completionRate}%</Text>
                  <Text style={styles.centerLabelText}>DONE</Text>
                </View>
              )}
            />
          </View>

          {/* PIE LEGEND */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Completed ({stats.completed})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>In Progress ({stats.inProgress})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>Pending ({stats.pending})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
              <Text style={styles.legendText}>Overdue ({stats.overdue})</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── TIME FILTER MODAL ── */}
      <Modal visible={showFilterModal} transparent={true} animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Time Period</Text>
            
            {(['week', 'month', 'year', 'all'] as TimeFilter[]).map((filter) => {
              const isActive = timeFilter === filter;
              let label = '';
              if (filter === 'week') label = 'This Week';
              else if (filter === 'month') label = 'This Month';
              else if (filter === 'year') label = 'This Year';
              else label = 'All Time';

              return (
                <Pressable
                  key={filter}
                  style={[styles.modalOption, isActive && styles.modalOptionActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTimeFilter(filter);
                    setShowFilterModal(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>{label}</Text>
                  {isActive && <Check color={colors.secondary} size={20} strokeWidth={3} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  
  // ── HEADER ──
  headerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 32,
    color: '#0B1120',
    letterSpacing: -0.5,
  },
  timeFilterBtn: {
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  timeFilterGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timeFilterText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.card,
  },

  // ── SUBTITLE ──
  sectionTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // ── HERO CARD ──
  heroCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroSubTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: colors.card,
    letterSpacing: 0.5,
  },
  heroRateText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 72,
    color: colors.card,
    textAlign: 'center',
    marginVertical: 4,
    letterSpacing: -2,
    lineHeight: 80,
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  heroFocusTimeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: colors.card,
  },

  // ── METRICS GRID ──
  gridRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  gridGap: {
    width: 16,
  },
  gridCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 130,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardLabelTop: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  cardValueSmall: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    textAlign: 'center',
  },
  cardValueLarge: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 36,
  },
  cardLabelBottom: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // ── PIE CHART ──
  pieCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  pieChartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  centerLabelBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabelRate: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 24,
    color: colors.text,
    lineHeight: 28,
  },
  centerLabelText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 20,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalOptionActive: {
    backgroundColor: colors.secondaryLight,
    borderColor: '#FFD5B0',
  },
  modalOptionText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalOptionTextActive: {
    color: colors.secondary,
    fontFamily: 'Poppins_700Bold',
  },
});
