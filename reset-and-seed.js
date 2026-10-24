/* ============================================================
   HT SYSTEM — RESET & SEED VALIDATION SCRIPT (Node.js)

   Setelah seedDemoData() di js/db.js diperbarui untuk
   menghasilkan dataset baru (100 material), script ini
   berfungsi sebagai validator standalone:

   1. Membaca backup data lama (ht_backup_old_seed_full.json)
   2. Memanggil DB.init() — yang secara otomatis melakukan
      seed ulang dengan SEED_VERSION "2026-v4"
   3. Memvalidasi seluruh persyaratan dataset baru
   4. Menyimpan snapshot hasil seed

   Untuk melakukan RESET TOTAL di browser:
   - Cukup buka aplikasi; DB.init() mendeteksi SEED_VERSION
     berubah ("2026-v4" != "2026-v2") dan otomatis melakukan
     reset + seed ulang.
   - Data lama otomatis dihapus; data baru digenerate dari
     seedData().
   ============================================================ */

const fs = require("fs");
const path = require("path");

class MemoryStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  keys() {
    return Object.keys(this.store);
  }
}

global.localStorage = new MemoryStorage();

const authCode = fs
  .readFileSync(path.join(__dirname, "js", "auth.js"), "utf8")
  .replace("const Auth", "var Auth");
const dbCode = fs
  .readFileSync(path.join(__dirname, "js", "db.js"), "utf8")
  .replace("const DB", "var DB");

global.Auth = new Function("localStorage", authCode + "\n; return Auth;")(
  global.localStorage,
);
global.DB = new Function("localStorage", dbCode + "\n; return DB;")(
  global.localStorage,
);

DB.init();
Auth.initDefaultUser();

// ====================================================================
// CONFIGURATION
// ====================================================================
const TOTAL_EXPECTED = 100;
const PROCESS_TYPE_DEFS = [
  { processType: "Quenching & Tempering", partId: 1, stdTemp: 580 },
  { processType: "Annealing", partId: 2, stdTemp: 850 },
  { processType: "Carburizing", partId: 3, stdTemp: 820 },
  { processType: "Normalizing", partId: 9, stdTemp: 750 },
  { processType: "Full Annealing", partId: 5, stdTemp: 870 },
  { processType: "Stress Relief Annealing", partId: 6, stdTemp: 830 },
  { processType: "Spheroidizing Annealing", partId: 8, stdTemp: 820 },
];

const passed = [];
const failed = [];

function check(condition, label) {
  if (condition) {
    passed.push(label);
    console.log("  [PASS] " + label);
  } else {
    failed.push(label);
    console.log("  [FAIL] " + label);
  }
}

// ====================================================================
// STEP 1: Verify old data backup exists
// ====================================================================
console.log("==========================================");
console.log("  HT SYSTEM — RESET & SEED VALIDATION");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================\n");

console.log("--- STEP 1: Verifikasi backup data lama ---");
const oldBackupPath = path.join(__dirname, "ht_backup_old_seed_full.json");
if (fs.existsSync(oldBackupPath)) {
  const oldBackup = JSON.parse(fs.readFileSync(oldBackupPath, "utf8"));
  check(oldBackup.ht_customers && oldBackup.ht_customers.length === 5, "Backup data lama customers tersedia (5 customers)");
  check(oldBackup.ht_parts && oldBackup.ht_parts.length === 10, "Backup data lama parts tersedia (10 parts)");
  check(oldBackup.ht_materials && oldBackup.ht_materials.length === 10, "Backup data lama materials tersedia (10 materials)");
  const oldLegacyParts = oldBackup.ht_parts.filter(p => DB.isProcessTypeLegacy(p.process_type));
  check(oldLegacyParts.length > 0, "Backup data lama mengandung process_type legacy (" + oldLegacyParts.length + " parts)");
  console.log("  Backup lama tersimpan di: ht_backup_old_seed_full.json");
} else {
  console.log("  WARNING: Backup data lama tidak ditemukan");
}

console.log("\n--- STEP 2: Verifikasi DB.init() melakukan seed baru ---");
check(localStorage.getItem("ht_db_seed_version") === DB.SEED_VERSION, "SEED_VERSION konsisten (" + DB.SEED_VERSION + ")");
check(DB.SEED_VERSION === "2026-v4", "SEED_VERSION = 2026-v4");

