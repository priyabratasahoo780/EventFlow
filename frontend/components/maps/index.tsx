import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

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
  customMapStyle?: any[];
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

// Marker & Circle declaration components
export const Marker: React.FC<MarkerProps> = () => null;
export const Circle: React.FC<CircleProps> = () => null;

export interface MapViewRef {
  animateToRegion: (region: Region, duration?: number) => void;
}

export type MapView = MapViewRef;

function deltaToZoom(delta?: number): number {
  if (!delta || delta <= 0) return 15;
  // delta of ~0.02 is approx zoom 15, delta of 0.08 is approx zoom 13
  const zoom = Math.round(Math.log(360 / delta) / Math.LN2);
  return Math.min(Math.max(zoom, 3), 18);
}

const MapView = forwardRef<MapViewRef, MapViewProps>(
  ({ style, initialRegion, showsUserLocation = true, children, onPress }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const markerCallbacksRef = useRef<Record<string, () => void>>({});

    // Parse children to extract Markers and Circles
    const { markersData, circlesData } = useMemo(() => {
      const markers: any[] = [];
      const circles: any[] = [];
      const callbacks: Record<string, () => void> = {};

      React.Children.forEach(children, (child, index) => {
        if (!React.isValidElement(child)) return;


        const props = child.props as any;

        if (props.coordinate) {
          // It's a Marker
          const markerId = child.key ? String(child.key) : `marker_${index}`;
          markers.push({
            id: markerId,
            latitude: props.coordinate.latitude,
            longitude: props.coordinate.longitude,
            title: props.title || '',
            description: props.description || '',
            pinColor: props.pinColor || '#F97316',
          });

          if (props.onPress) {
            callbacks[markerId] = props.onPress;
          }
        } else if (props.center && typeof props.radius === 'number') {
          // It's a Circle
          circles.push({
            latitude: props.center.latitude,
            longitude: props.center.longitude,
            radius: props.radius,
            strokeWidth: props.strokeWidth ?? 2,
            strokeColor: props.strokeColor || '#6366F1',
            fillColor: props.fillColor || 'rgba(99, 102, 241, 0.2)',
          });
        }
      });

      markerCallbacksRef.current = callbacks;
      return { markersData: markers, circlesData: circles };
    }, [children]);

    const initialLat = initialRegion?.latitude ?? 20.5937;
    const initialLng = initialRegion?.longitude ?? 78.9629;
    const initialZoom = deltaToZoom(initialRegion?.latitudeDelta || 0.05);

    // Expose animateToRegion to mapRef.current
    useImperativeHandle(ref, () => ({
      animateToRegion: (region: Region) => {
        const zoom = deltaToZoom(region.latitudeDelta);
        const script = `
          if (window.map) {
            window.map.flyTo([${region.latitude}, ${region.longitude}], ${zoom}, {
              animate: true,
              duration: 1
            });
          }
          true;
        `;
        webViewRef.current?.injectJavaScript(script);
      },
    }));

    // Update map data dynamically whenever markers or circles change
    const updateMapDataScript = useMemo(() => {
      const dataPayload = JSON.stringify({
        markers: markersData,
        circles: circlesData,
        userLocation: showsUserLocation && initialRegion ? {
          latitude: initialRegion.latitude,
          longitude: initialRegion.longitude,
        } : null,
      });

      return `
        if (window.updateMapData) {
          window.updateMapData(${dataPayload});
        }
        true;
      `;
    }, [markersData, circlesData, showsUserLocation, initialRegion]);

    const onWebViewLoadEnd = useCallback(() => {
      webViewRef.current?.injectJavaScript(updateMapDataScript);
    }, [updateMapDataScript]);

    // Handle messages from WebView (e.g. Marker press)
    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'MARKER_PRESS' && data.id) {
          const cb = markerCallbacksRef.current[data.id];
          if (cb) {
            cb();
          }
        }
        if (data.type === 'MAP_PRESS' && onPress) {
          onPress({ nativeEvent: { coordinate: data.coordinate } });
        }
      } catch {
        // Ignored
      }
    };

    const htmlContent = useMemo(() => {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #e5e7eb; overflow: hidden; }
    .user-pulse {
      width: 18px;
      height: 18px;
      background: #3B82F6;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
      position: relative;
    }
    .user-pulse::after {
      content: '';
      position: absolute;
      top: -8px;
      left: -8px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.35);
      animation: pulse 1.8s infinite ease-out;
    }
    @keyframes pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    .custom-pin {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid #FFFFFF;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      cursor: pointer;
    }
    .custom-pin-inner {
      width: 12px;
      height: 12px;
      background: #FFFFFF;
      border-radius: 50%;
      transform: rotate(45deg);
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 6px 16px rgba(0,0,0,0.15);
      padding: 2px 4px;
    }
    .leaflet-popup-content h4 {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }
    .leaflet-popup-content p {
      margin: 0;
      font-size: 12px;
      color: #6B7280;
    }
    .leaflet-control-attribution {
      font-size: 9px !important;
      background: rgba(255,255,255,0.7) !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${initialLat}, ${initialLng}],
      zoom: ${initialZoom},
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
      maxZoom: 20
    }).addTo(map);

    var markersLayer = L.layerGroup().addTo(map);
    var circlesLayer = L.layerGroup().addTo(map);
    var userLayer = L.layerGroup().addTo(map);

    map.on('click', function(e) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MAP_PRESS',
          coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
        }));
      }
    });

    function createPinIcon(color) {
      return L.divIcon({
        className: 'leaflet-custom-marker',
        html: '<div class="custom-pin" style="background:' + color + ';"><div class="custom-pin-inner"></div></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });
    }

    var userIcon = L.divIcon({
      className: 'user-marker-icon',
      html: '<div class="user-pulse"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    window.updateMapData = function(data) {
      if (!data) return;

      markersLayer.clearLayers();
      circlesLayer.clearLayers();
      userLayer.clearLayers();

      if (data.userLocation && data.userLocation.latitude) {
        L.marker([data.userLocation.latitude, data.userLocation.longitude], { icon: userIcon }).addTo(userLayer);
      }

      if (Array.isArray(data.circles)) {
        data.circles.forEach(function(c) {
          L.circle([c.latitude, c.longitude], {
            radius: c.radius || 300,
            color: c.strokeColor || '#6366F1',
            weight: c.strokeWidth || 2,
            fillColor: c.fillColor || '#6366F1',
            fillOpacity: 0.15
          }).addTo(circlesLayer);
        });
      }

      if (Array.isArray(data.markers)) {
        data.markers.forEach(function(m) {
          var marker = L.marker([m.latitude, m.longitude], {
            icon: createPinIcon(m.pinColor || '#F97316')
          });

          if (m.title || m.description) {
            var content = '<div>';
            if (m.title) content += '<h4>' + m.title + '</h4>';
            if (m.description) content += '<p>' + m.description + '</p>';
            content += '</div>';
            marker.bindPopup(content);
          }

          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MARKER_PRESS',
                id: m.id
              }));
            }
          });

          marker.addTo(markersLayer);
        });
      }
    };

    // Initial update if data available
    window.updateMapData(${JSON.stringify({
      markers: markersData,
      circles: circlesData,
      userLocation: showsUserLocation && initialRegion ? {
        latitude: initialRegion.latitude,
        longitude: initialRegion.longitude,
      } : null,
    })});
  </script>
</body>
</html>
      `;
    }, [initialLat, initialLng, initialZoom]);

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          nestedScrollEnabled={true}
          onMessage={handleMessage}
          onLoadEnd={onWebViewLoadEnd}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          )}
          startInLoadingState={true}
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
  },
  webview: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  loadingContainer: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
});
