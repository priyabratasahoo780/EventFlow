const fs = require('fs');

const replacements = [
  { file: 'services/alarmSoundService.ts', path: '../mock-expo-av' },
  { file: 'components/MediaPicker.tsx', path: '../mock-expo-av' },
];

replacements.forEach(({ file, path }) => {
  const fullPath = __dirname + '/' + file;
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/['"]expo-av['"]/g, `'${path}'`);
    fs.writeFileSync(fullPath, content);
    console.log(`Replaced in ${file}`);
  }
});
