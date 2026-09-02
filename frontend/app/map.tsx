import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Navigation, Search, Compass, ChevronRight, LocateFixed } from 'lucide-react-native';
import { useEventStore } from '../store/useEventStore';
import { useLocation } from '../hooks/useLocation';
import { priorityService } from '../services/priorityService';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Circle } from '../components/maps';

export default function MapScreen() {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const router = useRouter();
  const { events } = useEventStore();
  const { location, address, geocodeAddress } = useLocation(events);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [hasAutoZoomed, setHasAutoZoomed] = useState(false);

  const mapRef = useRef<MapView>(null);

  const locationTasks = events.filter(e => e.location || (e.locationDetails && e.locationDetails.latitude));

  const filteredTasks = locationTasks.filter(task => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return task.title.toLowerCase().includes(q) || 
           (task.location && task.location.toLowerCase().includes(q)) || 
           task.category.toLowerCase().includes(q);
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const coords = await geocodeAddress(searchQuery);
    if (coords && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  };

  useEffect(() => {
    if (location && !hasAutoZoomed && mapRef.current && !selectedTask) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      setHasAutoZoomed(true);
    }
  }, [location, hasAutoZoomed, selectedTask]);

  const handleRecenter = () => {
    if (location && mapRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedTask(null);
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  };

  return (
    <View style={styles.root}>
      {/* BG GLOWS */}
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={24} strokeWidth={2.5} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>LOCATION MAP RADAR</Text>
            <Text style={styles.headerSubtitle}>Proximity-based tasks</Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchRow}>
          <Search color={colors.textSecondary} size={20} style={styles.searchIcon} strokeWidth={2.5} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location or task..."
            placeholderTextColor="#98A2B3"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
        </View>

        {/* MAP CANVAS RADAR DISPLAY */}
        <View style={styles.mapCanvas}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={false}
            initialRegion={location ? {
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            } : undefined}
          >
            {filteredTasks.map(task => {
              if (!task.locationDetails?.latitude || !task.locationDetails?.longitude) return null;
              const isActive = selectedTask === task.id;
              
              return (
                <React.Fragment key={`map-marker-${task.id}`}>
                  <Marker
                    coordinate={{
                      latitude: task.locationDetails.latitude,
                      longitude: task.locationDetails.longitude,
                    }}
                    title={task.title}
                    description={task.location}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedTask(task.id);
                      mapRef.current?.animateToRegion({
                        latitude: task.locationDetails!.latitude!,
                        longitude: task.locationDetails!.longitude!,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                      });
                    }}
                    pinColor={isActive ? colors.primary : colors.secondary}
                  />
                  <Circle 
                    center={{
                      latitude: task.locationDetails.latitude,
                      longitude: task.locationDetails.longitude,
                    }}
                    radius={300} // 300m radius
                    strokeWidth={1}
                    strokeColor={isActive ? colors.primary : colors.secondary}
                    fillColor={isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(249, 115, 22, 0.1)'}
                  />
                </React.Fragment>
              );
            })}
          </MapView>

          <View style={styles.mapOverlayHeader}>
            <View style={styles.radarHeader}>
              <View style={styles.radarIconBox}>
                <Compass color={colors.secondary} size={20} strokeWidth={2.5} />
              </View>
              <Text style={styles.radarTitle}>INTERACTIVE RADAR</Text>
            </View>
          </View>

          <View style={[styles.mapOverlayFooter, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              {location ? (
                <View style={[styles.locationBadge, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
                  <Navigation color={colors.primary} size={14} strokeWidth={2.5} />
                  <Text style={[styles.locationBadgeText, { flexShrink: 1 }]} numberOfLines={1}>
                    {address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                  </Text>
                </View>
              ) : (
                <View style={[styles.locationBadge, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
                  <Text style={styles.mapSub}>Locating...</Text>
                </View>
              )}
            </View>
            <Pressable style={styles.recenterBtn} onPress={handleRecenter}>
              <LocateFixed color={colors.primary} size={22} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        {/* UPCOMING LOCATION TASKS SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>UPCOMING LOCATION TASKS ({filteredTasks.length})</Text>
        </View>

        <FlatList
          data={filteredTasks}
          keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : `map-task-${index}`)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            let distText = '';
            if (location && item.locationDetails?.latitude && item.locationDetails?.longitude) {
              const meters = Math.round(
                priorityService.getDistance(
                  location.latitude,
                  location.longitude,
                  item.locationDetails.latitude,
                  item.locationDetails.longitude
                )
              );
              distText = meters < 1000 ? `${meters}m away` : `${(meters / 1000).toFixed(1)}km away`;
            }

            return (
              <Pressable onPress={() => router.push(`/event/${item.id}` as any)}>
                <View style={styles.premiumCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconCircle}>
                      <MapPin color={colors.secondary} size={20} strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle}>{item.title}</Text>
                      <Text style={styles.triggerText}>
                        When you reach <Text style={styles.locationHighlight}>{item.location || 'destination'}</Text>
                      </Text>
                    </View>
                    <View style={styles.chevronBox}>
                      <ChevronRight color={colors.textSecondary} size={18} strokeWidth={2.5} />
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{item.icon || '📍'} {item.category.toUpperCase()}</Text>
                    </View>

                    {distText ? (
                      <View style={styles.distanceBadge}>
                        <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={StyleSheet.absoluteFillObject} />
                        <Text style={styles.distanceText}>{distText}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <MapPin color={colors.secondary} size={32} strokeWidth={2} />
              </View>
              <Text style={styles.emptyText}>No Location Tasks Found</Text>
              <Text style={styles.emptySub}>Add location details when creating a task to track arrival triggers on the radar.</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgGlowTop: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    backgroundColor: colors.secondaryLight,
    borderRadius: 150,
    opacity: 0.6,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -50,
    width: 300,
    height: 300,
    backgroundColor: colors.primaryLight,
    borderRadius: 150,
    opacity: 0.5,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 20,
    color: colors.text,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  mapCanvas: {
    backgroundColor: colors.card,
    borderRadius: 24,
    marginHorizontal: 16,
    height: 300,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 24,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapOverlayHeader: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  mapOverlayFooter: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  radarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  radarIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.text,
    letterSpacing: 0.5,
  },
  markerContainer: {
    marginVertical: 10,
    gap: 12,
  },
  userMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  userMarkerText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: colors.card,
  },
  markersScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  taskMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFE4D6',
  },
  taskMarkerActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  taskMarkerText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.secondary,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  locationBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.text,
  },
  recenterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  mapSub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  sectionHeaderRow: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  premiumCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  triggerText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  locationHighlight: {
    fontFamily: 'Poppins_600SemiBold',
    color: colors.secondary,
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  categoryBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    color: colors.text,
  },
  distanceBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  distanceText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#2E7D32',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  emptySub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  }
});
