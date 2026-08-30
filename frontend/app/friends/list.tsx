import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import api from '../../services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, UserPlus, Users, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function FriendListScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const s = styles;
  const [friends, setFriends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const fetchFriends = async () => {
    try {
      const res = await api.get('/friends');
      setFriends(res.data || []);
    } catch (err) {
      console.log('[FriendList Notice]: Network sync deferred or offline');
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleRemove = async (id: string) => {
    Alert.alert('Remove Friend', 'Are you sure you want to remove this friend?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Remove', 
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          try {
            await api.delete('/friends/remove', { data: { friendId: id } });
            setFriends(friends.filter(f => f._id !== id));
          } catch (err) {
            Alert.alert('Error', 'Could not remove friend');
          }
        }
      }
    ]);
  };

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    return friends.filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [friends, searchQuery]);

  return (
    <View style={styles.root}>
      {/* Soft Glow Background */}
      <View style={styles.bgGlow} />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }} 
            style={styles.backBtn}
          >
            <ArrowLeft color={colors.secondary} size={24} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>MY FRIENDS</Text>
            <Text style={styles.subtitle}>Connect, collaborate and grow together</Text>
          </View>

          {/* Graphic Element */}
          <View style={styles.graphicContainer}>
            <View style={styles.graphicGlow} />
            <Sparkles color={colors.secondary} size={12} style={styles.sparkle1} />
            <Sparkles color={colors.secondary} size={10} style={styles.sparkle2} />
            <Users color={colors.secondary} size={32} strokeWidth={2.5} />
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search color={colors.secondary} size={20} strokeWidth={2.5} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
        
        {/* LIST */}
        {friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You have no friends yet.</Text>
            <Pressable style={styles.addBtn} onPress={() => router.push('/friends/connect' as any)}>
              <Text style={styles.addBtnText}>ADD A FRIEND</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredFriends}
            keyExtractor={(item, index) => (item._id ? `${item._id}-${index}` : `friend-${index}`)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.userInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.username}>@{item.username}</Text>
                  </View>
                </View>
                <Pressable 
                  style={styles.actionBtn} 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleRemove(item._id);
                  }}
                >
                  <UserPlus color={colors.secondary} size={20} strokeWidth={2.5} />
                </Pressable>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgGlow: {
    position: 'absolute',
    top: -50,
    right: -100,
    width: 300,
    height: 300,
    backgroundColor: colors.secondaryLight,
    opacity: 0.6,
    borderRadius: 150,
    transform: [{ scaleX: 1.5 }],
  },
  container: { 
    flex: 1,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 16, 
    paddingBottom: 16,
  },
  backBtn: { 
    width: 44, 
    height: 44, 
    backgroundColor: colors.card, 
    borderRadius: 22, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  title: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 20, 
    color: colors.text,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  graphicContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  graphicGlow: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.secondary,
    opacity: 0.2,
  },
  sparkle1: {
    position: 'absolute',
    top: 4,
    right: 4,
    opacity: 0.6,
  },
  sparkle2: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    opacity: 0.4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: colors.text,
    marginLeft: 12,
  },
  list: { 
    paddingHorizontal: 20, 
    paddingBottom: 100,
    gap: 16,
  },
  card: { 
    padding: 16, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: colors.card,
    borderRadius: 20,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  userInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16,
  },
  avatar: { 
    width: 52, 
    height: 52, 
    borderRadius: 26, 
    backgroundColor: colors.primary, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  avatarText: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 22, 
    color: colors.card,
    marginTop: 2,
  },
  name: { 
    fontFamily: 'Poppins_700Bold', 
    fontSize: 16, 
    color: colors.text,
  },
  username: { 
    fontFamily: 'Poppins_500Medium', 
    fontSize: 12, 
    color: colors.textSecondary,
  },
  actionBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    backgroundColor: colors.secondaryLight, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24,
  },
  emptyText: { 
    fontFamily: 'Poppins_600SemiBold', 
    fontSize: 16, 
    color: colors.textSecondary, 
    marginBottom: 24,
  },
  addBtn: { 
    backgroundColor: colors.secondary, 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 12,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: { 
    fontFamily: 'Poppins_800ExtraBold', 
    fontSize: 14, 
    color: colors.card,
  }
});

