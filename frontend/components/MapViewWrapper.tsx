// Native version — uses real react-native-maps
import MapView, { Marker, MapViewProps } from 'react-native-maps';
import React from 'react';

interface Props {
  style?: any;
  initialCamera?: MapViewProps['initialCamera'];
  showsUserLocation?: boolean;
  markerCoordinate?: { latitude: number; longitude: number };
  markerTitle?: string;
}

export default function MapViewWrapper({ style, initialCamera, showsUserLocation, markerCoordinate, markerTitle }: Props) {
  return (
    <MapView
      style={style}
      initialCamera={initialCamera}
      showsUserLocation={showsUserLocation}
    >
      {markerCoordinate && (
        <Marker coordinate={markerCoordinate} title={markerTitle} />
      )}
    </MapView>
  );
}
