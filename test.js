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
}

let Auth, DB;

function setupFresh() {
  global.localStorage = new MemoryStorage();
  const authCode = fs
    .readFileSync(path.join(__dirname, "js", "auth.js"), "utf8")
    .replace("const Auth", "var Auth");
  const dbCode = fs
    .readFileSync(path.join(__dirname, "js", "db.js"), "utf8")
    .replace("const DB", "var DB");
  Auth = new Function("localStorage", authCode + "\n; return Auth;")(
    global.localStorage,
  );
  DB = new Function("localStorage", dbCode + "\n; return DB;")(
    global.localStorage,
  );
  DB.init();
  Auth.initDefaultUser();
}

setupFresh();
if (!Auth || !DB) {
  console.error("Init failed");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, detail) {
  if (condition) {
    passed++;
    results.push({ pass: true, name: testName, detail: detail || "" });
  } else {
    failed++;
    results.push({ pass: false, name: testName, detail: detail || "" });
  }
}

console.log("==========================================");
console.log("  HT SYSTEM - TESTS");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================\n");

console.log("=== GROUP 1: DB INIT & TABLE CREATION (Tests 1-3) ===");
setupFresh();
assert(
  DB.tables.includes("customers"),
  "T1: DB has customers table",
  "tables: " + JSON.stringify(DB.tables),
);
assert(DB.tables.includes("parts"), "T2: DB has parts table", "");
assert(DB.tables.includes("materials"), "T3: DB has materials table", "");

console.log("\n=== GROUP 2: DB MIGRATION (Tests 4-14) ===");
setupFresh();
const prodBefore = DB.get("productions");
prodBefore[0].__oldField = "should_be_removed";
localStorage.setItem("ht_productions", JSON.stringify(prodBefore));
DB.migrate();
const prodAfter = DB.get("productions");
assert(
  !("__oldField" in prodAfter[0]),
  "T4: migrate preserves only valid fields",
  "",
);
assert(
  "production_status" in prodAfter[0],
  "T5: migrate adds production_status",
  "",
);
assert("tracking_id" in prodAfter[0], "T6: migrate adds tracking_id", "");
assert("incoming_id" in prodAfter[0], "T7: migrate adds incoming_id", "");
assert(
  "visual_check_result" in prodAfter[0],
  "T8: migrate adds visual_check_result",
  "",
);
assert(
  "visual_check_note" in prodAfter[0],
  "T9: migrate adds visual_check_note",
  "",
);
assert(
  "machine_start_at" in prodAfter[0],
  "T10: migrate adds machine_start_at",
  "",
);
assert(
  "process_result" in prodAfter[0],
  "T11: migrate adds process_result",
  "",
);
assert(
  "process_ng_note" in prodAfter[0],
  "T12: migrate adds process_ng_note",
  "",
);
assert(
  prodAfter[0].status === "FINISH" ||
    prodAfter[0].status === "PROCESS" ||
    prodAfter[0].status === "WAITING",
  "T13: migrate normalizes status to canonical value",
  "status=" + prodAfter[0].status,
);
assert(
  prodAfter[5].machine_finish_at === "",
  "T14: migrate empty default for machine_finish_at (PROCESS production)",
  "val=" + JSON.stringify(prodAfter[5].machine_finish_at),
);

console.log("\n=== GROUP 3: FIND METHODS (Tests 15-22) ===");
setupFresh();
const m1001 = DB.findMaterial(1001);
assert(
  m1001 !== undefined && m1001 !== null,
  "T15: findMaterial finds by numeric id",
  "Found: " + (m1001 ? m1001.kode : "null"),
);
const mKode = DB.findMaterial("20260001I");
assert(
  mKode !== undefined && mKode !== null,
  "T16: findMaterial finds by kode",
  "Found: " + (mKode ? mKode.kode : "null"),
);
const mByIdStr = DB.findMaterial("1001");
assert(
  mByIdStr !== undefined && mByIdStr !== null,
  "T17: findMaterial finds by string id",
  "",
);
const t1 = DB.findByKode("20260001I");
assert(
  t1 !== undefined && t1 !== null,
  "T18: findByKode finds valid Kode",
  "Found: " + (t1 ? t1.kode : "null"),
);
const t2 = DB.findByKode("NOT-FOUND");
assert(
  t2 === undefined || t2 === null,
  "T19: findByKode returns null for invalid Kode",
  "",
);
const c1 = DB.findCustomerById(1);
assert(
  c1 !== undefined && c1 !== null && c1.nama_customer === "PT Toyota Motor Manufacturing Indonesia",
  "T20: findCustomerById finds customer",
  "Name: " + (c1 ? c1.nama_customer : "null"),
);
const p1 = DB.findPartById(1);
assert(
  p1 !== undefined && p1 !== null && p1.nomor_part === "HT-2026-001",
  "T21: findPartById finds part",
  "Part: " + (p1 ? p1.nomor_part : "null"),
);
const emptyArr = DB.get("nonexistent");
assert(
  Array.isArray(emptyArr) && emptyArr.length === 0,
  "T22: get returns empty array for missing table",
  "",
);

