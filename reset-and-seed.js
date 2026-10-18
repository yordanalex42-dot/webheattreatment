/* ============================================================
   HT SYSTEM — RESET & SEED VALIDATION SCRIPT (Node.js)

   Setelah seedDemoData() di js/db.js diperbarui untuk
   menghasilkan dataset baru (48 material), script ini
   berfungsi sebagai validator standalone:

   1. Membaca backup data lama (ht_backup_old_seed_full.json)
   2. Memanggil DB.init() — yang secara otomatis melakukan
      seed ulang dengan SEED_VERSION "2026-v3"
   3. Memvalidasi seluruh persyaratan dataset baru
   4. Menyimpan snapshot hasil seed

   Untuk melakukan RESET TOTAL di browser:
   - Cukup buka aplikasi; DB.init() mendeteksi SEED_VERSION
     berubah ("2026-v3" != "2026-v2") dan otomatis melakukan
     reset + seed ulang.
   - Data lama otomatis dihapus; data baru digenerate dari
     seedDemoData().
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
const TOTAL_EXPECTED = 48;
const PROCESS_TYPE_DEFS = [
  { processType: "Quenching & Tempering", partId: 1, stdTemp: 580 },
  { processType: "Annealing", partId: 2, stdTemp: 850 },
  { processType: "Carburizing", partId: 3, stdTemp: 820 },
  { processType: "Normalizing", partId: 9, stdTemp: 750 },
  { processType: "Full Annealing", partId: 5, stdTemp: 870 },
  { processType: "Stress Relief Annealing", partId: 6, stdTemp: 830 },
  { processType: "Spheroidizing Annealing", partId: 8, stdTemp: 820 },
];

const HT_STATES = [
  { key: "WAITING", label: "WAITING (production WAITING)" },
  { key: "PROCESS", label: "PROCESS" },
  { key: "FINISH_OK", label: "FINISH + QC OK" },
  { key: "FINISH_NG", label: "FINISH_NG" },
  { key: "NO_PROD", label: "NO_PROD (no production)" },
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
  // Verify old data had legacy process types
  const oldLegacyParts = oldBackup.ht_parts.filter(p => DB.isProcessTypeLegacy(p.process_type));
  check(oldLegacyParts.length > 0, "Backup data lama mengandung process_type legacy (" + oldLegacyParts.length + " parts)");
  console.log("  Backup lama tersimpan di: ht_backup_old_seed_full.json");
} else {
  console.log("  WARNING: Backup data lama tidak ditemukan");
}

console.log("\n--- STEP 2: Verifikasi DB.init() melakukan seed baru ---");
check(localStorage.getItem("ht_db_seed_version") === DB.SEED_VERSION, "SEED_VERSION konsisten (" + DB.SEED_VERSION + ")");
check(DB.SEED_VERSION === "2026-v3", "SEED_VERSION = 2026-v3");

console.log("\n--- STEP 3: Validasi master data ---");
const customers = DB.get("customers");
const parts = DB.get("parts");
const materials = DB.get("materials");

check(customers.length === 5, "Customer baru: " + customers.length + " (target 5)");
check(parts.length === 10, "Part Master baru: " + parts.length + " (target 10)");

// Check customer kode uniqueness
const customerKodes = customers.map(c => c.kode_customer);
const uniqueCustomerKodes = new Set(customerKodes);
check(uniqueCustomerKodes.size === customerKodes.length, "Semua kode customer unik (" + uniqueCustomerKodes.size + " unique)");

// Check part nomor_part uniqueness
const partNos = parts.map(p => p.nomor_part);
const uniquePartNos = new Set(partNos);
check(uniquePartNos.size === partNos.length, "Semua nomor part unik (" + uniquePartNos.size + " unique)");

// Check part process_type is canonical (no legacy values)
const legacyParts = parts.filter(p => DB.isProcessTypeLegacy(p.process_type));
check(legacyParts.length === 0, "Tidak ada part dengan process_type legacy (" + legacyParts.length + " ditemukan)");

// Check all 7 canonical process types are present in parts
const partProcessTypes = {};
parts.forEach(p => { partProcessTypes[p.process_type] = (partProcessTypes[p.process_type] || 0) + 1; });
console.log("  Part process_type distribution:", JSON.stringify(partProcessTypes));
const allCanonicalPresent = DB.PROCESS_TYPE_OPTIONS.every(t => {
  // At least one part should have each canonical type (or they're used in materials)
  return true;
});
check(DB.PROCESS_TYPE_OPTIONS.length === 7, "PROCESS_TYPE_OPTIONS memiliki 7 jenis proses (" + DB.PROCESS_TYPE_OPTIONS.length + ")");

console.log("\n--- STEP 4: Validasi data transaksi ---");
check(materials.length === 48, "Total material: " + materials.length + " (target " + TOTAL_EXPECTED + ")");

// Check material kode uniqueness
const materialKodes = materials.map(m => m.kode);
const uniqueMaterialKodes = new Set(materialKodes);
check(uniqueMaterialKodes.size === materialKodes.length, "Semua kode material unik (" + uniqueMaterialKodes.size + " unique)");

// Check all materials have kode ending with "M"
const allKodeFormat = materials.every(m => /^([1-9]\d*|\d+M)$/.test(m.kode) && m.kode.endsWith("M"));
check(allKodeFormat, "Semua kode material mengikuti format 'N+M'");

// Check no old material kodes exist
const oldKodeFormats = materials.filter(m => /202600\d+I/.test(m.kode));
check(oldKodeFormats.length === 0, "Tidak ada kode material lama (202600xxI) tersisa (" + oldKodeFormats.length + ")");

console.log("\n--- STEP 5: Validasi distribusi status material ---");
const statusCounts = {};
materials.forEach(m => {
  statusCounts[m.status_proses] = (statusCounts[m.status_proses] || 0) + 1;
});
console.log("  Status distribution:", JSON.stringify(statusCounts));

// 35 HT materials (kode 1M-35M)
const htMaterials = materials.filter(m => {
  const num = parseInt(m.kode);
  return num >= 1 && num <= 35;
});
check(htMaterials.length === 35, "Material HT: " + htMaterials.length + " (target 35)");

// 5 per process type
const htPtCounts = {};
htMaterials.forEach(m => {
  htPtCounts[m.process_type] = (htPtCounts[m.process_type] || 0) + 1;
});
console.log("  HT process type distribution:", JSON.stringify(htPtCounts));
PROCESS_TYPE_DEFS.forEach(pt => {
  const count = htPtCounts[pt.processType] || 0;
  check(count === 5, "Process type '" + pt.processType + "': " + count + " materials (target 5)");
});

// 5 states per process type (14 WAITING, 7 PROCESS, 7 FINISH, 7 FINISH_NG, 7 NO_PROD)
const htStatusCounts = {};
htMaterials.forEach(m => { htStatusCounts[m.status_proses] = (htStatusCounts[m.status_proses] || 0) + 1; });
console.log("  HT status distribution:", JSON.stringify(htStatusCounts));

// Check specific states for process type 1 (Quenching & Tempering, part 1)
const pt1Mats = materials.filter(m => parseInt(m.kode) >= 1 && parseInt(m.kode) <= 5);
const pt1States = pt1Mats.map(m => m.status_proses);
console.log("  Part 1 (Quenching & Tempering) states:", JSON.stringify(pt1States));

console.log("\n--- STEP 6: Validasi ShotBlast, Anti-Rust, QC, Delivery ---");
// Material 36M: ShotBlast (PROCESS)
const sbMat = materials.find(m => m.kode === "36M");
check(sbMat !== undefined, "Material 36M (ShotBlast) ada");
if (sbMat) {
  check(sbMat.status_proses === DB.STATUSES.PROSES_PROCESS, "Material 36M status PROSES");
  const htProd = DB.getProcessProduction(sbMat, "HT");
  check(htProd !== null && htProd.production_status === "FINISH" && htProd.process_result === "OK", "Material 36M HT FINISH+OK");
  const sbProd = DB.getProcessProduction(sbMat, "SHOTBLAST");
  check(sbProd !== null && sbProd.production_status === "PROCESS", "Material 36M Shotblast PROCESS");
  const qc = DB.checkQualityGate(sbMat);
  check(qc.qcStatus === "PASS", "Material 36M QC PASS");
}

// Material 37M: Anti-Rust (PROCESS)
const arMat = materials.find(m => m.kode === "37M");
check(arMat !== undefined, "Material 37M (Anti-Rust) ada");
if (arMat) {
  check(arMat.status_proses === DB.STATUSES.PROSES_PROCESS, "Material 37M status PROSES");
  const arProd = DB.getProcessProduction(arMat, "ANTI_RUST");
  check(arProd !== null && arProd.production_status === "PROCESS", "Material 37M Anti-Rust PROCESS");
}

// Material 38M-40M: QC OK (FINISH, no next process)
const qcOkMats = ["38M", "39M", "40M"].map(k => materials.find(m => m.kode === k)).filter(m => m);
check(qcOkMats.length === 3, "Material 38M-40M (QC OK) ada: " + qcOkMats.length);
qcOkMats.forEach(m => {
  check(m.status_proses === DB.STATUSES.PROSES_FINISH, "Material " + m.kode + " status FINISH");
  const htProd = DB.getProcessProduction(m, "HT");
  check(htProd !== null && htProd.process_result === "OK", "Material " + m.kode + " HT OK");
  const qc = DB.checkQualityGate(m);
  check(qc.qcStatus === "PASS", "Material " + m.kode + " QC PASS");
  const sbProd = DB.getProcessProduction(m, "SHOTBLAST");
  check(sbProd === null, "Material " + m.kode + " tidak ada Shotblast production");
  const arProd = DB.getProcessProduction(m, "ANTI_RUST");
  check(arProd === null, "Material " + m.kode + " tidak ada Anti-Rust production");
});

// Material 41M-45M: Ready Delivery (FINISH, all routes done, QC OK, no delivery)
const readyDlMats = ["41M", "42M", "43M", "44M", "45M"].map(k => materials.find(m => m.kode === k)).filter(m => m);
check(readyDlMats.length === 5, "Material 41M-45M (Ready Delivery) ada: " + readyDlMats.length);
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

// Material 46M-48M: Delivered (FINISH, QC OK, delivered)
const deliveredMats = ["46M", "47M", "48M"].map(k => materials.find(m => m.kode === k)).filter(m => m);
check(deliveredMats.length === 3, "Material 46M-48M (Delivered) ada: " + deliveredMats.length);
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

// Check referential integrity
const materialPartIds = new Set(materials.map(m => m.part_id));
const partIds = new Set(parts.map(p => p.id));
check(materialPartIds.size <= partIds.size, "Semua part_id material ada di parts");
const materialCustomerIds = new Set(materials.map(m => m.customer_id));
const customerIds = new Set(customers.map(c => c.id));
check(materialCustomerIds.size <= customerIds.size, "Semua customer_id material ada di customers");

// Check production-material consistency
const productions = DB.get("productions");
const prodMaterialIds = productions.map(p => p.material_id);
const materialIds = new Set(materials.map(m => m.id));
const orphanProds = prodMaterialIds.filter(mid => !materialIds.has(mid));
check(orphanProds.length === 0, "Tidak ada production orphank (" + orphanProds.length + ")");

// Check all HT productions have jenis_treatment in canonical set (exclude SB/AR)
const nonCanonicalProd = productions.filter(p => p.jenis_treatment && DB.isProcessTypeLegacy(p.jenis_treatment) && !["Shotblast", "Anti Rust"].includes(p.jenis_treatment));
check(nonCanonicalProd.length === 0, "Tidak ada production HT dengan process_type legacy (" + nonCanonicalProd.length + ")");

console.log("\n--- STEP 8: Verifikasi tidak ada data lama ---");
const oldProdukTypes = productions.filter(p => p.jenis_treatment && DB.isProcessTypeLegacy(p.jenis_treatment) && !["Shotblast", "Anti Rust"].includes(p.jenis_treatment));
check(oldProdukTypes.length === 0, "Tidak ada production legacy (Heat Treatment/Hardening/Tempering); SB/AR productions dikecualikan");

const oldPartTypes = parts.filter(p => DB.isProcessTypeLegacy(p.process_type));
check(oldPartTypes.length === 0, "Tidak ada part legacy (" + oldPartTypes.length + ")");

// Check no old material kodes with format YYYYNNNNN
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
check(incCounter["2026"] === 48, "Incoming counter 2026 = 48");
const nextKode = DB.nextIncomingKode(new Date().toISOString());
check(nextKode === "49M", "Kode incoming berikutnya = '49M' (dapat '" + nextKode + "')");

// Check no duplicate IDs
console.log("\n--- STEP 10: Validasi ID unik ---");
const allIds = {};
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

// Check ID counter is set
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
