import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

export interface MapViewProps {
  style?: any;
  initialRegion?: Region;
  region?: Region;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  onPress?: (e: { nativeEvent: { coordinate: LatLng } }) => void;
  children?: React.ReactNode;
}

export interface MarkerProps {
  coordinate: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}

export interface CircleProps {
  center: LatLng;
  radius: number;
  strokeWidth?: number;
  strokeColor?: string;
  fillColor?: string;
}

export const Marker: React.FC<MarkerProps> = () => null;
export const Circle: React.FC<CircleProps> = () => null;

export interface MapViewRef {
  animateToRegion: (region: Region, duration?: number) => void;
}

export type MapView = MapViewRef;

const MapView = forwardRef<MapViewRef, MapViewProps>(
  ({ style, initialRegion, children, onPress }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const initialLat = initialRegion?.latitude ?? 20.5937;
    const initialLng = initialRegion?.longitude ?? 78.9629;

    useImperativeHandle(ref, () => ({
      animateToRegion: (region: Region) => {
        try {
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({
                type: 'FLY_TO',
                latitude: region.latitude,
                longitude: region.longitude,
              }),
              '*'
            );
          }
        } catch {
          // Ignore
        }
      },
    }));

    const { markersData, circlesData } = useMemo(() => {
      const markers: any[] = [];
      const circles: any[] = [];

      React.Children.forEach(children, (child, index) => {
        if (!React.isValidElement(child)) return;
        const props = child.props as any;

        if (props.coordinate) {
          markers.push({
            id: child.key ? String(child.key) : `marker_${index}`,
            latitude: props.coordinate.latitude,
            longitude: props.coordinate.longitude,
            title: props.title || '',
            description: props.description || '',
            pinColor: props.pinColor || '#F97316',
          });
        } else if (props.center && typeof props.radius === 'number') {
          circles.push({
            latitude: props.center.latitude,
            longitude: props.center.longitude,
            radius: props.radius,
            strokeColor: props.strokeColor || '#6366F1',
            fillColor: props.fillColor || 'rgba(99, 102, 241, 0.2)',
          });
        }
      });

      return { markersData: markers, circlesData: circles };
    }, [children]);

    React.useEffect(() => {
      const handleWebMessage = (e: MessageEvent) => {
        try {
          if (typeof e.data !== 'string') return;
          const data = JSON.parse(e.data);
          if (data.type === 'MAP_PRESS' && onPress) {
            onPress({ nativeEvent: { coordinate: data.coordinate } });
          }
        } catch {
          // ignore
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }, [onPress]);

    const srcDoc = useMemo(() => {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .user-pulse {
      width: 16px;
      height: 16px;
      background: #3B82F6;
      border: 3px solid #FFF;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.8);
    }
    .custom-pin {
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid #FFF;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${initialLat}, ${initialLng}],
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    var markers = ${JSON.stringify(markersData)};
    var circles = ${JSON.stringify(circlesData)};

    markers.forEach(function(m) {
      var icon = L.divIcon({
        className: 'custom-pin-wrap',
        html: '<div class="custom-pin" style="background:' + (m.pinColor || '#F97316') + '"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      });
      var marker = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
      if (m.title || m.description) {
        marker.bindPopup('<b>' + (m.title || '') + '</b><br>' + (m.description || ''));
      }
    });

    circles.forEach(function(c) {
      L.circle([c.latitude, c.longitude], {
        radius: c.radius || 300,
        color: c.strokeColor || '#6366F1',
        fillColor: c.fillColor || '#6366F1',
        fillOpacity: 0.15
      }).addTo(map);
    });

    map.on('click', function(e) {
      window.parent.postMessage(JSON.stringify({
        type: 'MAP_PRESS',
        coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
      }), '*');
    });

    window.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'FLY_TO') {
          map.flyTo([data.latitude, data.longitude], 15);
        }
      } catch(err) {}
    });
  </script>
</body>
</html>
      `;
    }, [initialLat, initialLng, markersData, circlesData]);

    return (
      <View style={[styles.container, style]}>
        {/* @ts-ignore */}
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Interactive Web Map"
        />
      </View>
    );
  }
);

export default MapView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
});