console.log("\n--- STEP 3: Validasi master data ---");
const customers = DB.get("customers");
const parts = DB.get("parts");
const materials = DB.get("materials");

check(customers.length === 10, "Customer baru: " + customers.length + " (target 10)");
check(parts.length === 30, "Part Master baru: " + parts.length + " (target 30)");

const customerKodes = customers.map(c => c.kode_customer);
const uniqueCustomerKodes = new Set(customerKodes);
check(uniqueCustomerKodes.size === customerKodes.length, "Semua kode customer unik (" + uniqueCustomerKodes.size + " unique)");

const partNos = parts.map(p => p.nomor_part);
const uniquePartNos = new Set(partNos);
check(uniquePartNos.size === partNos.length, "Semua nomor part unik (" + uniquePartNos.size + " unique)");

const legacyParts = parts.filter(p => DB.isProcessTypeLegacy(p.process_type));
check(legacyParts.length === 0, "Tidak ada part dengan process_type legacy (" + legacyParts.length + " ditemukan)");

const partProcessTypes = {};
parts.forEach(p => { partProcessTypes[p.process_type] = (partProcessTypes[p.process_type] || 0) + 1; });
console.log("  Part process_type distribution:", JSON.stringify(partProcessTypes));
check(DB.PROCESS_TYPE_OPTIONS.length === 7, "PROCESS_TYPE_OPTIONS memiliki 7 jenis proses (" + DB.PROCESS_TYPE_OPTIONS.length + ")");

console.log("\n--- STEP 4: Validasi data transaksi ---");
check(materials.length === 100, "Total material: " + materials.length + " (target " + TOTAL_EXPECTED + ")");

const materialKodes = materials.map(m => m.kode);
const uniqueMaterialKodes = new Set(materialKodes);
check(uniqueMaterialKodes.size === materialKodes.length, "Semua kode material unik (" + uniqueMaterialKodes.size + " unique)");

const allKodeFormat = materials.every(m => /^\d+M$/.test(m.kode));
check(allKodeFormat, "Semua kode material mengikuti format 'N+M'");

const oldKodeFormats = materials.filter(m => /202600\d+I/.test(m.kode));
check(oldKodeFormats.length === 0, "Tidak ada kode material lama (202600xxI) tersisa (" + oldKodeFormats.length + ")");

console.log("\n--- STEP 5: Validasi distribusi status material ---");
const statusCounts = {};
materials.forEach(m => {
  statusCounts[m.status_proses] = (statusCounts[m.status_proses] || 0) + 1;
});
console.log("  Status distribution:", JSON.stringify(statusCounts));

const htMaterials = materials.filter(m => {
  const num = parseInt(m.kode);
  return num >= 1 && num <= 70;
});
check(htMaterials.length === 70, "Material HT: " + htMaterials.length + " (target 70)");

const htPtCounts = {};
htMaterials.forEach(m => {
  htPtCounts[m.process_type] = (htPtCounts[m.process_type] || 0) + 1;
});
console.log("  HT process type distribution:", JSON.stringify(htPtCounts));
PROCESS_TYPE_DEFS.forEach(pt => {
  const count = htPtCounts[pt.processType] || 0;
  check(count === 10, "Process type '" + pt.processType + "': " + count + " materials (target 10)");
});

console.log("\n--- STEP 6: Validasi ShotBlast, Anti-Rust, QC, Delivery ---");

// Material 71M: Ready for ShotBlast (HT done, QC PASS, no SB production)
const readyMat = materials.find(m => m.kode === "71M");
check(readyMat !== undefined, "Material 71M (Ready for ShotBlast) ada");
if (readyMat) {
  check(readyMat.process_route.shotblast === true, "Material 71M route has shotblast=true");
  const htProd = DB.getProcessProduction(readyMat, "HT");
  check(htProd !== null && htProd.production_status === "FINISH" && htProd.process_result === "OK", "Material 71M HT FINISH+OK");
  const sbProd = DB.getProcessProduction(readyMat, "SHOTBLAST");
  check(sbProd === null, "Material 71M no Shotblast production yet (ready for ShotBlast)");
  const qc = DB.checkQualityGate(readyMat);
  check(qc.qcStatus === "PASS", "Material 71M QC PASS");
}

