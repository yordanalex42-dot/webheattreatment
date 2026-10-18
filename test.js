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

function reloadDB() {
  const dbCode = fs
    .readFileSync(path.join(__dirname, "js", "db.js"), "utf8")
    .replace("const DB", "var DB");
  DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);
  DB.init();
  return DB;
}

function insertMat(kode) {
  return DB.insert("materials", {
    kode: kode,
    qr_code: kode,
    customer_id: 1,
    part_id: 1,
    nomor_surat_jalan: "",
    lot_no: "",
    material_charge: "",
    status_part: "Masspro",
    qty: 1,
    berat_part_snapshot: 1,
    berat_total_part: 1,
    tanggal_masuk: "2026-09-28",
    keterangan: "",
    process_type: "Quenching & Tempering",
    diinput_oleh: "Tester",
    status_proses: DB.STATUSES.PROSES_WAITING,
    process_route: {
      heat_treatment: true,
      qc_check: true,
      shotblast: false,
      anti_rust: false,
    },
  });
}

function resetKodeCounter() {
  localStorage.setItem("ht_materials", JSON.stringify([]));
  localStorage.removeItem("ht_incoming_kode_counter");
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
const t15Mat = DB.findByKode("3M");
  const m1001 = t15Mat ? DB.findMaterial(t15Mat.id) : null;
  assert(
    m1001 !== undefined && m1001 !== null,
    "T15: findMaterial finds by numeric id",
    "Found: " + (m1001 ? m1001.kode : "null"),
  );
  const mKode = DB.findMaterial("3M");
  assert(
    mKode !== undefined && mKode !== null,
    "T16: findMaterial finds by kode",
    "Found: " + (mKode ? mKode.kode : "null"),
  );
  const mByIdStr = DB.findMaterial(String(t15Mat.id));
  assert(
    mByIdStr !== undefined && mByIdStr !== null,
    "T17: findMaterial finds by string id",
    "",
  );
  const t1 = DB.findByKode("3M");
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
const mat = DB.findByKode("3M");
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
  mat.status_proses === "FINISH",
  "T33: Material status_proses is FINISH",
  "Status: " + mat.status_proses,
);

console.log("\n=== GROUP 6: PRODUKSI AKHIR LOGIC (Tests 34-39) ===");
setupFresh();
const mat2 = DB.findByKode("2M");
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
const mat3 = DB.findByKode("1M");
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
  matsAfterMigrate.every(m => ["WAITING", "PROCESS", "FINISH", "FINISH_NG"].includes(m.status_proses)),
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

console.log("\n=== GROUP 11: PART process_type (Tests 65-73) ===");
setupFresh();
const allPartsSeed = DB.get("parts");
assert(
  allPartsSeed.every((p) => "process_type" in p),
  "T65: All seed parts have process_type field",
  "missing=" + JSON.stringify(allPartsSeed.filter(p => !("process_type" in p)).map(p => p.id)),
);
assert(
  allPartsSeed.every((p) => p.process_type && p.process_type !== ""),
  "T66: All seed parts have a non-empty process_type",
  "empty=" + JSON.stringify(allPartsSeed.filter(p => !p.process_type).map(p => p.id)),
);
  const partProcessMap = {
    1: "Quenching & Tempering", 2: "Annealing", 3: "Carburizing", 4: "Annealing",
    5: "Full Annealing", 6: "Stress Relief Annealing", 7: "Carburizing", 8: "Spheroidizing Annealing",
    9: "Normalizing", 10: "Quenching & Tempering",
  };
  const mapOk = allPartsSeed.every((p) => (partProcessMap[p.id] || p.process_type) === p.process_type);
  assert(mapOk, "T67: Seed parts process_type matches material demo mapping", "");
  const ptById = DB.getPartProcessType(1);
  assert(ptById === "Quenching & Tempering", "T68: getPartProcessType(1) = Quenching & Tempering", "val=" + ptById);
