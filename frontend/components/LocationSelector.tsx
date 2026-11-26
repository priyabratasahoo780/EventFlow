
import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import * as Location from 'expo-location';
import {
  MapPin,
  Navigation,
  School,
  ShoppingCart,
  Briefcase,
  Home,
  Map as MapIcon,
  X,
  Search,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import { LocationDetails } from '../models/Event';
import * as Haptics from 'expo-haptics';
import MapViewWrapper from './MapViewWrapper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  value: string;
  initialDetails?: LocationDetails;
  onChangeLocation: (address: string, details?: LocationDetails) => void;
  radius?: number;
  onChangeRadius?: (radius: number) => void;
}

const PRESETS = [
  { label: 'Home', icon: Home, useCurrentIfNearby: true, query: 'Home' },
  { label: 'Office', icon: Briefcase, useCurrentIfNearby: false, query: 'Office' },
  { label: 'College', icon: School, useCurrentIfNearby: false, query: 'College' },
  { label: 'Supermarket', icon: ShoppingCart, useCurrentIfNearby: false, query: 'Supermarket' },
];

export default function LocationSelector({
  value,
  initialDetails,
  onChangeLocation,
}: Props) {
  const { getColors, isDark } = useThemeStore();
  const colors = getColors();
  const isDarkMode = isDark();
  const styles = getStyles(colors, isDarkMode);

  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>(() =>
    initialDetails?.latitude && initialDetails?.longitude
      ? { lat: initialDetails.latitude, lng: initialDetails.longitude }
      : {}
  );

  const [showMapModal, setShowMapModal] = useState(false);
  const [tempCoords, setTempCoords] = useState<{ lat?: number; lng?: number }>({});

  const mapRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapSearchText, setMapSearchText] = useState('');
  const [mapSearchLoading, setMapSearchLoading] = useState(false);

  // Sync external initialDetails changes (e.g. async store hydration on Edit screen)
  useEffect(() => {
    if (
      typeof initialDetails?.latitude === 'number' &&
      typeof initialDetails?.longitude === 'number'
    ) {
      setCoords({ lat: initialDetails.latitude, lng: initialDetails.longitude });
    }
  }, [initialDetails?.latitude, initialDetails?.longitude]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasPinnedCoords = typeof coords.lat === 'number' && typeof coords.lng === 'number';

  const handleMapSearch = async () => {
    if (!mapSearchText || mapSearchText.trim().length < 2) return;
    setMapSearchLoading(true);
    try {
      const results = await Location.geocodeAsync(mapSearchText.trim());
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        setTempCoords({ lat: latitude, lng: longitude });
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Not Found', 'Could not find that place. Try tapping the map to pin it manually.');
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setMapSearchLoading(false);
    }
  };

  const handleGetCurrentLocation = async (customLabel?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for GPS proximity reminders.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setCoords({ lat, lng });

      if (customLabel) {
        onChangeLocation(customLabel, { latitude: lat, longitude: lng, address: customLabel });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      try {
        const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (reverse && reverse.length > 0) {
          const item = reverse[0];
          const formatted =
            [item.name, item.street, item.city].filter(Boolean).join(', ') ||
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          onChangeLocation(formatted, { latitude: lat, longitude: lng, address: formatted });
        } else {
          const formatted = `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          onChangeLocation(formatted, { latitude: lat, longitude: lng, address: formatted });
        }
      } catch {
        const formatted = `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        onChangeLocation(formatted, { latitude: lat, longitude: lng, address: formatted });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.warn('GPS location fetch error:', err);
      Alert.alert('Location Error', 'Unable to fetch current GPS location. Try picking on the Map.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = async (preset: (typeof PRESETS)[number]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // If user picks "Home" (or preset with current preference) and GPS is permitted, anchor cleanly or open map
    if (preset.useCurrentIfNearby) {
      await handleGetCurrentLocation(preset.label);
      return;
    }

    setGeocoding(true);
    try {
      // Search nearby using user's current region when available for realistic results
      let searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(preset.query)}&format=json&limit=1`;
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          const { latitude, longitude } = last.coords;
          const delta = 0.15;
          searchUrl += `&viewbox=${longitude - delta},${latitude + delta},${longitude + delta},${latitude - delta}&bounded=1`;
        }
      } catch {}

      const resp = await fetch(searchUrl, {
        headers: { 'User-Agent': 'EventFlowApp/2.0 (contact@eventflow.app)' },
      });
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const label = data[0].display_name?.split(',').slice(0, 2).join(',').trim() || preset.label;
        setCoords({ lat, lng });
        onChangeLocation(label, { latitude: lat, longitude: lng, address: label });
        setGeocoding(false);
        return;
      }
    } catch {}

    // Fallback to device geocoder or current GPS
    try {
      const results = await Location.geocodeAsync(preset.query);
      if (results && results.length > 0) {
        const lat = results[0].latitude;
        const lng = results[0].longitude;
        setCoords({ lat, lng });
        onChangeLocation(preset.label, { latitude: lat, longitude: lng, address: preset.label });
      } else {
        onChangeLocation(preset.label, coords.lat && coords.lng ? { latitude: coords.lat, longitude: coords.lng, address: preset.label } : undefined);
      }
    } catch {
      onChangeLocation(preset.label, coords.lat && coords.lng ? { latitude: coords.lat, longitude: coords.lng, address: preset.label } : undefined);
    } finally {
      setGeocoding(false);
    }
  };

  const handleManualSearch = (text: string) => {
    // Preserve already-pinned coordinates while updating display text until new geocode resolves
    onChangeLocation(
      text,
      hasPinnedCoords
        ? { latitude: coords.lat, longitude: coords.lng, address: text }
        : text.trim()
        ? { address: text }
        : undefined
    );

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length > 3) {
      debounceRef.current = setTimeout(async () => {
        setGeocoding(true);
        try {
          const results = await Location.geocodeAsync(text.trim());
          if (results && results.length > 0) {
            const lat = results[0].latitude;
            const lng = results[0].longitude;
            setCoords({ lat, lng });
            onChangeLocation(text, { latitude: lat, longitude: lng, address: text });
          }
        } catch {} finally {
          setGeocoding(false);
        }
      }, 650);
    }
  };

  const handleClearLocation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCoords({});
    onChangeLocation('', undefined);
  };

  const openMapPicker = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (hasPinnedCoords) {
      setTempCoords(coords);
    } else {
      try {
        const last = await Location.getLastKnownPositionAsync();
        setTempCoords(
          last
            ? { lat: last.coords.latitude, lng: last.coords.longitude }
            : { lat: 20.5937, lng: 78.9629 }
        );
      } catch {
        setTempCoords({ lat: 20.5937, lng: 78.9629 });
      }
    }
    setShowMapModal(true);
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
            <Text style={styles.label}>Target Location</Text>
            <Text style={styles.hint}>Search address, use GPS, or pin on map</Text>
          </View>
        </View>

        {value ? (
          <Pressable onPress={handleClearLocation} hitSlop={8} style={styles.clearBtn}>
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
              onPress={() => handleSelectPreset(p)}
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
        <MapPin
          color={colors.textSecondary}
          size={18}
          strokeWidth={2.2}
          style={styles.inputPinIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Search place or enter label..."
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={handleManualSearch}
        />
        {geocoding ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
        ) : null}
        {value ? (
          <Pressable onPress={handleClearLocation} hitSlop={6} style={styles.inputClearBtn}>
            <X color={colors.textSecondary} size={14} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>

      {/* DUAL ACTION BUTTONS: GPS & MAP */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => handleGetCurrentLocation()}
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
                <Text style={styles.actionBtnText}>USE CURRENT GPS</Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
          ]}
          onPress={openMapPicker}
        >
          <LinearGradient
            colors={['#FF7A00', '#F97316']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionBtnGradient}
          >
            <View style={styles.actionBtnInner}>
              <MapIcon color="#FFF" size={14} strokeWidth={2.5} />
              <Text style={styles.actionBtnText}>PICK ON MAP</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      {/* PINNED LOCATION STATUS */}
      {value || hasPinnedCoords ? (
        <View
          style={[
            styles.pinnedStatus,
            !hasPinnedCoords && {
              backgroundColor: isDarkMode ? 'rgba(245,158,11,0.14)' : '#FEF3C7',
              borderColor: isDarkMode ? 'rgba(245,158,11,0.3)' : '#FDE68A',
            },
          ]}
        >
          {hasPinnedCoords ? (
            <CheckCircle2 color="#10B981" size={15} strokeWidth={2.4} />
          ) : (
            <AlertCircle color="#D97706" size={15} strokeWidth={2.4} />
          )}
          <Text
            style={[
              styles.pinnedText,
              !hasPinnedCoords && { color: '#D97706' },
            ]}
            numberOfLines={1}
          >
            {hasPinnedCoords
              ? `GPS Locked (${coords.lat!.toFixed(4)}, ${coords.lng!.toFixed(4)})`
              : 'Tap GPS or PICK ON MAP to pin coordinates'}
          </Text>
        </View>
      ) : null}

      {/* MAP PICKER MODAL */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <MapViewWrapper
            ref={mapRef}
            style={{ flex: 1 }}
            initialCamera={{
              center: {
                latitude: tempCoords.lat || 20.5937,
                longitude: tempCoords.lng || 78.9629,
              },
            }}
            showsUserLocation={true}
            markerCoordinate={
              tempCoords.lat && tempCoords.lng
                ? { latitude: tempCoords.lat, longitude: tempCoords.lng }
                : undefined
            }
            onPress={(e) => {
              Haptics.selectionAsync();
              setTempCoords({
                lat: e.nativeEvent.coordinate.latitude,
                lng: e.nativeEvent.coordinate.longitude,
              });
            }}
          />

          {/* FLOATING TOP BAR */}
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} edges={['top']}>
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Pressable
                onPress={() => setShowMapModal(false)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <X color={colors.text} size={22} strokeWidth={2.5} />
              </Pressable>

              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  backgroundColor: colors.card,
                  borderRadius: 24,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  height: 48,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
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
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.card,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              padding: 22,
              paddingBottom: 36,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 20,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <MapPin color={colors.primary} size={22} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 16, color: colors.text, marginBottom: 2 }}>
                  Pin Location
                </Text>
                <Text
                  style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: colors.textSecondary }}
                  numberOfLines={2}
                >
                  {tempCoords.lat
                    ? `Selected: ${tempCoords.lat.toFixed(4)}, ${tempCoords.lng?.toFixed(4)}`
                    : 'Tap anywhere on the map to drop a pin'}
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                {
                  borderRadius: 14,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: 14,
                  elevation: 8,
                },
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              onPress={async () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (tempCoords.lat && tempCoords.lng) {
                  setCoords(tempCoords);
                  try {
                    const reverse = await Location.reverseGeocodeAsync({
                      latitude: tempCoords.lat,
                      longitude: tempCoords.lng,
                    });
                    if (reverse && reverse.length > 0) {
                      const item = reverse[0];
                      const formatted = [item.name, item.street, item.city].filter(Boolean).join(', ');
                      onChangeLocation(formatted || 'Pinned Location', {
                        latitude: tempCoords.lat,
                        longitude: tempCoords.lng,
                        address: formatted || 'Pinned Location',
                      });
                    } else {
                      onChangeLocation('Pinned Location', {
                        latitude: tempCoords.lat,
                        longitude: tempCoords.lng,
                        address: 'Pinned Location',
                      });
                    }
                  } catch {
                    onChangeLocation('Pinned Location', {
                      latitude: tempCoords.lat,
                      longitude: tempCoords.lng,
                      address: 'Pinned Location',
                    });
                  }
                }
                setShowMapModal(false);
              }}
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
              >
                <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 14, color: '#FFF', letterSpacing: 1 }}>
                  CONFIRM LOCATION
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ColorTheme, isDarkMode: boolean) =>
  StyleSheet.create({
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
      marginBottom: 4,
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
      paddingVertical: 11,
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
      fontSize: 11,
      color: '#FFF',
      letterSpacing: 0.4,
    },
    pinnedStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
      marginTop: 10,
    },
    pinnedText: {
      flex: 1,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 11.5,
      color: isDarkMode ? '#34D399' : '#047857',
    },
  });
