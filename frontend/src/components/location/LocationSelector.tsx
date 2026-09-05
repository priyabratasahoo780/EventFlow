import { useThemeStore } from '../../store/useThemeStore';
import { ColorTheme } from '../../constants/theme';
import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, Modal } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Navigation, Check, School, ShoppingCart, Briefcase, Home, Map as MapIcon, X, Search } from 'lucide-react-native';
import { LocationDetails } from '../../types/event.types';
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
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
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
        Alert.alert('Not Found', 'Could not find the location.');
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
    Haptics.selectionAsync();
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

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MapPin color={colors.primary} size={16} strokeWidth={2.5} />
        <Text style={styles.label}>Location & Arrival Geofence</Text>
        <Text style={styles.hint}>Triggers alarm when you reach</Text>
      </View>

      {/* Preset Location Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
        {PRESETS.map((p) => {
          const IconComp = p.icon;
          const isSelected = value.toLowerCase().includes(p.label.toLowerCase());
          return (
            <Pressable
              key={p.label}
              style={[styles.presetChip, isSelected && styles.presetChipActive]}
              onPress={() => handleSelectPreset(p.label, p.query)}
            >
              <IconComp color={colors.primary} size={14} strokeWidth={2.5} />
              <Text style={styles.presetText}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      
      {/* Search / Input Box */}
      <View style={styles.inputRow}>
        <MapPin color="#64748B" size={18} style={styles.icon} strokeWidth={2.4} />
        <TextInput
          style={styles.input}
          placeholder="e.g. College Library, City Supermarket..."
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={handleManualSearch}
        />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable style={styles.gpsBtn} onPress={handleGetCurrentLocation} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <View style={styles.gpsBtnInner}>
                <Navigation color="#FFF" size={14} strokeWidth={2.5} />
                <Text style={styles.gpsBtnText}>GPS</Text>
              </View>
            )}
          </Pressable>
          
          <Pressable 
            style={[styles.gpsBtn, { backgroundColor: colors.secondary }]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTempCoords(coords.lat ? coords : { lat: 20.5937, lng: 78.9629 });
              setShowMapModal(true);
            }}
          >
            <View style={styles.gpsBtnInner}>
              <MapIcon color="#FFF" size={14} strokeWidth={2.5} />
              <Text style={styles.gpsBtnText}>MAP</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Radius Selector & Active Badge */}
      <View style={styles.radiusRow}>
        <Text style={styles.radiusLabel}>Remind within:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusChips}>
          {RADII.map(r => (
            <Pressable
              key={r.val}
              style={[styles.radiusChip, radius === r.val && styles.radiusChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                if (onChangeRadius) onChangeRadius(r.val);
              }}
            >
              <Text style={[styles.radiusText, radius === r.val && styles.radiusTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {coords.lat && coords.lng ? (
        <View style={styles.coordsBadge}>
          <Check color={colors.success} size={13} strokeWidth={3} />
          <Text style={styles.coordsText}>
            📍 Proximity Geofence Active (within {radius}m of destination)
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
                style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}
              >
                <X color={colors.text} size={22} strokeWidth={2.5} />
              </Pressable>

              <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.card, borderRadius: 25, paddingHorizontal: 16, alignItems: 'center', height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}>
                <Search color={colors.textSecondary} size={20} style={{ marginRight: 8 }} strokeWidth={2.5} />
                <TextInput 
                  style={{ flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: colors.text }}
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
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 20 }}>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <MapPin color={colors.primary} size={26} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 18, color: colors.text, marginBottom: 2 }}>Pin Location</Text>
                <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 13, color: colors.textSecondary }} numberOfLines={2}>
                  {tempCoords.lat ? `Selected: ${tempCoords.lat.toFixed(4)}, ${tempCoords.lng?.toFixed(4)}` : 'Tap on the map to drop a pin'}
                </Text>
              </View>
            </View>

            <Pressable 
              style={({pressed}) => [{ borderRadius: 16, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
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
              <LinearGradient colors={['#6366F1', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 16, overflow: 'hidden' }}>
                <Text style={{ fontFamily: 'Poppins_800ExtraBold', fontSize: 15, color: '#FFF', letterSpacing: 1.2 }}>CONFIRM LOCATION</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    marginTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: colors.primary,
  },
  hint: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: colors.textSecondary,
  },
  presetScroll: {
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  presetChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  presetText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.text,
  },
  gpsBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  gpsBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: colors.card,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  radiusLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#64748B',
  },
  radiusChips: {
    flexDirection: 'row',
    gap: 4,
  },
  radiusChip: {
    backgroundColor: '#FFF',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  radiusChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  radiusText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: '#64748B',
  },
  radiusTextActive: {
    color: '#FFF',
  },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 8,
  },
  coordsText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    color: '#15803D',
  },
});
