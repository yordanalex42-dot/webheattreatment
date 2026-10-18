const fs = require("fs");
const path = require("path");

/* Memory storage for Node testing */
class MemoryStorage {
  constructor() { this.store = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; }
  setItem(key, val) { this.store[key] = String(val); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
  keys() { return Object.keys(this.store); }
}

global.localStorage = new MemoryStorage();

const dbCode = fs.readFileSync(path.join(__dirname, "js", "db.js"), "utf8").replace("const DB", "var DB");
global.DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);

/* Backup old seed data before changes */
DB.init();
const backup = {};
DB.tables.forEach((t) => {
  const data = DB.get(t);
  backup["ht_" + t] = data;
});
backup["ht_db_seed_version"] = localStorage.getItem("ht_db_seed_version");

fs.writeFileSync(
  path.join(__dirname, "ht_backup_old_seed_full.json"),
  JSON.stringify(backup, null, 2)
);
console.log("Backup created: ht_backup_old_seed_full.json");
console.log("Old seed version:", backup.ht_db_seed_version);
console.log("Old materials count:", backup.ht_materials.length);