// Material 76M: ShotBlast PROCESS
const sbMat = materials.find(m => m.kode === "76M");
check(sbMat !== undefined, "Material 76M (ShotBlast PROCESS) ada");
if (sbMat) {
  check(sbMat.status_proses === DB.STATUSES.PROSES_PROCESS, "Material 76M status PROSES");
  const htProd = DB.getProcessProduction(sbMat, "HT");
  check(htProd !== null && htProd.production_status === "FINISH" && htProd.process_result === "OK", "Material 76M HT FINISH+OK");
  const sbProd = DB.getProcessProduction(sbMat, "SHOTBLAST");
  check(sbProd !== null && sbProd.production_status === "PROCESS", "Material 76M Shotblast PROCESS");
  const qc = DB.checkQualityGate(sbMat);
  check(qc.qcStatus === "PASS", "Material 76M QC PASS");
}

// Material 81M: Anti-Rust PROCESS
const arMat = materials.find(m => m.kode === "81M");
check(arMat !== undefined, "Material 81M (Anti-Rust PROCESS) ada");
if (arMat) {
  check(arMat.status_proses === DB.STATUSES.PROSES_PROCESS, "Material 81M status PROSES");
  const arProd = DB.getProcessProduction(arMat, "ANTI_RUST");
  check(arProd !== null && arProd.production_status === "PROCESS", "Material 81M Anti-Rust PROCESS");
}

// Material 91M-95M: Ready Delivery (FINISH, all routes done, QC OK, no delivery)
const readyDlMats = ["91M", "92M", "93M", "94M", "95M"].map(k => materials.find(m => m.kode === k)).filter(m => m);
check(readyDlMats.length === 5, "Material 91M-95M (Ready Delivery) ada: " + readyDlMats.length);
readyDlMats.forEach(m => {
  check(m.status_proses === DB.STATUSES.PROSES_FINISH, "Material " + m.kode + " status FINISH");
  const htProd = DB.getProcessProduction(m, "HT");
  check(htProd !== null && htProd.process_result === "OK", "Material " + m.kode + " HT OK");
  const qc = DB.checkQualityGate(m);
  check(qc.qcStatus === "PASS", "Material " + m.kode + " QC PASS");
  const canDeliver = DB.canDeliver(m);
  check(canDeliver.allowed === true, "Material " + m.kode + " bisa delivery");
  const hasDelivery = DB.get("deliveries").some(d => d.material_id === m.id);
  check(!hasDelivery, "Material " + m.kode + " belum ada delivery");
});

// Material 96M-100M: Delivered (FINISH, QC OK, delivered)
const deliveredMats = ["96M", "97M", "98M", "99M", "100M"].map(k => materials.find(m => m.kode === k)).filter(m => m);
check(deliveredMats.length === 5, "Material 96M-100M (Delivered) ada: " + deliveredMats.length);
deliveredMats.forEach(m => {
  const htProd = DB.getProcessProduction(m, "HT");
  check(htProd !== null && htProd.process_result === "OK", "Material " + m.kode + " HT OK");
  const qc = DB.checkQualityGate(m);
  check(qc.qcStatus === "PASS", "Material " + m.kode + " QC PASS");
  const del = DB.get("deliveries").find(d => d.material_id === m.id);
  check(del !== undefined, "Material " + m.kode + " ada delivery record");
  if (del) {
    check(del.status === "Delivered", "Material " + m.kode + " delivery status Delivered");
    const tracking = DB.get("tracking").find(t => t.material_id === m.id);
    check(tracking !== undefined, "Material " + m.kode + " ada tracking");
    if (tracking) {
      check(tracking.delivery_id === del.id, "Material " + m.kode + " tracking delivery_id konsisten");
    }
  }
});

console.log("\n--- STEP 7: Validasi relasi data ---");
const validation = DB.validate();
check(validation.errors.length === 0, "DB.validate() tidak ada errors (" + validation.errors.length + ")");
check(validation.warnings.length === 0, "DB.validate() tidak ada warnings (" + validation.warnings.length + ")");

const materialPartIds = new Set(materials.map(m => m.part_id));
const partIds = new Set(parts.map(p => p.id));
check(materialPartIds.size <= partIds.size, "Semua part_id material ada di parts");
const materialCustomerIds = new Set(materials.map(m => m.customer_id));
const customerIds = new Set(customers.map(c => c.id));
check(materialCustomerIds.size <= customerIds.size, "Semua customer_id material ada di customers");

const productions = DB.get("productions");
const prodMaterialIds = productions.map(p => p.material_id);
const materialIds = new Set(materials.map(m => m.id));
const orphanProds = prodMaterialIds.filter(mid => !materialIds.has(mid));
check(orphanProds.length === 0, "Tidak ada production orphank (" + orphanProds.length + ")");