const ptMissing = DB.getPartProcessType(9999);
assert(ptMissing === null, "T69: getPartProcessType(missing) = null", "val=" + ptMissing);
assert(DB.canPartStartIncoming(1) === true, "T70: canPartStartIncoming(1) = true (has process_type)", "");
assert(DB.canPartStartIncoming(9999) === false, "T71: canPartStartIncoming(missing id) = false", "");
const partNoPt = { id: 555555, customer_id: 1, nomor_part: "NO-PT", nama_part: "No Process Type", berat_part: 1, satuan_berat: "KG", standard_process_route: { heat_treatment: true, qc_check: true }, status: "Active" };
DB.insert("parts", partNoPt);
const insertedPt = DB.getPartProcessType(partNoPt.id);
assert(insertedPt === "", "T72: New part without process_type reads empty (not Heat Treatment)", "val=" + JSON.stringify(insertedPt));
assert(DB.canPartStartIncoming(partNoPt.id) === false, "T73: canPartStartIncoming false when process_type empty (block Incoming)", "");
DB.migrate();
const migratedOldPart = DB.get("parts").find((p) => p.id === partNoPt.id);
assert(
  migratedOldPart && migratedOldPart.process_type === "",
  "T-extra: migrate backfills empty process_type (not Heat Treatment) for old part",
  "val=" + JSON.stringify(migratedOldPart && migratedOldPart.process_type),
);
assert(
  migratedOldPart && "process_type" in migratedOldPart,
  "T-extra: migrate preserves process_type in validPartFields (not stripped)",
  "",
);
const seedValidation = DB.validate();
const ptWarnings = seedValidation.warnings.filter((w) => w.includes("process_type"));
assert(ptWarnings.length === 0, "T-extra: validate() no process_type missing-field warnings", "w=" + JSON.stringify(ptWarnings));

console.log("\n=== GROUP 12: Process Type list & migration (Tests 74-88) ===");
setupFresh();
const NEW_OPTIONS = [
  "Quenching & Tempering","Annealing","Carburizing","Normalizing",
  "Full Annealing","Stress Relief Annealing","Spheroidizing Annealing",
];
const OPT = DB.PROCESS_TYPE_OPTIONS;
assert(
  Array.isArray(OPT) && OPT.length === 7,
  "T74: PROCESS_TYPE_OPTIONS has exactly 7 entries",
  "len=" + (OPT && OPT.length),
);
assert(
  JSON.stringify(OPT) === JSON.stringify(NEW_OPTIONS),
  "T75: PROCESS_TYPE_OPTIONS exact order/content",
  "got=" + JSON.stringify(OPT),
);
assert(
  ["Heat Treatment","Quenching","Hardening","Tempering"].every((v) => OPT.indexOf(v) === -1),
  "T76: old values removed from active list (Heat Treatment/Quenching/Hardening/Temmering)",
  "",
);
assert(
  ["Annealing","Carburizing","Normalizing"].every((v) => OPT.indexOf(v) !== -1),
  "T77: retained old values still present (Annealing/Carburizing/Normalizing)",
  "",
);
assert(
  DB.isProcessTypeValid("Quenching & Tempering") === true && DB.isProcessTypeValid("Annealing") === true,
  "T78: valid canonical values accepted",
  "",
);
assert(
  DB.isProcessTypeValid("Heat Treatment") === false && DB.isProcessTypeValid("Quenching") === false,
  "T79: legacy/old values rejected as canonical",
  "",
);
assert(
  DB.isProcessTypeValid("") === false && DB.isProcessTypeValid(undefined) === false,
  "T80: empty/undefined invalid",
  "",
);
assert(
  DB.isProcessTypeLegacy("Heat Treatment") === true && DB.isProcessTypeLegacy("Hardening") === true && DB.isProcessTypeLegacy("Tempering") === true,
  "T81: legacy values flagged",
  "",
);
assert(
  DB.isProcessTypeLegacy("Annealing") === false && DB.isProcessTypeLegacy("") === false && DB.isProcessTypeLegacy(undefined) === false,
  "T82: non-legacy values not flagged",
  "",
);
/* Migration: idempotency + no data transformation/loss */
assert(
  localStorage.getItem("ht_migration_process_types_v2") === "1",
  "T83: migration flag ht_migration_process_types_v2 set after init",
  "",
);
/* T85: Insert a part with legacy process_type to verify migrate() preserves it */
  const legacyPartIns = DB.insert("parts", {
    customer_id: 1,
    nomor_part: "LEGACY-PART",
    nama_part: "Legacy Type Part",
    berat_part: 1,
    satuan_berat: "KG",
    target_hardness: "",
    standard_temperature: null,
    process_type: "Heat Treatment",
    standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false },
    status: "Active",
  });
  DB.migrate();
  DB.migrate(); /* idempotent: run twice more */
  assert(
    localStorage.getItem("ht_migration_process_types_v2") === "1",
    "T84: migration flag unchanged (idempotent) after repeated migrate()",
    "",
  );
  const legacyPart1 = DB.findPartById(legacyPartIns.id);
  assert(
    legacyPart1 && legacyPart1.process_type === "Heat Treatment",
    "T85: legacy process_type preserved through migration (not auto-converted to Quenching & Tempering)",
    "val=" + JSON.stringify(legacyPart1 && legacyPart1.process_type),
  );
  assert(
    legacyPart1 && DB.isProcessTypeLegacy(legacyPart1.process_type) === true,
    "T86: preserved legacy value correctly flagged by isProcessTypeLegacy",
    "",
  );
  assert(
    DB.findPartById(4) && DB.findPartById(4).process_type === "Annealing" && DB.isProcessTypeLegacy(DB.findPartById(4).process_type) === false,
    "T87: retained value (Annealing) valid & not flagged",
    "",
  );
  const report = DB.getLegacyProcessTypeReport();
  assert(
    Array.isArray(report) && report.length > 0 && report.some((r) => r.table === "parts" && r.id === legacyPart1.id && r.value === "Heat Treatment"),
    "T88: getLegacyProcessTypeReport lists legacy part with original value (review marker)",
    "len=" + report.length,
  );
