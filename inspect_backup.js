const fs = require('fs');
const snap = JSON.parse(fs.readFileSync('ht_snapshot_after_seed.json', 'utf8'));
const backup = JSON.parse(fs.readFileSync('ht_backup_old_seed_full.json', 'utf8'));

console.log('=== SNAPSHOT AFTER SEED ===');
Object.keys(snap).forEach(k => {
  console.log(k, ':', Array.isArray(snap[k]) ? snap[k].length : typeof snap[k]);
});

console.log('\n=== BACKUP OLD SEED FULL ===');
Object.keys(backup).forEach(k => {
  console.log(k, ':', Array.isArray(backup[k]) ? backup[k].length : typeof backup[k]);
});
