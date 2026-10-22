const fs = require('fs');
const css = fs.readFileSync(process.env.TEMP + '\\committed.css', 'utf8');
const lines = css.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/ht-chart-container|ht-chart-donut-container|ht-donut-wrapper/) && lines[i].includes('{')) {
    console.log((i + 1) + ': ' + lines[i].trim());
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      if (lines[j].match(/^}/)) {
        console.log((j + 1) + ': ' + lines[j].trim());
        break;
      }
      if (lines[j].match(/height|width|padding|min-height|margin|display|align-|justify-/)) {
        console.log((j + 1) + ':   ' + lines[j].trim());
      }
    }
  }
}
