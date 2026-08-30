// Web stub — react-native-maps is NOT supported on web
import React from 'react';
import { View, Text } from 'react-native';
import { MapPin } from 'lucide-react-native';

interface Props {
  style?: any;
  initialCamera?: any;
  showsUserLocation?: boolean;
  markerCoordinate?: { latitude: number; longitude: number };
  markerTitle?: string;
}

export default function MapViewWrapper({ style }: Props) {
  return (
    <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f4f8', borderRadius: 12 }]}>
      <MapPin color="#6366F1" size={32} strokeWidth={2.5} />
      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#555', marginTop: 8 }}>
        Map view is only available on mobile
      </Text>
    </View>
  );
}