/* ensure no data loss: customers/materials still present */
assert(
  DB.get("customers").length > 0 && DB.get("materials").length > 0 && DB.get("parts").length > 0,
  "T-extra: migrate() does not reset/erase localStorage tables",
  "",
);

console.log("\n=== GROUP 13: Temperature validation (Tests 89-101) ===");
setupFresh();
const crank = DB.findPartById(1);
assert(
  crank && crank.standard_temperature === 580,
  "T89: Seed part Crankshaft A has standard_temperature 580",
  "val=" + JSON.stringify(crank && crank.standard_temperature),
);
const STD = crank.standard_temperature;
const TOL = DB.TEMPERATURE_DEFAULT_TOLERANCE;
assert(TOL === 15, "T90: TEMPERATURE_DEFAULT_TOLERANCE is 15", "tol=" + TOL);
assert(DB.getPartStandardTemperature(1) === 580, "T91: getPartStandardTemperature(1)=580", "");
assert(DB.getPartStandardTemperature(9999) === null, "T91b: getPartStandardTemperature(missing)=null", "");
const boundary = [
  [564, "NG", "below min"],
  [565, "OK", "inclusive min"],
  [580, "OK", "at standard"],
  [585, "OK", "above standard"],
  [595, "OK", "inclusive max"],
  [596, "NG", "above max"],
  [600, "NG", "way above"],
];
let idx = 91;
boundary.forEach(function (c) {
  const a = c[0];
  const exp = c[1];
  const r = DB.validateTemperature(a, STD, TOL);
  idx++;
  assert(
    r.result === exp,
    "T" + idx + ": actual=" + a + " -> " + exp + " (" + c[2] + ")",
    "min=" + r.min + " max=" + r.max + " dev=" + r.deviation + " got=" + r.result,
  );
});
assert(
  DB.validateTemperature("", STD, TOL).result === "NG",
  "T99: empty actual -> NG",
  "",
);
assert(
  DB.validateTemperature(580, undefined, TOL).result === "NG",
  "T100: standard not set -> NG",
  "",
);
assert(
  DB.validateTemperature("abc", STD, TOL).result === "NG",
  "T101: non-numeric actual -> NG",
  "",
);
const r95 = DB.validateTemperature(595, STD, TOL);
assert(
  r95.deviation === 15 && r95.min === 565 && r95.max === 595,
  "T102: deviation/min/max correct (595 -> dev +15, min 565, max 595)",
  "dev=" + r95.deviation + " min=" + r95.min + " max=" + r95.max,
);
assert(
  DB.validateTemperature(596, STD, 20).result === "OK",
  "T103: tolerance override (596, std 580, tol 20) -> OK",
  "",
);
/* Seed production records include temperature fields for finished processes */
const seedProd = DB.find("productions", "kode", "3M");
const tempFieldsCheck = [
  "standard_temperature_snapshot","temperature_tolerance_snapshot","actual_temperature",
  "temperature_min","temperature_max","temperature_deviation","temperature_result",
  "temperature_recorded_at","temperature_recorded_by",
];
const hasAllTemp = tempFieldsCheck.every((f) => f in (seedProd || {}));
assert(
  hasAllTemp,
  "T-extra-temp1: seed FINISH production (id 2001) includes temperature fields",
  "prod=" + (seedProd ? seedProd.id : "?"),
);
/* Verify seed temp values are correct (part 1, std=580, actual=580, OK) */
assert(
  seedProd.standard_temperature_snapshot === 580 &&
    seedProd.actual_temperature === 580 &&
    seedProd.temperature_result === "OK" &&
    seedProd.temperature_min === 565 &&
    seedProd.temperature_max === 595,
  "T-extra-temp1b: seed production temp values correct (std=580, actual=580, OK)",
  "std=" + seedProd.standard_temperature_snapshot + " actual=" + seedProd.actual_temperature + " result=" + seedProd.temperature_result,
);
/* Temperature snapshot on a production survives migrate() (idempotent persistence) */
const matForSnap = DB.find("materials", "kode", "3M");
const snap = {
  id: 9001,
  material_id: matForSnap.id,
  kode: mat.kode,
  production_status: "FINISH",
  process_result: "OK",
  jenis_treatment: "Quenching & Tempering",
  standard_temperature_snapshot: 580,
  temperature_tolerance_snapshot: 15,
  actual_temperature: 595,
  temperature_min: 565,
  temperature_max: 595,
  temperature_deviation: 15,
  temperature_result: "OK",
  temperature_recorded_at: "2026-09-01T10:35:00",
  temperature_recorded_by: "Operator Mesin 01",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};
