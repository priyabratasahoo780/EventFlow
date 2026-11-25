/**
 * babel.config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Expo Babel config with module-resolver for clean root path aliases.
 */
module.exports = function (api) {
  api.cache(true);
  const plugins = [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': '.',
          '@/components': './components',
          '@/constants': './constants',
          '@/hooks': './hooks',
          '@/models': './models',
          '@/services': './services',
          '@/store': './store',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
    ],
    'react-native-reanimated/plugin',
  ];

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    plugins.push('transform-remove-console');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins: plugins,
  };
};
