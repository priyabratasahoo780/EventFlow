import MapView, { Marker } from './maps';

interface Props {
  style?: any;
  initialCamera?: any;
  showsUserLocation?: boolean;
  markerCoordinate?: { latitude: number; longitude: number };
  markerTitle?: string;
  onPress?: (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
}

export default function MapViewWrapper({
  style,
  initialCamera,
  showsUserLocation,
  markerCoordinate,
  markerTitle,
  onPress,
}: Props) {
  const initialRegion = markerCoordinate
    ? {
        latitude: markerCoordinate.latitude,
        longitude: markerCoordinate.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }
    : initialCamera?.center
    ? {
        latitude: initialCamera.center.latitude,
        longitude: initialCamera.center.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }
    : undefined;

  return (
    <MapView
      style={style}
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      onPress={onPress}
    >
      {markerCoordinate && (
        <Marker
          coordinate={markerCoordinate}
          title={markerTitle}
          pinColor="#6366F1"
        />
      )}
    </MapView>
  );
}
