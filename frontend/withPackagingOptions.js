const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withPackagingOptions(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let buildGradle = config.modResults.contents;
      
      // Check if packagingOptions already exists
      if (buildGradle.includes('packagingOptions {')) {
        // Append pickFirsts inside the existing block
        buildGradle = buildGradle.replace(
          /packagingOptions\s*\{/,
          `packagingOptions {\n        pickFirst "META-INF/versions/9/OSGI-INF/MANIFEST.MF"\n        pickFirst "META-INF/MANIFEST.MF"\n        pickFirst "META-INF/*"\n        pickFirst "META-INF/**/*"\n        pickFirst "**/*.MF"\n`
        );
      } else {
        // Create the packagingOptions block
        const androidBlockEnd = buildGradle.lastIndexOf('}');
        const packagingBlock = `
    packagingOptions {
        pickFirst "META-INF/versions/9/OSGI-INF/MANIFEST.MF"
        pickFirst "META-INF/MANIFEST.MF"
        pickFirst "META-INF/*"
        pickFirst "META-INF/**/*"
        pickFirst "**/*.MF"
    }
`;
        buildGradle = buildGradle.replace(
          /android\s*\{/,
          `android {${packagingBlock}`
        );
      }
      
      config.modResults.contents = buildGradle;
    }
    return config;
  });
};
