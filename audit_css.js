const fs = require('fs');
const css = fs.readFileSync('css/dashboard.css', 'utf8');
const lines = css.split('\n');

const selectors = [
  '.ht-chart-grid',
  '.ht-chart-grid .ht-card',
  '.ht-chart-grid .ht-card-title',
  '.ht-chart-grid .ht-card-subtitle',
  '.ht-chart-container',
  '.ht-chart-donut-container',
  '.ht-donut-wrapper',
  '.ht-donut-legend',
  '.ht-chart-empty',
  '.ht-chart-controls',
  '.ht-chart-grid .ht-card-header-with-actions',
];

console.log('=== Full selector analysis ===\n');

for (const selector of selectors) {
  // Find all occurrences of this selector
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(new RegExp(selector.replace(/\./g, '\\.').replace(/\{/g, '\\{')))) {
      const isMedia = lines.slice(Math.max(0, i - 50), i).some(l => l.match(/@media/));
      console.log(`Line ${i + 1} [${isMedia ? 'media' : 'base'}]: ${lines[i].trim()}`);
      for (let j = 1; j < 8 && i + j < lines.length; j++) {
        if (lines[i + j].match(/^}/)) break;
        const trimmed = lines[i + j].trim();
        if (trimmed) console.log(`  ${trimmed}`);
      }
      console.log('');
    }
  }
}