DB.insert("productions", snap);
const snapBefore = DB.find("productions", "id", snap.id);
DB.migrate();
DB.migrate();
const snapAfter = DB.find("productions", "id", snap.id);
assert(
  snapAfter &&
    snapAfter.actual_temperature === 595 &&
    snapAfter.temperature_result === "OK" &&
    snapAfter.temperature_deviation === 15,
  "T-extra-temp2: temperature snapshot preserved through migrate() (idempotent)",
  "after=" + JSON.stringify(snapAfter && { at: snapAfter.actual_temperature, tr: snapAfter.temperature_result, dev: snapAfter.temperature_deviation }),
);
/* Cross-page linking: material.part_id -> part.standard_temperature is the source of truth */
assert(
  matForSnap.part_id === 1 && DB.findPartById(matForSnap.part_id).standard_temperature === 580,
  "T-extra-temp3: material.part_id (1) resolves to part standard_temperature 580",
  "part_id=" + matForSnap.part_id,
);
/* Histori must not change when master Part is updated afterwards */
DB.update("parts", 1, { standard_temperature: 600 });
const snapAfterMasterChange = DB.find("productions", "id", snap.id);
assert(
  snapAfterMasterChange.standard_temperature_snapshot === 580 &&
    snapAfterMasterChange.temperature_result === "OK",
  "T-extra-temp4: production temperature snapshot NOT changed when master Part updated (580 preserved)",
  "snap=" + snapAfterMasterChange.standard_temperature_snapshot + " master now=" + DB.findPartById(1).standard_temperature,
);
/* Different part (no standard_temperature) -> getPartStandardTemperature null, validate NG */
DB.update("parts", 2, { standard_temperature: null });
assert(
  DB.getPartStandardTemperature(2) === null &&
    DB.validateTemperature(850, null, TOL).result === "NG",
    "T-extra-temp5: part without standard_temperature -> null standard, validate NG",
  "",
);


console.log("\n=== GROUP 14: Production finish with temperature (Tests 126-135) ===");
setupFresh();

/* T126: PROSES_FINISH_NG must be defined in STATUSES */
assert(
  DB.STATUSES.PROSES_FINISH_NG === "FINISH_NG",
  "T126: DB.STATUSES.PROSES_FINISH_NG is defined as FINISH_NG",
  "val=" + DB.STATUSES.PROSES_FINISH_NG,
);

