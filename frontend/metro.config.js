const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect native-only modules to web stubs when bundling for web
const nativeModuleStubs = {
  'react-native-maps': path.resolve(__dirname, 'shims/react-native-maps.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && nativeModuleStubs[moduleName]) {
    return { filePath: nativeModuleStubs[moduleName], type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
