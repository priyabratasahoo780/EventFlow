const fs = require('fs');
const path = 'c:/Users/priyabrata/Desktop/Events/EventFlow/README.md';
let content = fs.readFileSync(path, 'utf8');

// Green check-circle icons
content = content.split(
  'https://api.iconify.design/lucide/check-circle-2.svg"'
).join(
  'https://api.iconify.design/lucide/check-circle-2.svg?color=%2322c55e"'
);

// Red x-circle icons
content = content.split(
  'https://api.iconify.design/lucide/x-circle.svg"'
).join(
  'https://api.iconify.design/lucide/x-circle.svg?color=%23ef4444"'
);

// Amber/yellow alert-triangle icons
content = content.split(
  'https://api.iconify.design/lucide/alert-triangle.svg"'
).join(
  'https://api.iconify.design/lucide/alert-triangle.svg?color=%23f59e0b"'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Done! Icon colors updated.');