console.log("\n=== GROUP 4: AUTH METHODS (Tests 23-26) ===");
setupFresh();
assert(
  Auth.getSession() === null,
  "T23: getSession returns null when not logged in",
  "",
);
assert(
  Auth.isLoggedIn() === false,
  "T24: isLoggedIn returns false when not logged in",
  "",
);
Auth.login("admin", "admin123");
const ses = Auth.getSession();
assert(
  ses !== null && ses.username === "admin",
  "T25: login works with valid credentials",
  "User: " + (ses ? ses.name : "null"),
);
assert(
  Auth.isLoggedIn() === true,
  "T26: isLoggedIn returns true after login",
  "",
);
Auth.logout();

console.log("\n=== GROUP 5: PRODUKSI MASUK LOGIC (Tests 27-33) ===");
setupFresh();
const mat = DB.findByKode("20260001I");
assert(
  mat !== null,
  "T27: Material found by Kode for produksi-masuk",
  "Found: " + (mat ? mat.kode : "null"),
);
const part = DB.findPartById(mat.part_id);
assert(
  part !== null && part.nomor_part === "HT-2026-001",
  "T28: Part data correct for material",
  "Part: " + part.nomor_part,
);
const cust = DB.findCustomerById(mat.customer_id);
assert(
  cust !== null && cust.nama_customer === "PT Toyota Motor Manufacturing Indonesia",
  "T29: Customer data correct",
  "Cust: " + cust.nama_customer,
);
const prod1 = DB.get("productions").find((p) => p.material_id == mat.id);
assert(
  prod1 !== undefined && prod1.status === "FINISH",
  "T30: Existing production record found (FINISH)",
  "Status: " + prod1.status,
);
assert(
  prod1.visual_check_result === "OK",
  "T31: Visual check result is OK",
  "Result: " + prod1.visual_check_result,
);
assert(
  prod1.production_status === "FINISH",
  "T32: Production status is FINISH",
  "Status: " + prod1.production_status,
);
assert(
  mat.status_proses === "WAITING",
  "T33: Material status_proses is WAITING",
  "Status: " + mat.status_proses,
);

console.log("\n=== GROUP 6: PRODUKSI AKHIR LOGIC (Tests 34-39) ===");
setupFresh();
const mat2 = DB.findByKode("20260006I");
assert(
  mat2 !== null,
  "T34: Material found for produksi-akhir (in Process)",
  "Found: " + (mat2 ? mat2.kode : "null"),
);
const prod2 = DB.get("productions").find((p) => p.material_id == mat2.id);
assert(
  prod2 !== undefined && prod2.status === "PROCESS",
  "T35: Production in PROCESS state",
  "Status: " + prod2.status,
);
assert(
  prod2.production_status === "PROCESS",
  "T36: Production status is PROCESS",
  "Status: " + prod2.production_status,
);
assert(
  prod2.start_scan_at !== "",
  "T37: start_scan_at set for PROCESS",
  'Val: "' + prod2.start_scan_at + '"',
);
assert(
  prod2.visual_check_result === "OK",
  "T38: visual_check_result OK for PROCESS",
  'Val: "' + prod2.visual_check_result + '"',
);
const mat3 = DB.findByKode("20260007I");
const prod3 = DB.get("productions").find((p) => p.material_id == mat3.id);
assert(
  prod3 !== undefined && prod3.status === "WAITING",
  "T39: Production in WAITING state",
  "Status: " + prod3.status,
);

console.log("\n=== GROUP 7: INTEGRATION & FLOW (Tests 40-44) ===");
setupFresh();
const allProds = DB.get("productions");
const finishedProds = allProds.filter((p) => p.production_status === "FINISH");
assert(
  finishedProds.length >= 2,
  "T40: At least 2 FINISH production records",
  "Count: " + finishedProds.length,
);
const processProds = allProds.filter((p) => p.production_status === "PROCESS");
assert(
  processProds.length >= 1,
  "T41: At least 1 PROCESS production record",
  "Count: " + processProds.length,
);
const waitingProds = allProds.filter((p) => p.production_status === "WAITING");
assert(
  waitingProds.length >= 1,
  "T42: At least 1 WAITING production record",
  "Count: " + waitingProds.length,
);
const allMats = DB.get("materials");
const waitingMats = allMats.filter((m) => m.status_proses === "WAITING");
assert(
  waitingMats.length >= 2,
  "T43: At least 2 materials with WAITING status",
  "Count: " + waitingMats.length,
);
const hasAllFields = allProds.every((p) => {
  const reqFields = [
    "material_id",
    "tracking_id",
    "incoming_id",
    "status",
    "production_status",
    "start_scan_at",
    "start_scan_by",
    "visual_check_result",
    "visual_check_note",
    "machine_start_at",
    "machine_start_by",
    "finish_scan_at",
    "finish_scan_by",
    "process_result",
    "process_ng_note",
    "machine_finish_at",
    "machine_finish_by",
    "tanggal_proses",
    "jenis_treatment",
  ];
  return reqFields.every((f) => f in p);
});
assert(
  hasAllFields,
  "T44: All production records have required fields after migrate",
  "",
);

