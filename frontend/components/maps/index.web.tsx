import React from 'react';
import { View, Text } from 'react-native';

const MapView = React.forwardRef<any, any>((props, ref) => {
  // Expose animateToRegion so mapRef.current.animateToRegion doesn't crash
  React.useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
  }));

  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f4f8' }, props.style]}>
      <Text style={{ color: '#666', fontSize: 13, fontFamily: 'Poppins_600SemiBold' }}>Map unavailable on web</Text>
    </View>
  );
});

const Marker = () => null;
const Circle = () => null;

export default MapView;
export { Marker, Circle };