const nonCanonicalProd = productions.filter(p => p.jenis_treatment && DB.isProcessTypeLegacy(p.jenis_treatment) && !["Shotblast", "Anti Rust"].includes(p.jenis_treatment));
check(nonCanonicalProd.length === 0, "Tidak ada production HT dengan process_type legacy (" + nonCanonicalProd.length + ")");

console.log("\n--- STEP 8: Verifikasi tidak ada data lama ---");
const oldProdukTypes = productions.filter(p => p.jenis_treatment && DB.isProcessTypeLegacy(p.jenis_treatment) && !["Shotblast", "Anti Rust"].includes(p.jenis_treatment));
check(oldProdukTypes.length === 0, "Tidak ada production legacy (Heat Treatment/Hardening/Tempering); SB/AR productions dikecualikan");

const oldPartTypes = parts.filter(p => DB.isProcessTypeLegacy(p.process_type));
check(oldPartTypes.length === 0, "Tidak ada part legacy (" + oldPartTypes.length + ")");

const oldKodePattern = materials.filter(m => /^\d{8}I$/.test(m.kode));
check(oldKodePattern.length === 0, "Tidak ada kode material lama format 202600xxI");

const legacyReport = DB.getLegacyProcessTypeReport();
const legacyHtItems = legacyReport.filter(r => !["Shotblast", "Anti Rust"].includes(r.value));
check(legacyHtItems.length === 0, "getLegacyProcessTypeReport tidak ada item HT legacy (SB/AR production dikecualikan): " + legacyHtItems.length);
check(legacyReport.filter(r => r.table === "parts").length === 0, "getLegacyProcessTypeReport: tidak ada part legacy");

// Check incoming kode counter
console.log("\n--- STEP 9: Validasi incoming kode counter ---");
const incCounter = JSON.parse(localStorage.getItem("ht_incoming_kode_counter") || "{}");
console.log("  Incoming counter:", JSON.stringify(incCounter));
check(incCounter["2026"] === 100, "Incoming counter 2026 = 100");
const nextKode = DB.nextIncomingKode(new Date().toISOString());
check(nextKode === "101M", "Kode incoming berikutnya = '101M' (dapat '" + nextKode + "')");

// Check no duplicate IDs
console.log("\n--- STEP 10: Validasi ID unik ---");
let dupFound = false;
DB.tables.forEach(t => {
  const data = DB.get(t);
  const ids = data.map(r => r.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    dupFound = true;
    console.log("  DUPLICATE in " + t + ": " + (ids.length - uniqueIds.size));
  }
});
check(!dupFound, "Tidak ada duplicate ID di semua tabel");

const idCounter = localStorage.getItem("ht_id_counter");
check(idCounter !== null, "ht_id_counter ter-set setelah seed");

// ====================================================================
// STEP 11: Save snapshot
// ====================================================================
console.log("\n--- STEP 11: Save snapshot ---");
const snapshot = {};
DB.tables.forEach((t) => {
  snapshot["ht_" + t] = DB.get(t);
});
snapshot["ht_id_counter"] = localStorage.getItem("ht_id_counter");
snapshot["ht_incoming_kode_counter"] = localStorage.getItem("ht_incoming_kode_counter");
snapshot["ht_db_seed_version"] = DB.SEED_VERSION;
snapshot["_seed_note"] = "[DEMO DATA] — Data ini adalah dataset demonstrasi. Jangan dianggap sebagai standar operasional perusahaan. Temperatur dan nilai lainnya hanyalah contoh untuk pengujian.";
fs.writeFileSync(
  path.join(__dirname, "ht_snapshot_after_seed.json"),
  JSON.stringify(snapshot, null, 2),
);
console.log("  Snapshot saved to ht_snapshot_after_seed.json");

// ====================================================================
// SUMMARY
// ====================================================================
console.log("\n==========================================");
console.log("  VALIDATION SUMMARY");
console.log("  Total checks: " + (passed.length + failed.length));
console.log("  Passed: " + passed.length);
console.log("  Failed: " + failed.length);
console.log("==========================================");

if (failed.length > 0) {
  console.log("\n  FAILED CHECKS:");
  failed.forEach(f => console.log("    ✗ " + f));
  process.exit(1);
} else {
  console.log("\n  ALL CHECKS PASSED ✓");
}