console.log("\n=== GROUP 8: VALIDATE & ID GENERATION (Tests 45-55) ===");
setupFresh();
const validation = DB.validate();
assert(
  validation.errors.length === 0,
  "T45: validate() reports no errors for clean seed data",
  "errors=" + JSON.stringify(validation.errors),
);
assert(
  validation.warnings.length === 0,
  "T46: validate() reports no warnings for clean seed data",
  "warnings=" + JSON.stringify(validation.warnings),
);
const idsBefore = [];
const r = DB.insert("customers", {
  kode_customer: "CUST-TEST",
  nama_customer: "Test Customer",
  alamat: "Test",
  pic: "Test",
  phone: "0",
  email: "test@test.com",
  status: DB.STATUSES.ACTIVE,
});
const r2 = DB.insert("customers", {
  kode_customer: "CUST-TEST2",
  nama_customer: "Test Customer 2",
  alamat: "Test",
  pic: "Test",
  phone: "0",
  email: "test2@test.com",
  status: DB.STATUSES.ACTIVE,
});
assert(r.id !== r2.id && typeof r.id === "number", "T47: _nextId() generates unique IDs", "ids=" + r.id + "," + r2.id);
assert(
  DB.find("customers", "kode_customer", "CUST-TEST") !== undefined,
  "T48: INSERT creates a findable record",
  "",
);
DB.update("customers", r.id, { nama_customer: "Updated Name" });
const updated = DB.find("customers", "id", r.id);
assert(updated.nama_customer === "Updated Name", "T49: UPDATE modifies record", "name=" + updated.nama_customer);
DB.delete("customers", r.id);
DB.delete("customers", r2.id);
assert(
  DB.find("customers", "kode_customer", "CUST-TEST") === undefined &&
    DB.find("customers", "kode_customer", "CUST-TEST2") === undefined,
  "T50: DELETE removes records",
  "",
);
const validationAfter = DB.validate();
assert(
  validationAfter.errors.length === 0,
  "T51: validate() still clean after CRUD operations",
  "errors=" + JSON.stringify(validationAfter.errors),
);

console.log("\n=== GROUP 9: STATUS NORMALIZATION (Tests 56-61) ===");
setupFresh();
DB.migrate();
const matsAfterMigrate = DB.get("materials");
assert(
  matsAfterMigrate.every(m => ["WAITING", "PROCESS", "FINISH"].includes(m.status_proses)),
  "T56: All material status_proses are canonical after migrate",
  "values=" + JSON.stringify([...new Set(matsAfterMigrate.map(m => m.status_proses))]),
);
const prodsAfterMigrate = DB.get("productions");
assert(
  prodsAfterMigrate.every(p => p.status === p.production_status),
  "T57: production status and production_status are in sync",
  "",
);
assert(
  prodsAfterMigrate.every(p => ["WAITING", "PROCESS", "FINISH", "FINISH_NG"].includes(p.status)),
  "T58: All production statuses are canonical after migrate",
  "values=" + JSON.stringify([...new Set(prodsAfterMigrate.map(p => p.status))]),
);
const qcsAfterMigrate = DB.get("qcs");
assert(
  qcsAfterMigrate.every(q => q.hasil === "OK" || q.hasil === "NG"),
  "T59: All QC hasil are canonical (OK/NG) after migrate",
  "values=" + JSON.stringify([...new Set(qcsAfterMigrate.map(q => q.hasil))]),
);
const delsAfterMigrate = DB.get("deliveries");
assert(
  delsAfterMigrate.every(d => d.status === "Delivered"),
  "T60: All delivery statuses are canonical after migrate",
  "values=" + JSON.stringify([...new Set(delsAfterMigrate.map(d => d.status))]),
);

console.log("\n=== GROUP 10: REFERENTIAL INTEGRITY (Tests 62-64) ===");
setupFresh();
const refCheck = DB.validate();
const orphanCheck = refCheck.errors.filter(e => e.includes("Orphan"));
assert(
  orphanCheck.length === 0,
  "T62: No orphan foreign key references in seed data",
  "orphans=" + JSON.stringify(orphanCheck),
);
const dupCheck = refCheck.errors.filter(e => e.includes("Duplicate"));
assert(
  dupCheck.length === 0,
  "T63: No duplicate IDs in seed data",
  "dups=" + JSON.stringify(dupCheck),
);
const dupKodeCheck = refCheck.errors.filter(e => e.includes("Duplicate material kode"));
assert(
  dupKodeCheck.length === 0,
  "T64: No duplicate material kodes in seed data",
  "dups=" + JSON.stringify(dupKodeCheck),
);

console.log("\n==========================================");
console.log("==========================================");
for (const r of results) {
  const icon = r.pass ? "PASS" : "FAIL";
  console.log(
    "  [" + icon + "] " + r.name + (r.detail ? " — " + r.detail : ""),
  );
}
console.log("==========================================");
console.log(
  "  Total: " +
    results.length +
    " | Passed: " +
    passed +
    " | Failed: " +
    failed,
);
console.log("==========================================");
if (failed > 0) process.exit(1);