/* T127: SCHEMAS.productions includes temperature fields */
const schemaTempFields = [
  "standard_temperature_snapshot","temperature_tolerance_snapshot","actual_temperature",
  "temperature_min","temperature_max","temperature_deviation","temperature_result",
  "temperature_recorded_at","temperature_recorded_by",
];
const schemaHasTemp = schemaTempFields.every(f => DB.SCHEMAS.productions.includes(f));
assert(
  schemaHasTemp,
  "T127: SCHEMAS.productions includes all temperature fields",
  "missing=" + JSON.stringify(schemaTempFields.filter(f => !DB.SCHEMAS.productions.includes(f))),
);

/* Helper: simulate confirmSelesaiProses temperature logic */
function simulateFinish(material, production, actualTemp, ngTemperatureNote) {
  var standardTemp = DB.getPartStandardTemperature(material.part_id);
  var tolerance = DB.TEMPERATURE_DEFAULT_TOLERANCE;
  var tempValidation = DB.validateTemperature(actualTemp, standardTemp, tolerance);
  var processResult = tempValidation.result === "NG" ? "NG" : "OK";
  var isNG = processResult === "NG";
  var ngNote = isNG
    ? (ngTemperatureNote || "Suhu aktual di luar toleransi (Standar: " + standardTemp + " °C ±" + tolerance + ")")
    : "";
  return DB.update("productions", production.id, {
    status: isNG ? DB.STATUSES.PROD_FINISH_NG : DB.STATUSES.PROD_FINISH,
    production_status: isNG ? DB.STATUSES.PROD_FINISH_NG : DB.STATUSES.PROD_FINISH,
    process_result: processResult,
    process_ng_note: ngNote,
    standard_temperature_snapshot: standardTemp,
    temperature_tolerance_snapshot: tolerance,
    actual_temperature: Number(actualTemp),
    temperature_min: tempValidation.min,
    temperature_max: tempValidation.max,
    temperature_deviation: tempValidation.deviation,
    temperature_result: tempValidation.result,
    temperature_recorded_at: new Date().toISOString(),
    temperature_recorded_by: "Tester",
    finish_scan_at: new Date().toISOString(),
    finish_scan_by: "Tester",
  });
}

/* Find a material in PROCESS state with standard_temperature */
const procMat = DB.findByKode("2M");
const procProd = DB.find("productions", "material_id", procMat.id);
assert(
  procMat && procProd && procProd.production_status === "PROCESS",
  "T128: Found PROCESS production for finish test",
  "mat=" + procMat.kode + " prod_status=" + (procProd ? procProd.production_status : "?"),
);
const procPart = DB.findPartById(procMat.part_id);
const procStdTemp = procPart.standard_temperature;

/* T129: Temperature within tolerance -> OK result (no manual selection needed) */
const okResult = simulateFinish(procMat, procProd, procStdTemp.toString());
assert(
  okResult.process_result === "OK" && okResult.status === "FINISH" && okResult.production_status === "FINISH",
  "T129: Temp OK -> process_result=OK, status=FINISH, production_status=FINISH",
  "result=" + okResult.process_result + " status=" + okResult.status,
);

/* T130: Temperature within tolerance -> always OK (manual NG no longer possible) */
const procProd2 = DB.find("productions", "material_id", procMat.id);
const okResult2 = simulateFinish(procMat, procProd2, procStdTemp.toString());
assert(
  okResult2.process_result === "OK" && okResult2.status === "FINISH" && okResult2.production_status === "FINISH",
  "T130: Temp OK (no manual NG option) -> process_result=OK, not NG",
  "result=" + okResult2.process_result + " status=" + okResult2.status,
);

/* T131: Temperature outside tolerance (too high) -> NG result */
const procProd3 = DB.find("productions", "material_id", procMat.id);
const tooHighTemp = (procStdTemp + 50).toString();
const forcedNG = simulateFinish(procMat, procProd3, tooHighTemp);
assert(
  forcedNG.process_result === "NG" && forcedNG.temperature_result === "NG" &&
  forcedNG.status === "FINISH_NG" && forcedNG.production_status === "FINISH_NG",
  "T131: Temp NG (too high) -> forced process_result=NG, status=FINISH_NG",
  "result=" + forcedNG.process_result + " temp_result=" + forcedNG.temperature_result + " status=" + forcedNG.status,
);

