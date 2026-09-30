import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, Modal } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Navigation, Check, School, ShoppingCart, Briefcase, Home, Map as MapIcon, X, Search } from 'lucide-react-native';
import { LocationDetails } from '../models/Event';
import * as Haptics from 'expo-haptics';
import MapViewWrapper from './MapViewWrapper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  value: string;
  onChangeLocation: (address: string, details?: LocationDetails) => void;
  radius?: number;
  onChangeRadius?: (radius: number) => void;
}

const PRESETS = [
  { label: 'College', icon: School, query: 'College Campus' },
  { label: 'Supermarket', icon: ShoppingCart, query: 'Supermarket Grocery' },
  { label: 'Office', icon: Briefcase, query: 'Work Office' },
  { label: 'Home', icon: Home, query: 'Home' },
];

const RADII = [
  { label: '100m', val: 100 },
  { label: '200m', val: 200 },
  { label: '300m', val: 300 },
  { label: '500m', val: 500 },
  { label: '1km', val: 1000 },
];

export default function LocationSelector({ value, onChangeLocation, radius = 500, onChangeRadius }: Props) {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const isDarkMode = isDark();
  const styles = getStyles(colors, isDarkMode);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  
  // Map Modal States
  const [showMapModal, setShowMapModal] = useState(false);
  const [tempCoords, setTempCoords] = useState<{ lat?: number; lng?: number }>({});
  
  const mapRef = useRef<any>(null);
  const [mapSearchText, setMapSearchText] = useState('');
  const [mapSearchLoading, setMapSearchLoading] = useState(false);

  const handleMapSearch = async () => {
    if (!mapSearchText || mapSearchText.length < 3) return;
    setMapSearchLoading(true);
    try {
      const results = await Location.geocodeAsync(mapSearchText);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        setTempCoords({ lat: latitude, lng: longitude });
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Not Found', 'Could not find the location on the map.');
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setMapSearchLoading(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for GPS proximity reminders.');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setCoords({ lat, lng });

      // Reverse geocode to get human address
      const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (reverse && reverse.length > 0) {
        const item = reverse[0];
        const formatted = [item.name, item.street, item.city].filter(Boolean).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        onChangeLocation(formatted, { latitude: lat, longitude: lng, address: formatted });
      } else {
        const formatted = `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        onChangeLocation(formatted, { latitude: lat, longitude: lng, address: formatted });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.warn('GPS location fetch error:', err);
      Alert.alert('Location Error', 'Unable to fetch current location.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = async (presetName: string, query: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeLocation(presetName, { address: presetName });

    try {
      const results = await Location.geocodeAsync(query);
      if (results && results.length > 0) {
        const lat = results[0].latitude;
        const lng = results[0].longitude;
        setCoords({ lat, lng });
        onChangeLocation(presetName, { latitude: lat, longitude: lng, address: presetName });
      } else {
        // Fallback to current device coords with preset tag
        const loc = await Location.getCurrentPositionAsync({});
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        onChangeLocation(presetName, { latitude: loc.coords.latitude, longitude: loc.coords.longitude, address: presetName });
      }
    } catch (e) {
      console.log('Geocoding fallback');
    }
  };

  const handleManualSearch = async (text: string) => {
    onChangeLocation(text, { address: text });
    if (text.length > 3) {
      try {
        const results = await Location.geocodeAsync(text);
        if (results && results.length > 0) {
          setCoords({ lat: results[0].latitude, lng: results[0].longitude });
          onChangeLocation(text, { latitude: results[0].latitude, longitude: results[0].longitude, address: text });
        }
      } catch (e) {}
    }
  };

  const handleClearLocation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCoords({});
    onChangeLocation('', undefined);
  };

  return (
    <View style={styles.container}>
      {/* HEADER ROW */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconSquircle}>
            <MapPin color={colors.primary} size={18} strokeWidth={2.4} />
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.label}>Location & Arrival Geofence</Text>
            <Text style={styles.hint}>Triggers alarm when you reach</Text>
          </View>
        </View>

        {value ? (
          <Pressable 
            onPress={handleClearLocation} 
            hitSlop={8} 
            style={styles.clearBtn}
          >
            <X color={colors.textSecondary} size={14} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>

      {/* PRESET CHIPS */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.presetScroll}
      >
        {PRESETS.map((p) => {
          const IconComp = p.icon;
          const isSelected = value.toLowerCase().includes(p.label.toLowerCase());
          return (
            <Pressable
              key={p.label}
              style={({ pressed }) => [
                styles.presetChip,
                isSelected && styles.presetChipActive,
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => handleSelectPreset(p.label, p.query)}
            >
              <IconComp 
                color={isSelected ? colors.primary : colors.textSecondary} 
                size={14} 
                strokeWidth={2.4} 
              />
              <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ADDRESS INPUT BAR */}
      <View style={styles.inputBar}>
        <MapPin color={colors.textSecondary} size={18} strokeWidth={2.2} style={styles.inputPinIcon} />
        <TextInput
          style={styles.input}
          placeholder="e.g. GF4+HVC, Kalol or College Library..."
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={handleManualSearch}
        />
        {value ? (
          <Pressable onPress={handleClearLocation} hitSlop={6} style={styles.inputClearBtn}>
            <X color={colors.textSecondary} size={14} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>

      {/* DUAL ACTION BUTTONS: GPS & MAP */}
      <View style={styles.actionRow}>
        <Pressable 
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]} 
          onPress={handleGetCurrentLocation} 
          disabled={loading}
        >
          <LinearGradient
            colors={['#4F46E5', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionBtnGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <View style={styles.actionBtnInner}>
                <Navigation color="#FFF" size={14} strokeWidth={2.5} />
                <Text style={styles.actionBtnText}>GPS</Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable 
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTempCoords(coords.lat ? coords : { lat: 20.5937, lng: 78.9629 });
            setShowMapModal(true);
          }}
        >
          <LinearGradient
            colors={['#FF7A00', '#F97316']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionBtnGradient}
          >
            <View style={styles.actionBtnInner}>
              <MapIcon color="#FFF" size={14} strokeWidth={2.5} />
              <Text style={styles.actionBtnText}>MAP</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      {/* RADIUS SELECTOR */}
      <View style={styles.radiusContainer}>
        <View style={styles.radiusHeader}>
          <Text style={styles.radiusLabel}>Remind within:</Text>
          <Text style={styles.radiusValueTag}>
            {radius < 1000 ? `${radius}m` : `${radius / 1000}km`}
          </Text>
        </View>

        <View style={styles.radiusChips}>
          {RADII.map((r) => {
            const isSelected = radius === r.val;
            return (
              <Pressable
                key={r.val}
                style={({ pressed }) => [
                  styles.radiusChip,
                  isSelected && styles.radiusChipActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (onChangeRadius) onChangeRadius(r.val);
                }}
              >
                <Text style={[styles.radiusText, isSelected && styles.radiusTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ACTIVE GEOFENCE BADGE */}
      {coords.lat && coords.lng ? (
        <View style={styles.coordsBadge}>
          <View style={styles.coordsBadgeIconWrap}>
            <Check color="#FFF" size={12} strokeWidth={3} />
          </View>
          <Text style={styles.coordsText}>
            📍 Proximity Geofence Active (within {radius < 1000 ? `${radius}m` : `${radius / 1000}km`} of destination)
          </Text>
        </View>
      ) : null}

      {/* MAP PICKER MODAL */}
      <Modal visible={showMapModal} animationType="slide" transparent={true} onRequestClose={() => setShowMapModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <MapViewWrapper
            ref={mapRef}
            style={{ flex: 1 }}
            initialCamera={{ center: { latitude: tempCoords.lat || 20.5937, longitude: tempCoords.lng || 78.9629 } }}
            showsUserLocation={true}
            markerCoordinate={tempCoords.lat && tempCoords.lng ? { latitude: tempCoords.lat, longitude: tempCoords.lng } : undefined}
            onPress={(e) => {
              Haptics.selectionAsync();
              setTempCoords({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
            }}
          />

          {/* FLOATING TOP BAR */}
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} edges={['top']}>
            <View style={{ marginHorizontal: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable 
                onPress={() => setShowMapModal(false)} 
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}
              >
                <X color={colors.text} size={22} strokeWidth={2.5} />
              </Pressable>

              <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.card, borderRadius: 24, paddingHorizontal: 16, alignItems: 'center', height: 48, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}>
                <Search color={colors.textSecondary} size={18} style={{ marginRight: 8 }} strokeWidth={2.5} />
                <TextInput 
                  style={{ flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 13, color: colors.text }}
                  placeholder="Search map location..."
                  placeholderTextColor={colors.textSecondary}
                  value={mapSearchText}
                  onChangeText={setMapSearchText}
                  onSubmitEditing={handleMapSearch}
                  returnKeyType="search"
                />
                {mapSearchLoading && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
            </View>
          </SafeAreaView>

          {/* FLOATING BOTTOM PANEL */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 36, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 20 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#E2E8F0', alignSelf: 'center', marginBottom: 16 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <MapPin color={colors.primary} size={22} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 16, color: colors.text, marginBottom: 2 }}>Pin Location</Text>
                <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: colors.textSecondary }} numberOfLines={2}>
                  {tempCoords.lat ? `Selected: ${tempCoords.lat.toFixed(4)}, ${tempCoords.lng?.toFixed(4)}` : 'Tap on the map to drop a pin'}
                </Text>
              </View>
            </View>

            <Pressable 
              style={({ pressed }) => [{ borderRadius: 14, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 8 }, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
              onPress={async () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (tempCoords.lat && tempCoords.lng) {
                  setCoords(tempCoords);
                  try {
                    const reverse = await Location.reverseGeocodeAsync({ latitude: tempCoords.lat, longitude: tempCoords.lng });
                    if (reverse && reverse.length > 0) {
                      const item = reverse[0];
                      const formatted = [item.name, item.street, item.city].filter(Boolean).join(', ');
                      onChangeLocation(formatted || 'Selected on Map', { latitude: tempCoords.lat, longitude: tempCoords.lng, address: formatted });
                    } else {
                      onChangeLocation('Selected on Map', { latitude: tempCoords.lat, longitude: tempCoords.lng, address: 'Selected on Map' });
                    }
                  } catch (err) {
                    onChangeLocation('Selected on Map', { latitude: tempCoords.lat, longitude: tempCoords.lng, address: 'Selected on Map' });
                  }
                }
                setShowMapModal(false);
              }}
            >
              <LinearGradient colors={['#6366F1', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 14, overflow: 'hidden' }}>
                <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 14, color: '#FFF', letterSpacing: 1 }}>CONFIRM LOCATION</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ColorTheme, isDarkMode: boolean) => StyleSheet.create({
  container: {
    backgroundColor: isDarkMode ? '#1A182E' : '#F9F8FD',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.22)' : '#ECE9FB',
    marginTop: 20,
    shadowColor: isDarkMode ? '#000000' : '#4338CA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDarkMode ? 0.25 : 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#EDEAFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: {
    flex: 1,
  },
  label: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: colors.primary,
    letterSpacing: -0.2,
  },
  hint: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 0.5,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetScroll: {
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : colors.card,
    borderWidth: 1.2,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 6,
  },
  presetChipActive: {
    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.22)' : '#EDEAFD',
    borderColor: colors.primary,
  },
  presetText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  presetTextActive: {
    color: colors.primary,
    fontFamily: 'Poppins_700Bold',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(15, 17, 34, 0.65)' : colors.card,
    borderWidth: 1.2,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 10,
  },
  inputPinIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.text,
  },
  inputClearBtn: {
    padding: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnGradient: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  radiusContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
  },
  radiusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  radiusLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  radiusValueTag: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11.5,
    color: colors.primary,
  },
  radiusChips: {
    flexDirection: 'row',
    gap: 6,
  },
  radiusChip: {
    flex: 1,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : colors.card,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusChipActive: {
    backgroundColor: isDarkMode ? colors.primary : '#0F172A',
    borderColor: isDarkMode ? colors.primary : '#0F172A',
    shadowColor: isDarkMode ? colors.primary : '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  radiusText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  radiusTextActive: {
    color: '#FFF',
    fontFamily: 'Poppins_700Bold',
  },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.35)' : '#86EFAC',
    marginTop: 12,
  },
  coordsBadgeIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordsText: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: isDarkMode ? '#4ADE80' : '#15803D',
  },
});

