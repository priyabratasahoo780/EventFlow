// Web stub for react-native-maps — native only module
const React = require('react');
const { View, Text } = require('react-native');

const MapViewStub = () =>
  React.createElement(View, { style: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f4f8' } },
    React.createElement(Text, { style: { color: '#666', fontSize: 13 } }, 'Map unavailable on web')
  );

MapViewStub.Animated = MapViewStub;

const MarkerStub = () => null;

module.exports = MapViewStub;
module.exports.default = MapViewStub;
module.exports.Marker = MarkerStub;
module.exports.Callout = () => null;
module.exports.Circle = () => null;
module.exports.Polygon = () => null;
module.exports.Polyline = () => null;
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.PROVIDER_DEFAULT = null;
