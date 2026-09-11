import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Users, Calendar, Check, Sparkles, Clock } from 'lucide-react-native';
import { useThemeStore } from '../../store/useThemeStore';
import { useEventStore } from '../../store/useEventStore';
import { useAuthStore } from '../../store/useAuthStore';
import * as Haptics from 'expo-haptics';
import api from '../../services/api';
import { reschedulingService, FreeSlot } from '../../services/reschedulingService';
import { Event } from '../../models/Event';

interface FriendSlotIntersection {
  slot: FreeSlot;
  availableFriends: string[];
  allAvailable: boolean;
}

export default function GroupScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { getColors } = useThemeStore();
  const colors = getColors();
  const { events, addEvent } = useEventStore();
  const { user } = useAuthStore();

  const [selectedFriends, setSelectedFriends] = useState<string[]>(
    params.friendIds ? String(params.friendIds).split(',') : []
  );
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [friendsEvents, setFriendsEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [duration, setDuration] = useState(60); // mins
  const [selected, setSelected] = useState<FreeSlot | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get('/friends').then(r => r.data).catch(() => []),
      api.get('/tasks/friends').then(r => r.data?.tasks || []).catch(() => []),
    ]).then(([fList, fEvents]) => {
      if (!mounted) return;
      setFriendsList(fList);
      setFriendsEvents(fEvents);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  // Find intersecting free slots
  const suggestions: FriendSlotIntersection[] = useMemo(() => {
    if (selectedFriends.length === 0) return [];
    const allMyEvents = events.filter(e => !e.completed && e.status !== 'completed');
    const allFriendEvents = friendsEvents.filter(e => !e.completed && e.status !== 'completed');
    const combined = [...allMyEvents, ...allFriendEvents];

    // Find 5 free slots
    const slots: FreeSlot[] = [];
    let searchBase = combined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const slot = reschedulingService.findNextFreeSlot(searchBase, duration);
      if (!slot) break;
      slots.push(slot);
      // Block this slot for next iteration
      const blocker: Event = {
        id: 'blocker_' + attempt,
        title: 'blocker',
        description: '',
        category: '',
        priority: 'medium',
        status: 'pending',
        date: slot.date + 'T00:00:00.000Z',
        time: slot.time,
        reminders: [],
        color: '',
        icon: '',
        notes: '',
        location: '',
        completed: false,
        createdAt: '',
        updatedAt: '',
        estimatedDuration: duration,
      };
      searchBase = [...searchBase, blocker];
    }

    // For each slot, determine which selected friends are free
    return slots.map(slot => {
      const slotMs = slot.dateMs;
      const slotEndMs = slotMs + duration * 60000;
      const busyFriends = selectedFriends.filter(fid => {
        return allFriendEvents.some(e => {
          const ownerId = typeof e.ownerId === 'object' ? (e.ownerId as any)?._id : e.ownerId;
          if (ownerId !== fid) return false;
          const eMs = new Date(e.date.split('T')[0] + 'T' + (e.time || '00:00') + ':00').getTime();
          const eEndMs = eMs + (e.estimatedDuration || 30) * 60000;
          return eMs < slotEndMs && eEndMs > slotMs;
        });
      });
      const available = selectedFriends.filter(id => !busyFriends.includes(id));
      return { slot, availableFriends: available, allAvailable: busyFriends.length === 0 };
    }).sort((a, b) => b.availableFriends.length - a.availableFriends.length);
  }, [selectedFriends, events, friendsEvents, duration]);

  const handleCreateEvent = async () => {
    if (!selected) return;
    setCreating(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addEvent({
      title: 'Group Session',
      description: 'AI-scheduled group event',
      category: 'Meeting',
      priority: 'high',
      date: selected.date + 'T00:00:00.000Z',
      time: selected.time,
      estimatedDuration: duration,
      reminders: [],
      color: '#6366F1',
      icon: '👥',
      notes: '',
      location: '',
      completed: false,
      status: 'pending',
      visibility: 'selectedFriends',
      sharedWith: selectedFriends,
    } as any);
    setCreating(false);
    router.back();
  };

  const toggleFriend = (id: string) => {
    Haptics.selectionAsync();
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const c = colors;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft color={c.text} size={20} strokeWidth={2.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 20, color: c.text }}>Group Scheduler</Text>
          <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: c.textSecondary }}>AI finds when everyone is free</Text>
        </View>
        <Sparkles color={c.secondary} size={22} strokeWidth={2.5} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 120 }}>

        {/* Duration Selector */}
        <View>
          <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 12, color: c.textSecondary, letterSpacing: 1, marginBottom: 10 }}>MEETING DURATION</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[30, 60, 90, 120].map(d => (
              <Pressable key={d} onPress={() => { Haptics.selectionAsync(); setDuration(d); }} style={{ flex: 1, padding: 12, borderRadius: 14, alignItems: 'center', backgroundColor: duration === d ? c.secondary : c.card, borderWidth: 1, borderColor: duration === d ? c.secondary : c.border }}>
                <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 14, color: duration === d ? '#FFF' : c.text }}>{d}m</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Friends Selector */}
        <View>
          <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 12, color: c.textSecondary, letterSpacing: 1, marginBottom: 10 }}>SELECT FRIENDS</Text>
          {loading ? (
            <ActivityIndicator color={c.secondary} />
          ) : (
            <View style={{ gap: 8 }}>
              {friendsList.map((f: any) => {
                const id = f._id || f.id;
                const isSelected = selectedFriends.includes(id);
                return (
                  <Pressable key={id} onPress={() => toggleFriend(id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: isSelected ? c.secondary + '10' : c.card, borderWidth: 1.5, borderColor: isSelected ? c.secondary + '60' : c.border }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.secondary + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Users color={c.secondary} size={18} strokeWidth={2.5} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: c.text }}>{f.name || f.username}</Text>
                    {isSelected && <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.secondary, alignItems: 'center', justifyContent: 'center' }}><Check color="#FFF" size={12} strokeWidth={3} /></View>}
                  </Pressable>
                );
              })}
              {friendsList.length === 0 && <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 13, color: c.textSecondary, textAlign: 'center' }}>No friends added yet. Add friends to schedule together.</Text>}
            </View>
          )}
        </View>

        {/* AI Slot Suggestions */}
        {selectedFriends.length > 0 && (
          <View>
            <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 12, color: c.textSecondary, letterSpacing: 1, marginBottom: 10 }}>AI SUGGESTED SLOTS</Text>
            {suggestions.length === 0 ? (
              <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 13, color: c.textSecondary }}>No common free slots found in the next 7 days.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {suggestions.map((s, i) => (
                  <Pressable key={i} onPress={() => { Haptics.selectionAsync(); setSelected(s.slot); }} style={{ padding: 16, borderRadius: 18, backgroundColor: selected?.dateMs === s.slot.dateMs ? c.secondary + '12' : c.card, borderWidth: 1.5, borderColor: selected?.dateMs === s.slot.dateMs ? c.secondary + '60' : c.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      {i === 0 && s.allAvailable && <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 10, color: c.secondary, backgroundColor: c.secondary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>BEST SLOT</Text>}
                      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 14, color: c.text, flex: 1 }}>{s.slot.label}</Text>
                      {selected?.dateMs === s.slot.dateMs && <Check color={c.secondary} size={18} strokeWidth={2.5} />}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Users color={s.allAvailable ? '#22C55E' : '#F59E0B'} size={14} strokeWidth={2.5} />
                      <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: s.allAvailable ? '#22C55E' : '#F59E0B' }}>
                        {s.allAvailable ? 'Everyone available' : (s.availableFriends.length + '/' + selectedFriends.length + ' available')}
                      </Text>
                      <Clock color={c.textSecondary} size={12} strokeWidth={2} style={{ marginLeft: 8 }} />
                      <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: c.textSecondary }}>{s.slot.freeForMins} min free</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Button */}
      {selected && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          <Pressable
            onPress={handleCreateEvent}
            disabled={creating}
            style={{ backgroundColor: c.secondary, borderRadius: 16, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: creating ? 0.7 : 1 }}
          >
            <Calendar color="#FFF" size={20} strokeWidth={2.5} />
            <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 15, color: '#FFF' }}>
              {creating ? 'Creating...' : 'Create Group Event'}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
