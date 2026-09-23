/**
 * babel.config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Expo Babel config with module-resolver for clean path aliases.
 * Uses @/* → ./src/* so imports look like: import Foo from '@/components/ui/Foo'
 */
module.exports = function (api) {
  api.cache(true);
  const plugins = [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src',
          '@/components': './src/components',
          '@/constants':  './src/constants',
          '@/hooks':      './src/hooks',
          '@/lib':        './src/lib',
          '@/services':   './src/services',
          '@/store':      './src/store',
          '@/types':      './src/types',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
    ],
    'react-native-reanimated/plugin',
  ];

  // Strip console.log statements in production build to avoid memory leaks
  if (api.env('production')) {
    plugins.push('transform-remove-console');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins: plugins,
  };
};
