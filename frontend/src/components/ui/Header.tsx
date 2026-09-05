import { StyleSheet, View, Text, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell, Flame, Calendar as CalendarIcon,
  CheckCircle2, Clock, Sparkles,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

interface HeaderProps {
  todayCount: number;
  upcomingCount: number;
  completedCount?: number;
  totalTodayCount?: number;
  onFilterSelect?: (filter: string) => void;
}

export default function Header({
  todayCount,
  upcomingCount,
  completedCount = 0,
  totalTodayCount = 0,
  onFilterSelect,
}: HeaderProps) {
  const user = useAuthStore(state => state.user);
  const router = useRouter();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const getGreetingEmoji = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️';
    if (hour < 17) return '👋';
    return '🌙';
  };

  const userName = user?.name ? user.name.split(' ')[0] : 'Achiever';
  const userInitial = (user?.name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase();
  const hasValidPhoto = !!user?.profilePhoto && !user.profilePhoto.includes('unsplash.com');

  const totalTasks = totalTodayCount || (todayCount + completedCount);
  const progressPercent = totalTasks > 0 ? Math.min(100, Math.round((completedCount / totalTasks) * 100)) : 0;

  return (
    <View style={styles.container}>
      {/* Top Row: Avatar + Greeting + Bell */}
      <View style={styles.topRow}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(tabs)/profile');
          }}
          style={styles.userSection}
        >
          {/* Avatar with orange ring */}
          <View style={styles.avatarWrapper}>
            <LinearGradient
              colors={['#FF7A00', '#FF5C00']}
              style={styles.avatarRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {hasValidPhoto ? (
                <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{userInitial}</Text>
                </View>
              )}
            </LinearGradient>
            <View style={styles.onlineDot} />
          </View>

          {/* Greeting Text */}
          <View style={styles.greetingContainer}>
            <View style={styles.dateRow}>
              <View style={styles.datePill}>
                <CalendarIcon color="#4B3FDC" size={10} strokeWidth={2.5} />
                <Text style={styles.dateText}>{getFormattedDate()}</Text>
              </View>
              <View style={styles.brandDot} />
              <Text style={styles.appName}>EVENTFLOW</Text>
            </View>
            <Text style={styles.greeting}>
              {getGreeting()}, {userName} {getGreetingEmoji()}
            </Text>
          </View>
        </Pressable>

        {/* Bell button */}
        <Pressable
          style={styles.bellBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/friends/requests' as any);
          }}
        >
          <Bell color="#182235" size={18} strokeWidth={2.2} />
          {todayCount > 0 && <View style={styles.notifDot} />}
        </Pressable>
      </View>

      {/* Momentum Dashboard Card */}
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.flameBadge}>
            <Flame color="#FF7A00" size={15} fill="#FF7A00" />
            <Text style={styles.cardTitle}>Daily Momentum</Text>
          </View>
          <View style={styles.progressPill}>
            <Text style={styles.progressPillText}>{progressPercent}% Done</Text>
          </View>
        </View>

        {/* Orange Progress Bar */}
        <View style={styles.progressBg}>
          <LinearGradient
            colors={['#FF7A00', '#FF5C00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${Math.max(4, progressPercent)}%` as any }]}
          />
        </View>

        <View style={styles.divider} />

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {/* Due Today */}
          <Pressable
            style={styles.statCol}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onFilterSelect?.('today');
            }}
          >
            <View style={[styles.statBadge, { backgroundColor: '#FFF0E5' }]}>
              <Clock color="#FF7A00" size={13} strokeWidth={2.5} />
              <Text style={[styles.statNum, { color: '#FF7A00' }]}>{todayCount}</Text>
            </View>
            <Text style={styles.statLabel}>Due Today</Text>
          </Pressable>

          <View style={styles.vertDivider} />

          {/* Pending */}
          <Pressable
            style={styles.statCol}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onFilterSelect?.('in_progress');
            }}
          >
            <View style={[styles.statBadge, { backgroundColor: '#EDEAFD' }]}>
              <Sparkles color="#4B3FDC" size={13} strokeWidth={2.5} />
              <Text style={[styles.statNum, { color: '#4B3FDC' }]}>{upcomingCount}</Text>
            </View>
            <Text style={styles.statLabel}>Pending</Text>
          </Pressable>

          <View style={styles.vertDivider} />

          {/* Completed */}
          <Pressable
            style={styles.statCol}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onFilterSelect?.('completed');
            }}
          >
            <View style={[styles.statBadge, { backgroundColor: '#DCFCE7' }]}>
              <CheckCircle2 color="#16A34A" size={13} strokeWidth={2.5} />
              <Text style={[styles.statNum, { color: '#16A34A' }]}>{completedCount}</Text>
            </View>
            <Text style={styles.statLabel}>Completed</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 16,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 45,
    height: 45,
    borderRadius: 14,
  },
  avatarFallback: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 18,
    color: '#FF7A00',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFF5EA',
  },
  greetingContainer: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDEAFD',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dateText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: '#4B3FDC',
  },
  brandDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D1D9E6',
  },
  appName: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 10,
    color: '#FF7A00',
    letterSpacing: 1.2,
  },
  greeting: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
    color: '#182235',
    lineHeight: 23,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E9EDF3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFF5EA',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E9EDF3',
    padding: 16,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  flameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#182235',
  },
  progressPill: {
    backgroundColor: '#FFF0E5',
    borderWidth: 1,
    borderColor: '#FFD5B0',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  progressPillText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: '#FF7A00',
  },
  progressBg: {
    height: 7,
    backgroundColor: '#F5F0EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EDE8',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 2,
  },
  statNum: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 15,
  },
  statLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: '#667085',
  },
  vertDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#F0EDE8',
  },
});