/* T132: Temperature outside tolerance (too low) -> NG result */
const procProd4 = DB.find("productions", "material_id", procMat.id);
const tooLowTemp = (procStdTemp - 50).toString();
const forcedNGLow = simulateFinish(procMat, procProd4, tooLowTemp);
assert(
  forcedNGLow.process_result === "NG" && forcedNGLow.temperature_result === "NG",
  "T132: Temp NG (too low) -> forced process_result=NG",
  "result=" + forcedNGLow.process_result + " temp_result=" + forcedNGLow.temperature_result,
);

/* T133: Temperature at boundary (max) -> OK result */
const procProd5 = DB.find("productions", "material_id", procMat.id);
const boundaryMaxTemp = (procStdTemp + 15).toString();
const boundaryOk = simulateFinish(procMat, procProd5, boundaryMaxTemp);
assert(
  boundaryOk.process_result === "OK" && boundaryOk.temperature_result === "OK" &&
  boundaryOk.status === "FINISH" && boundaryOk.production_status === "FINISH",
  "T133: Temp at inclusive max boundary -> OK",
  "temp_result=" + boundaryOk.temperature_result + " status=" + boundaryOk.status,
);

/* T134: Temperature at boundary (min) -> OK result */
const procProd6 = DB.find("productions", "material_id", procMat.id);
const boundaryMinTemp = (procStdTemp - 15).toString();
const boundaryOk2 = simulateFinish(procMat, procProd6, boundaryMinTemp);
assert(
  boundaryOk2.process_result === "OK" && boundaryOk2.temperature_result === "OK",
  "T134: Temp at inclusive min boundary -> OK",
  "temp_result=" + boundaryOk2.temperature_result,
);

/* T135: Temperature just above max boundary -> NG result */
const procProd7 = DB.find("productions", "material_id", procMat.id);
const justAboveMax = (procStdTemp + 16).toString();
const boundaryNg = simulateFinish(procMat, procProd7, justAboveMax);
assert(
  boundaryNg.process_result === "NG" && boundaryNg.temperature_result === "NG",
  "T135: Temp just above max boundary -> NG",
  "temp_result=" + boundaryNg.temperature_result,
);

/* T136: Temperature just below min boundary -> NG result */
const procProd8 = DB.find("productions", "material_id", procMat.id);
const justBelowMin = (procStdTemp - 16).toString();
const boundaryNgLow = simulateFinish(procMat, procProd8, justBelowMin);
assert(
  boundaryNgLow.process_result === "NG" && boundaryNgLow.temperature_result === "NG",
  "T136: Temp just below min boundary -> NG",
  "temp_result=" + boundaryNgLow.temperature_result,
);

/* T137: NG with temperature note -> note stored in process_ng_note */
const procProd9 = DB.find("productions", "material_id", procMat.id);
const ngTempWithNote = (procStdTemp + 100).toString();
const ngWithNote = simulateFinish(procMat, procProd9, ngTempWithNote, "Suhu terlalu tinggi akibat pemanasan berlebih");
assert(
  ngWithNote.process_result === "NG" && ngWithNote.process_ng_note === "Suhu terlalu tinggi akibat pemanasan berlebih",
  "T137: NG with temperature note -> note stored correctly",
  "result=" + ngWithNote.process_result + " note=" + ngWithNote.process_ng_note,
);

/* T138: NG without temperature note -> auto-generated note stored */
const procProd10 = DB.find("productions", "material_id", procMat.id);
const ngTempNoNote = (procStdTemp - 100).toString();
const ngAutoNote = simulateFinish(procMat, procProd10, ngTempNoNote);
assert(
  ngAutoNote.process_result === "NG" && ngAutoNote.process_ng_note.includes("di luar toleransi"),
  "T138: NG without note -> auto-generated note stored",
  "result=" + ngAutoNote.process_result + " note=" + ngAutoNote.process_ng_note,
);

/* T139: OK result -> process_ng_note should be empty */
const procProd11 = DB.find("productions", "material_id", procMat.id);
const okResultNote = simulateFinish(procMat, procProd11, procStdTemp.toString(), "should be cleared");
assert(
  okResultNote.process_result === "OK" && okResultNote.process_ng_note === "",
  "T139: OK result -> process_ng_note empty",
  "result=" + okResultNote.process_result + " note=" + JSON.stringify(okResultNote.process_ng_note),
);

