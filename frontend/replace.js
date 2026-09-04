const fs = require('fs');

const replacements = [
  { file: 'store/useEventStore.ts', path: '../mock-expo-notifications' },
  { file: 'services/notificationService.ts', path: '../mock-expo-notifications' },
  { file: 'services/geofencingService.ts', path: '../mock-expo-notifications' },
  { file: 'hooks/useLocation.ts', path: '../mock-expo-notifications' },
  { file: 'app/_layout.tsx', path: '../mock-expo-notifications' },
  { file: 'app/(tabs)/settings.tsx', path: '../../mock-expo-notifications' },
  { file: 'app/(tabs)/index.tsx', path: '../../mock-expo-notifications' }
];

replacements.forEach(({ file, path }) => {
  const fullPath = __dirname + '/' + file;
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/['"]expo-notifications['"]/g, `'${path}'`);
    fs.writeFileSync(fullPath, content);
    console.log(`Replaced in ${file}`);
  }
});
