import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Navigation, Check, School, ShoppingCart, Briefcase, Home, Compass } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { LocationDetails } from '../models/Event';
import * as Haptics from 'expo-haptics';

interface Props {
  value: string;
  onChangeLocation: (address: string, details?: LocationDetails) => void;
}

const PRESETS = [
  { label: 'College', icon: School, query: 'College Campus' },
  { label: 'Supermarket', icon: ShoppingCart, query: 'Supermarket Grocery' },
  { label: 'Office', icon: Briefcase, query: 'Work Office' },
  { label: 'Home', icon: Home, query: 'Home' },
];

const RADII = [
  { label: '100m', val: 100 },
  { label: '300m', val: 300 },
  { label: '500m', val: 500 },
  { label: '1km', val: 1000 },
];

export default function LocationSelector({ value, onChangeLocation }: Props) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const s = styles;
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [selectedRadius, setSelectedRadius] = useState<number>(500);

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
      </View>

      {/* Radius Selector & Active Badge */}
      <View style={styles.radiusRow}>
        <Text style={styles.radiusLabel}>Remind within:</Text>
        <View style={styles.radiusChips}>
          {RADII.map(r => (
            <Pressable
              key={r.val}
              style={[styles.radiusChip, selectedRadius === r.val && styles.radiusChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedRadius(r.val);
              }}
            >
              <Text style={[styles.radiusText, selectedRadius === r.val && styles.radiusTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {coords.lat && coords.lng ? (
        <View style={styles.coordsBadge}>
          <Check color={colors.success} size={13} strokeWidth={3} />
          <Text style={styles.coordsText}>
            📍 Proximity Geofence Active (within {selectedRadius}m of destination)
          </Text>
        </View>
      ) : null}
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