/* T140: Empty actual temperature -> NG result */
const procProd11b = DB.find("productions", "material_id", procMat.id);
const emptyTempResult = simulateFinish(procMat, procProd11b, "");
assert(
  emptyTempResult.process_result === "NG" && emptyTempResult.temperature_result === "NG",
  "T140: Empty actual temperature -> NG result",
  "result=" + emptyTempResult.process_result + " temp_result=" + emptyTempResult.temperature_result,
);

/* T141: Changing from NG to OK -> process_ng_note cleared, result OK */
const procProd12 = DB.find("productions", "material_id", procMat.id);
const changedToOk = simulateFinish(procMat, procProd12, procStdTemp.toString(), "old NG note should not persist");
assert(
  changedToOk.process_result === "OK" && changedToOk.process_ng_note === "",
  "T141: NG->OK change -> note cleared, result OK",
  "result=" + changedToOk.process_result + " note=" + JSON.stringify(changedToOk.process_ng_note),
);

console.log("\n=== GROUP 15: Nomor Kode Incoming format baru (Tests 104-125) ===");
setupFresh();
assert(
  DB.KODE_YEAR_MAP[2026] === "M",
  "T104: KODE_YEAR_MAP 2026 -> M (pemetaan kode tahun terpisah)",
  "map=" + JSON.stringify(DB.KODE_YEAR_MAP),
);

setupFresh();
resetKodeCounter();
assert(
  DB.nextIncomingKode("2026-09-28") === "1M",
  "T105: Incoming baru pertama = 1M",
  "",
);

setupFresh();
resetKodeCounter();
const k1 = DB.nextIncomingKode("2026-09-28");
const k2 = DB.nextIncomingKode("2026-10-01");
const k3 = DB.nextIncomingKode("2026-10-10");
assert(
  k1 === "1M" && k2 === "2M" && k3 === "3M",
  "T106: urutan 1M, 2M, 3M",
  k1 + " / " + k2 + " / " + k3,
);

setupFresh();
resetKodeCounter();
for (let i = 1; i <= 9; i++) insertMat(i + "M");
assert(
  DB.nextIncomingKode("2026-09-28") === "10M",
  "T107: setelah 1M..9M tersimpan, berikutnya = 10M (multi-digit)",
  "next=" + DB.peekIncomingKode("2026-09-28"),
);

setupFresh();
resetKodeCounter();
for (let i = 1; i <= 124; i++) insertMat(i + "M");
assert(
  DB.nextIncomingKode("2026-09-28") === "125M",
  "T108: setelah 1M..124M tersimpan, berikutnya = 125M (multi-digit)",
  "mats=" + DB.get("materials").length,
);

setupFresh();
resetKodeCounter();
const d1 = insertMat(DB.nextIncomingKode("2026-09-28"));
const d2 = insertMat(DB.nextIncomingKode("2026-09-28"));
DB.delete("materials", d1.id);
assert(
  DB.nextIncomingKode("2026-09-28") === "3M",
  "T109: setelah hapus 1M, berikutnya = 3M (nomor tidak dipakai ulang)",
  "",
);

setupFresh();
const newMat1 = DB.findByKode("1M");
const newMat2 = DB.findByKode("2M");
const newMat3 = DB.findByKode("10M");
assert(
  newMat1 !== undefined &&
    newMat2 !== undefined &&
    newMat3 !== undefined &&
    newMat1.kode === "1M" &&
    newMat2.kode === "2M" &&
    newMat3.kode === "10M",
  "T110: data lama tetap dapat dicari dengan Nomor Kode lamanya (1M/2M/10M)",
  "kodes=" + [newMat1.kode, newMat2.kode, newMat3.kode].join(","),
);

setupFresh();
resetKodeCounter();
DB.nextIncomingKode("2026-09-28");
DB.nextIncomingKode("2026-09-28");
DB.nextIncomingKode("2026-09-28");
assert(
  JSON.parse(localStorage.getItem("ht_incoming_kode_counter"))["2026"] === 3,
  "T111: counter persisten di localStorage setelah 3 kali generate",
  "stored=" + localStorage.getItem("ht_incoming_kode_counter"),
);
reloadDB();
const refreshed = DB.nextIncomingKode("2026-09-28");
assert(
  refreshed === "4M",
  "T112: setelah refresh (reloadDB), generate berikutnya = 4M (sequence tidak reset)",
  "got=" + refreshed,
);

