const { execSync } = require('child_process');
const fs = require('fs');

// Get committed HTML
const html = execSync('git show HEAD:index.html', { encoding: 'utf8', cwd: process.cwd() });

// Find the chart grid section
const start = html.indexOf('<div class="ht-chart-grid">');
const end = html.indexOf('<!-- Filter', start);
if (start >= 0 && end >= 0) {
  console.log(html.substring(start, end).trim());
} else {
  console.log('Section not found');
}

// Also check for any height-related CSS on chart containers in committed CSS
const css = execSync('git show HEAD:css/dashboard.css', { encoding: 'utf8', cwd: process.cwd() });
const cssLines = css.split('\n');
console.log('\n--- Committed CSS chart container rules ---');
for (let i = 0; i < cssLines.length; i++) {
  if (cssLines[i].match(/ht-chart-container|ht-chart-donut-container|ht-donut-wrapper/) && cssLines[i].includes('{')) {
    console.log('\nLine ' + (i+1) + ': ' + cssLines[i]);
    for (let j = 1; j < 8 && i+j < cssLines.length; j++) {
      if (cssLines[i+j].match(/^}/)) break;
      console.log('  ' + cssLines[i+j]);
    }
  }
}
