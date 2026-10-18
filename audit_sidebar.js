const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const results = {};
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  // Check key markers
  const markers = {
    hasSidebar: c.includes('ht-sidebar'),
    hasSidebarCSS: c.includes('sidebar.css'),
    hasCollapsedClass: c.includes('ht-nav-collapsible collapsed'),
    hasExpandedClass: c.includes('ht-nav-collapsible expanded'),
    hasFactoryIcon: c.includes('factory.svg'),
    hasSectionLabel: c.includes('section-label'),
    hasToggleNavSection: c.includes('toggleNavSection'),
    hasNavSection: c.includes('nav-section ht-nav-collapsible'),
    hasProductionSpan: c.includes('>Production<'),
    hasChevronDown: c.includes('chevron-down.svg'),
    hasChevronRight: c.includes('chevron-right'),
    hasDarkTheme: c.includes('navy gelap') || c.includes('#1e293b') || c.includes('#0f172a') || c.includes('var(--sidebar)'),
  };
  results[f] = markers;
}

// Print table
console.log('=== SIDEBAR AUDIT ===\n');
for (const [f, m] of Object.entries(results)) {
  const issues = [];
  if (!m.hasSidebar) issues.push('NO ht-sidebar');
  if (!m.hasSidebarCSS) issues.push('NO sidebar.css');
  if (!m.hasCollapsedClass) issues.push('missing collapsed');
  if (!m.hasFactoryIcon) issues.push('missing factory.svg');
  if (!m.hasSectionLabel) issues.push('missing section-label');
  if (!m.hasToggleNavSection) issues.push('NO toggleNavSection');
  
  let status = 'OK';
  if (issues.length > 0) status = 'ISSUE: ' + issues.join(', ');
  console.log(f.padEnd(30) + ' ' + status);
}

// Show files that differ
console.log('\n=== FILES WITH ISSUES ===\n');
for (const [f, m] of Object.entries(results)) {
  const issues = [];
  if (!m.hasSidebar) issues.push('NO ht-sidebar');
  if (!m.hasSidebarCSS) issues.push('NO sidebar.css');
  if (!m.hasCollapsedClass) issues.push('missing collapsed');
  if (!m.hasFactoryIcon) issues.push('missing factory.svg');
  if (!m.hasSectionLabel) issues.push('missing section-label');
  if (!m.hasToggleNavSection) issues.push('NO toggleNavSection');
  if (issues.length > 0) {
    console.log(f + ': ' + issues.join(', '));
  }
}
