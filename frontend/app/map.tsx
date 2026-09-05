import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Search, Compass, ChevronRight, LocateFixed } from 'lucide-react-native';
import { useEventStore } from '../store/useEventStore';
import { useLocation } from '../hooks/useLocation';
import { priorityService } from '../services/priorityService';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Circle, MapViewRef } from '../components/maps';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const CARD_MARGIN = 12;

export default function MapScreen() {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const isDarkMode = isDark();
  const styles = getStyles(colors, isDarkMode);
  const router = useRouter();
  const { events } = useEventStore();
  const { location, geocodeAddress } = useLocation(events);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [hasAutoZoomed, setHasAutoZoomed] = useState(false);
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapViewRef>(null);
  const flatListRef = useRef<FlatList>(null);

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

  const handleMarkerPress = (task: any, index: number) => {
    Haptics.selectionAsync();
    setSelectedTask(task.id);
    mapRef.current?.animateToRegion({
      latitude: task.locationDetails!.latitude!,
      longitude: task.locationDetails!.longitude!,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const item = viewableItems[0].item;
      if (item.id !== selectedTask) {
        setSelectedTask(item.id);
        if (item.locationDetails?.latitude) {
          mapRef.current?.animateToRegion({
            latitude: item.locationDetails.latitude,
            longitude: item.locationDetails.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          });
        }
      }
    }
  }).current;

  // Modern Dark Mode map style
  const customMapStyle = isDarkMode ? [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
  ] : [];

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        customMapStyle={customMapStyle}
        initialRegion={location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        } : undefined}
      >
        {filteredTasks.map((task, index) => {
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
                onPress={() => handleMarkerPress(task, index)}
              >
                <View style={[styles.customMarker, isActive && styles.customMarkerActive]}>
                  <MapPin color={isActive ? "#FFF" : colors.primary} size={isActive ? 24 : 20} strokeWidth={2.5} />
                </View>
              </Marker>
              <Circle 
                center={{
                  latitude: task.locationDetails.latitude,
                  longitude: task.locationDetails.longitude,
                }}
                radius={300}
                strokeWidth={1}
                strokeColor={isActive ? colors.primary : 'transparent'}
                fillColor={isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.05)'}
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Floating Header */}
      <View style={[styles.floatingHeader, { top: Math.max(insets.top, 16) }]}>
        <View style={styles.searchRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.searchInputContainer}>
            <Search color={colors.textSecondary} size={18} strokeWidth={2.5} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tasks or places..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
          </View>
        </View>
      </View>

      {/* Floating Controls */}
      <View style={styles.floatingControls}>
        <Pressable style={styles.controlBtn} onPress={handleRecenter}>
          <LocateFixed color={colors.primary} size={24} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Bottom Task Carousel */}
      <View style={[styles.carouselContainer, { bottom: Math.max(insets.bottom, 16) }]}>
        <FlatList
          ref={flatListRef}
          horizontal
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_MARGIN}
          snapToAlignment="center"
          decelerationRate="fast"
          contentContainerStyle={styles.carouselContent}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
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
                <View style={styles.taskCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconCircle}>
                      <MapPin color={colors.secondary} size={20} strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.triggerText} numberOfLines={1}>
                        At <Text style={styles.locationHighlight}>{item.location || 'destination'}</Text>
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
                        <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={StyleSheet.absoluteFill} />
                        <Text style={styles.distanceText}>{distText}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Compass color={colors.secondary} size={32} strokeWidth={2} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No Tasks Here</Text>
              <Text style={styles.emptySub}>Add location to a task to see it on the map.</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const getStyles = (colors: ColorTheme, isDarkMode: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  customMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  customMarkerActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    borderColor: '#FFF',
    transform: [{ scale: 1.1 }],
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDarkMode ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: '40%',
    zIndex: 10,
    alignItems: 'center',
    gap: 16,
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: isDarkMode ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  carouselContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  carouselContent: {
    paddingHorizontal: (width - CARD_WIDTH) / 2,
    gap: CARD_MARGIN,
    alignItems: 'flex-end',
  },
  taskCard: {
    width: CARD_WIDTH,
    backgroundColor: isDarkMode ? 'rgba(35,35,35,0.95)' : 'rgba(255,255,255,0.98)',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    fontSize: 13,
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
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(255,255,255,0.05)' : colors.border,
  },
  categoryBadge: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: colors.text,
  },
  distanceBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  distanceText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#2E7D32',
  },
  emptyCard: {
    width: CARD_WIDTH,
    backgroundColor: isDarkMode ? 'rgba(35,35,35,0.95)' : 'rgba(255,255,255,0.98)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)',
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
    marginTop: 4,
  }
});