setupFresh();
resetKodeCounter();
const seen = new Set();
let dup = false;
for (let i = 0; i < 50; i++) {
  const k = DB.nextIncomingKode("2026-10-10");
  if (seen.has(k)) {
    dup = true;
    break;
  }
  seen.add(k);
}
assert(
  !dup && seen.size === 50,
  "T113: 50 kode berurutan semua unik (tidak duplikat)",
  "size=" + seen.size + " dup=" + dup,
);
assert([...seen].pop() === "50M", "T114: kode ke-50 = 50M", "last=" + [...seen].pop());

setupFresh();
resetKodeCounter();
const newId = DB.nextIncomingKode("2026-09-28");
const inserted = insertMat(newId);
const found = DB.findByKode(newId);
assert(
  found && found.id === inserted.id,
  "T115: kode baru dapat dicari via findByKode('" + newId + "')",
  "id=" + (found ? found.id : "null"),
);
const kodeBefore = found.kode;
DB.update("materials", found.id, { kode: kodeBefore, status_proses: DB.STATUSES.PROD_PROCESS });
const foundAfter = DB.findByKode(newId);
assert(
  foundAfter && foundAfter.kode === "1M" && foundAfter.status_proses === "PROCESS",
  "T116: EDIT mempertahankan Nomor Kode lama (1M tidak berubah, field lain ter-update)",
  "",
);
const afterEditNext = DB.nextIncomingKode("2026-09-28");
assert(
  afterEditNext === "2M",
  "T117: EDIT tidak menambah/mengubah penghitung (generate berikutnya = 2M)",
  "got=" + afterEditNext,
);

setupFresh();
resetKodeCounter();
assert(
  DB.peekIncomingKode("2026-09-28") === "1M",
  "T118: peekIncomingKode mengembalikan 1M tanpa menulis state",
  "",
);
const counterRaw = localStorage.getItem("ht_incoming_kode_counter");
const counterAfterPeek = counterRaw ? JSON.parse(counterRaw) : {};
assert(
  counterAfterPeek["2026"] === undefined,
  "T119: peek tidak menulis counter (2026 belum ada di counter)",
  "stored=" + JSON.stringify(counterAfterPeek),
);
assert(
  DB.nextIncomingKode("2026-09-28") === "1M",
  "T120: setelah peek, generate pertama tetap 1M (peek tak mengubah state)",
  "",
);

setupFresh();
assert(
  DB._parseIncomingKode("20260001I") === null &&
    DB._parseIncomingKode("20260011J") === null,
  "T121: parseIncomingKode(format lama) = null (tidak memengaruui penghitung)",
  "",
);
const parse1 = DB._parseIncomingKode("1M");
const parse2 = DB._parseIncomingKode("125M");
assert(
  parse1 && parse1.seq === 1 && parse1.year === 2026 && parse1.yearCode === "M" &&
    parse2 && parse2.seq === 125 && parse2.year === 2026,
  "T122: parseIncomingKode(format baru) parse seq/tahun/kode",
  JSON.stringify(parse1) + " / " + JSON.stringify(parse2),
);
assert(
  DB._parseIncomingKode("") === null &&
    DB._parseIncomingKode(null) === null &&
    DB._parseIncomingKode(undefined) === null &&
    DB._parseIncomingKode("1X") === null &&
    DB._parseIncomingKode("abcM") === null,
  "T123: parseIncomingKode invalid / kode-tahun-tidak-terdaftar = null",
  "",
);

setupFresh();
resetKodeCounter();
let threw = false;
try {
  DB.nextIncomingKode("2025-01-01");
} catch (e) {
  threw = true;
}
assert(threw, "T124: tahun tidak terdaftar di KODE_YEAR_MAP (2025) melempar error", "");

setupFresh();
resetKodeCounter();
const freshKode = DB.nextIncomingKode("2026-09-28");
const freshMat = insertMat(freshKode);
assert(
  DB.findByKode(freshKode) !== undefined &&
    DB.findByKode(freshKode).id === freshMat.id,
  "T125: material baru terhubung via findByKode (search/filter baru)",
  "kode=" + freshKode,
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
