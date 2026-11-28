import { useState, useMemo, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar, DateData } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import { useEventStore } from '../../store/useEventStore';
import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useResponsive } from '../../constants/responsive';
import EventCard from '../../components/EventCard';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react-native';
import * as Haptics from '../../services/haptics';

export default function CalendarScreen() {
  const router = useRouter();
  const { getColors, isDark } = useThemeStore();
  const { containerStyle } = useResponsive();
  const colors = getColors();
  const isDarkMode = isDark();
  const styles = useMemo(() => getStyles(colors, isDarkMode), [colors, isDarkMode]);
  const { events, toggleEventCompletion, deleteEvent } = useEventStore();
  
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const flatListRef = useRef<FlatList>(null);

  // Map events to react-native-calendars markedDates format
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    
    events.forEach(event => {
      if (!event.date) return;
      const dateStr = event.date.split('T')[0];
      
      if (!marks[dateStr]) {
        marks[dateStr] = {
          marked: true,
          dotColor: colors.secondary
        };
      }
    });

    // Selection styling for the currently selected date
    if (marks[selectedDate]) {
      marks[selectedDate] = { 
        ...marks[selectedDate], 
        selected: true, 
        selectedColor: colors.secondary, 
        selectedTextColor: colors.card,
        dotColor: colors.card
      };
    } else {
      marks[selectedDate] = { 
        selected: true, 
        selectedColor: colors.secondary, 
        selectedTextColor: colors.card 
      };
    }

    return marks;
  }, [events, selectedDate]);

  // Filter events for the selected date
  const selectedEvents = useMemo(() => {
    return events
      .filter(e => e.date && e.date.split('T')[0] === selectedDate)
      .sort((a, b) => {
        const timeA = a.time || '23:59';
        const timeB = b.time || '23:59';
        return timeA.localeCompare(timeB);
      });
  }, [events, selectedDate]);

  const onDayPress = useCallback((day: DateData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(day.dateString);
  }, []);

  const jumpToToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedDate(todayStr);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [todayStr]);

  const renderCalendarArrow = useCallback((direction: 'left' | 'right') => (
    direction === 'left'
      ? <ChevronLeft color={colors.text} size={24} strokeWidth={2.5} />
      : <ChevronRight color={colors.text} size={24} strokeWidth={2.5} />
  ), [colors.text]);

  const renderCalendarDay = useCallback(({ date, state, marking }: any) => {
    const isSelected = marking?.selected;
    const hasDot = marking?.marked;
    return (
      <Pressable onPress={() => onDayPress(date)} style={styles.dayCell}>
        <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
          <Text style={[
            styles.dayText,
            state === 'disabled' && styles.dayTextDisabled,
            isSelected && styles.dayTextSelected
          ]}>
            {date.day}
          </Text>
        </View>
        {hasDot && !isSelected && <View style={styles.dayDot} />}
      </Pressable>
    );
  }, [onDayPress, styles]);

  const renderCalendarEvent = useCallback(({ item, index }: { item: any; index: number }) => (
    <View style={styles.eventWrapper}>
      <EventCard
        event={item}
        index={index}
        onPress={() => router.push(`/event/${item.id || item._id}` as any)}
        onComplete={() => toggleEventCompletion((item.id || item._id) as string)}
        onDelete={() => deleteEvent((item.id || item._id) as string)}
      />
    </View>
  ), [styles.eventWrapper, router, toggleEventCompletion, deleteEvent]);

  const pendingCount = useMemo(() => {
    return selectedEvents.filter(e => !e.completed && e.status !== 'completed').length;
  }, [selectedEvents]);

  const formattedDateFull = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <View style={styles.root}>
      {/* ── BG GLOW ── */}
      <View style={styles.bgGlow} />

      <SafeAreaView style={styles.container} edges={['top']}>
        
        {/* ── HEADER ── */}
        <View style={styles.headerArea}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBox}>
              <CalendarIcon color={colors.secondary} size={24} strokeWidth={2.2} />
            </View>
            <View>
              <Text style={styles.headerTitle}>CALENDAR</Text>
              <Text style={styles.headerSubtitle}>Plan • Focus • Achieve</Text>
            </View>
          </View>

          <Pressable onPress={jumpToToday} style={styles.todayBtnWrapper}>
            <LinearGradient colors={[colors.secondary, colors.secondary]} style={styles.todayBtn}>
              <CalendarIcon color="#FFF" size={14} strokeWidth={2.5} />
              <Text style={styles.todayBtnText}>Today</Text>
            </LinearGradient>
          </Pressable>
        </View>
      
      <FlatList
        ref={flatListRef}
        data={selectedEvents}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ── CALENDAR CARD ── */}
            <View style={styles.calendarCard}>
              <Calendar
                key={colors.card}
                current={selectedDate}
                onDayPress={onDayPress}
                markedDates={markedDates}
                hideDayNames={false}
                renderArrow={renderCalendarArrow}
                dayComponent={renderCalendarDay}
                theme={{
                  backgroundColor: colors.card,
                  calendarBackground: colors.card,
                  textSectionTitleColor: 'transparent',
                  selectedDayBackgroundColor: colors.secondary,
                  selectedDayTextColor: colors.card,
                  todayTextColor: colors.secondary,
                  dayTextColor: colors.text,
                  textDisabledColor: colors.border,
                  dotColor: colors.secondary,
                  selectedDotColor: colors.card,
                  monthTextColor: colors.text,
                  textDayFontFamily: 'Poppins_600SemiBold',
                  textMonthFontFamily: 'Poppins_700Bold',
                  textDayHeaderFontFamily: 'Poppins_600SemiBold',
                  textDayFontSize: 15,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 12,
                  'stylesheet.calendar.header': {
                    header: {
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingLeft: 10,
                      paddingRight: 10,
                      marginTop: 6,
                      alignItems: 'center',
                      marginBottom: 8
                    },
                    week: {
                      marginTop: 0,
                      flexDirection: 'row',
                      justifyContent: 'space-around',
                      paddingBottom: 20, // Add bottom padding to give our custom pills space
                    }
                  }
                } as any}
                style={styles.calendar}
              />
              <View style={styles.customWeekRow}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                  <View key={day} style={[styles.customWeekDayPill, idx === 0 && styles.customWeekDayPillSun]}>
                    <Text style={[styles.customWeekDayText, idx === 0 && styles.customWeekDayTextSun]}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── SELECTED DATE SUMMARY CARD ── */}
            <LinearGradient
              colors={isDarkMode ? ['rgba(255, 148, 51, 0.12)', 'rgba(255, 100, 0, 0.06)'] : ['#FFF5EB', '#FFF0E5']}
              start={{x:0, y:0}}
              end={{x:1, y:0}}
              style={styles.summaryCard}
            >
              <View style={styles.summaryLeft}>
                <View style={styles.summaryIconBox}>
                  <CalendarIcon color={colors.secondary} size={18} strokeWidth={2.5} />
                </View>
                <View>
                  <Text style={styles.summaryDate}>{formattedDateFull}</Text>
                  <Text style={styles.summaryStats}>
                    {selectedEvents.length} Tasks Scheduled
                  </Text>
                </View>
              </View>
              {pendingCount === 0 ? (
                <View style={styles.allClearPill}>
                  <Sparkles color={colors.secondary} size={14} strokeWidth={2.5} />
                  <Text style={styles.allClearText}>All Clear</Text>
                </View>
              ) : (
                <View style={[styles.allClearPill, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                  <Text style={[styles.allClearText, { color: colors.warning }]}>{pendingCount} Pending</Text>
                </View>
              )}
            </LinearGradient>
          </>
        }
        renderItem={renderCalendarEvent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.illustrationWrapper}>
              {/* Soft background blob */}
              <View style={styles.illusBlob} />

              {/* The Calendar Graphic */}
              <View style={styles.illusGraphic}>
                {/* Rings */}
                <View style={styles.illusRingLeft} />
                <View style={styles.illusRingRight} />
                
                {/* Top orange bar */}
                <LinearGradient colors={[colors.secondary, colors.secondary]} style={styles.illusTopBar} />
                
                {/* White body */}
                <View style={styles.illusBody}>
                  {/* Floating Check */}
                  <View style={styles.illusCheckCircle}>
                    <Check color={colors.card} size={18} strokeWidth={4} />
                  </View>
                </View>
              </View>

              {/* Sparkles around */}
              <View style={[styles.sparkle, { top: -5, left: 10 }]}>
                <Sparkles color={colors.secondaryLight} size={16} fill={colors.secondaryLight} />
              </View>
              <View style={[styles.sparkle, { bottom: 10, right: -5 }]}>
                <Sparkles color={colors.secondaryLight} size={20} fill={colors.secondaryLight} />
              </View>
              <View style={[styles.tinyDot, { bottom: 20, left: 5 }]} />
              <View style={[styles.tinyDot, { top: 30, right: 0 }]} />
            </View>
            <Text style={styles.emptyTitle}>No Tasks Scheduled</Text>
            <Text style={styles.emptySubtitle}>
              You have no deadlines or events on this date.
            </Text>
            <Pressable 
              style={styles.emptyAddBtnWrapper}
              onPress={() => router.push({ pathname: '/add-event', params: { date: selectedDate } } as any)}
            >
              <LinearGradient colors={[colors.secondary, colors.secondary]} style={styles.emptyAddBtn}>
                <Plus color="#FFF" size={18} strokeWidth={2.5} />
                <Text style={styles.emptyAddBtnText}>Schedule Task for This Day</Text>
              </LinearGradient>
            </Pressable>
          </View>
        }
        contentContainerStyle={[styles.listContent, containerStyle]}
      />
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ColorTheme, isDarkMode: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgGlow: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    height: 300,
    backgroundColor: colors.secondaryLight,
    opacity: 0.6,
    borderRadius: 200,
    transform: [{ scaleX: 1.5 }],
  },
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  
  // ── HEADER ──
  headerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    backgroundColor: colors.card,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.secondaryLight,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  headerTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 22,
    color: colors.text,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  todayBtnWrapper: {
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  todayBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.card,
  },

  // ── CALENDAR CARD ──
  calendarCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 10,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthHeaderWrapper: {
    alignItems: 'center',
  },
  monthHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  monthHeaderText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  calendar: {
    width: '100%',
  },
  customWeekRow: {
    position: 'absolute',
    top: 76,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    zIndex: 10,
  },
  customWeekDayPill: {
    width: 36,
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  customWeekDayPillSun: {
    backgroundColor: colors.secondaryLight,
  },
  customWeekDayText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  customWeekDayTextSun: {
    color: colors.secondary,
  },
  dayCell: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  dayText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  dayTextDisabled: {
    color: colors.textSecondary,
    opacity: 0.5,
  },
  dayTextSelected: {
    color: colors.card,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondary,
    position: 'absolute',
    bottom: 2,
  },

  // ── SUMMARY CARD ──
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 15,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: isDarkMode ? 'rgba(255, 148, 51, 0.22)' : '#FFD5B0',
    shadowColor: isDarkMode ? '#000000' : colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.2 : 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDarkMode ? 'rgba(255, 148, 51, 0.15)' : '#FFF0E5',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 148, 51, 0.3)' : '#FFD5B0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDate: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
  summaryStats: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
  },
  allClearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 148, 51, 0.25)' : '#FFD5B0',
  },
  allClearText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.text,
  },

  // ── EMPTY STATE CARD ──
  emptyCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  illustrationWrapper: {
    position: 'relative',
    marginBottom: 32,
    width: 140,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illusBlob: {
    position: 'absolute',
    width: 120,
    height: 100,
    backgroundColor: colors.secondaryLight,
    borderRadius: 60,
    transform: [{ scaleX: 1.3 }, { rotate: '-10deg' }],
    opacity: 0.9,
  },
  illusGraphic: {
    width: 80,
    height: 80,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    transform: [{ rotate: '-8deg' }],
  },
  illusTopBar: {
    height: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    width: '100%',
  },
  illusBody: {
    flex: 1,
    backgroundColor: colors.card,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illusRingLeft: {
    position: 'absolute',
    top: -6,
    left: 18,
    width: 6,
    height: 16,
    backgroundColor: colors.text,
    borderRadius: 4,
    zIndex: 10,
  },
  illusRingRight: {
    position: 'absolute',
    top: -6,
    right: 18,
    width: 6,
    height: 16,
    backgroundColor: colors.text,
    borderRadius: 4,
    zIndex: 10,
  },
  illusCheckCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  sparkle: {
    position: 'absolute',
  },
  tinyDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.secondaryLight,
  },
  emptyTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  emptyAddBtnWrapper: {
    width: '100%',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  emptyAddBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.card,
  },

  eventWrapper: {
    marginHorizontal: 0, 
  }
});
