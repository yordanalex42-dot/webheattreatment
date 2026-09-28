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

let DB;

function setupFresh() {
  global.localStorage = new MemoryStorage();
  const authCode = fs
    .readFileSync(path.join(__dirname, "js", "auth.js"), "utf8")
    .replace("const Auth", "var Auth");
  const dbCode = fs
    .readFileSync(path.join(__dirname, "js", "db.js"), "utf8")
    .replace("const DB", "var DB");
  DB = new Function("localStorage", dbCode + "\n; return DB;")(
    global.localStorage,
  );
  DB.init();
}

function seedShotblastProduction(materialKode, opts) {
  opts = opts || {};
  const mat = DB.findByKode(materialKode);
  if (!mat) return null;
  const prod = {
    material_id: mat.id,
    incoming_id: mat.id,
    tracking_id: "",
    kode: mat.kode,
    jenis_treatment: "Shotblast",
    process_type: "Shotblast",
    tanggal_proses: new Date().toISOString().split("T")[0],
    production_status: opts.status || "FINISH",
    status: opts.status === "FINISH" ? "Finish" : "Process",
    process_result: opts.result !== undefined ? opts.result : "OK",
    process_ng_note: opts.ngNote || "",
    start_scan_at: opts.status === "PROCESS" ? new Date().toISOString() : "",
    start_scan_by: opt1(opts),
    finish_scan_at: opts.status === "FINISH" ? new Date().toISOString() : "",
    finish_scan_by: opts.status === "FINISH" ? opt1(opts) : "",
    machine_start_at: opts.status === "PROCESS" ? "2026-09-20" : "",
    machine_start_by: opt1(opts),
    machine_finish_at: opts.status === "FINISH" ? "2026-09-21" : "",
    machine_finish_by: opts.status === "FINISH" ? opt1(opts) : "",
    visual_check_result: "OK",
    visual_check_note: "",
    remarks: "",
  };
  return DB.insert("productions", prod);
}

function seedAntiRustProduction(materialKode, opts) {
  opts = opts || {};
  const mat = DB.findByKode(materialKode);
  if (!mat) return null;
  const prod = {
    material_id: mat.id,
    incoming_id: mat.id,
    tracking_id: "",
    kode: mat.kode,
    jenis_treatment: "Anti Rust",
    process_type: "Anti Rust",
    tanggal_proses: new Date().toISOString().split("T")[0],
    production_status: opts.status || "FINISH",
    status: opts.status === "FINISH" ? "Finish" : "Process",
    process_result: opts.result !== undefined ? opts.result : "OK",
    process_ng_note: opts.ngNote || "",
    start_scan_at: opts.status === "PROCESS" ? new Date().toISOString() : "",
    start_scan_by: opt2(opts),
    finish_scan_at: opts.status === "FINISH" ? new Date().toISOString() : "",
    finish_scan_by: opts.status === "FINISH" ? opt2(opts) : "",
    machine_start_at: opts.status === "PROCESS" ? "2026-09-21" : "",
    machine_start_by: opt2(opts),
    machine_finish_at: opts.status === "FINISH" ? "2026-09-22" : "",
    machine_finish_by: opts.status === "FINISH" ? opt2(opts) : "",
    visual_check_result: "OK",
    visual_check_note: "",
    remarks: "",
  };
  return DB.insert("productions", prod);
}

function opt1(o) { return o.startBy || "Operator SB"; }
function opt2(o) { return o.startBy || "Operator AR"; }

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
console.log("  HT SYSTEM - MULTI-PROCESS DATA LAYER TESTS (Tahap 3B-3A)");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================\n");

console.log("=== GROUP A: getProcessProduction ===");
setupFresh();
assert(
  DB.getProcessProduction(DB.findByKode("20260001I"), "Heat Treatment") !== null,
  "A1: Heat Treatment existing found (20260001I)",
  "",
);
assert(
  DB.getProcessProduction(DB.findByKode("20260001I"), "shotblast") === null,
  "A2: Shotblast not yet exists -> null",
  "val=" + DB.getProcessProduction(DB.findByKode("20260001I"), "Shotblast"),
);
assert(
  DB.getProcessProduction(DB.findByKode("20260001I"), "Anti Rust") === null,
  "A3: Anti Rust not yet exists -> null",
  "val=" + DB.getProcessProduction(DB.findByKode("20260001I"), "Anti Rust"),
);
assert(
  DB.getProcessProduction("99999999ZZ", "Heat Treatment") === null,
  "A4: Material tidak ditemukan -> null",
  "",
);

console.log("\n=== GROUP B: isProcessCompleted ===");
setupFresh();
assert(
  DB.isProcessCompleted(DB.findByKode("20260001I"), "Heat Treatment") === true,
  "B5: FINISH + OK -> true",
  "prod=" + JSON.stringify(DB.getProcessProduction(DB.findByKode("20260001I"), "Heat Treatment")?.production_status),
);
assert(
  DB.isProcessCompleted(DB.findByKode("20260004I"), "Heat Treatment") === false,
  "B6: FINISH + NG -> false",
  "hasil=" + DB.getProcessProduction(DB.findByKode("20260004I"), "Heat Treatment")?.process_result,
);
seedShotblastProduction("20260001I", { status: "PROCESS", result: "OK" });
assert(
  DB.isProcessCompleted(DB.findByKode("20260001I"), "Shotblast") === false,
  "B7: PROCESS + OK -> false",
  "",
);
seedShotblastProduction("20260002I", { status: "PROCESS", result: "" });
assert(
  DB.isProcessCompleted(DB.findByKode("20260002I"), "Shotblast") === false,
  "B8: PROCESS + null -> false",
  "",
);
setupFresh();
seedShotblastProduction("20260002I", { status: "WAITING", result: "" });
assert(
  DB.isProcessCompleted(DB.findByKode("20260002I"), "Shotblast") === false,
  "B9: WAITING + null -> false",
  "",
);
assert(
  DB.isProcessCompleted(DB.findByKode("20260006I"), "Shotblast") === false,
  "B10: tidak ada production -> false",
  "",
);

console.log("\n=== GROUP C: process route snapshots ===");
setupFresh();
assert(
  JSON.stringify(DB.checkQualityGate("20260001I").processRouteSteps) === JSON.stringify(["HT", "QC", "SHOTBLAST", "ANTI_RUST"]),
  "C11: 20260001I route = HT -> QC -> Shotblast -> Anti Rust",
  "steps=" + JSON.stringify(DB.checkQualityGate("20260001I").processRouteSteps),
);
assert(
  JSON.stringify(DB.checkQualityGate("20260002I").processRouteSteps) === JSON.stringify(["HT", "QC", "SHOTBLAST"]),
  "C12: 20260002I route = HT -> QC -> Shotblast",
  "steps=" + JSON.stringify(DB.checkQualityGate("20260002I").processRouteSteps),
);
assert(
  JSON.stringify(DB.checkQualityGate("20260003I").processRouteSteps) === JSON.stringify(["HT", "QC", "ANTI_RUST"]),
  "C13: 20260003I route = HT -> QC -> Anti Rust",
  "steps=" + JSON.stringify(DB.checkQualityGate("20260003I").processRouteSteps),
);
assert(
  JSON.stringify(DB.checkQualityGate("20260005I").processRouteSteps) === JSON.stringify(["HT", "QC"]),
  "C14: 20260005I route = HT -> QC",
  "steps=" + JSON.stringify(DB.checkQualityGate("20260005I").processRouteSteps),
);

console.log("\n=== GROUP D: getNextProcess ===");
setupFresh();
assert(
  DB.getNextProcess(DB.findByKode("20260001I")) === "SHOTBLAST",
  "D15: QC PASS + Shotblast belum selesai -> SHOTBLAST",
  "next=" + DB.getNextProcess(DB.findByKode("20260001I")),
);
seedShotblastProduction("20260001I", { status: "FINISH", result: "OK" });
assert(
  DB.getNextProcess(DB.findByKode("20260001I")) === "ANTI_RUST",
  "D16: Shotblast FINISH+OK -> ANTI_RUST",
  "next=" + DB.getNextProcess(DB.findByKode("20260001I")),
);
assert(
  DB.getNextProcess(DB.findByKode("20260003I")) === "ANTI_RUST",
  "D17: Route tanpa Shotblast -> next is ANTI_RUST (not SHOTBLAST)",
  "next=" + DB.getNextProcess(DB.findByKode("20260003I")),
);
assert(
  DB.getNextProcess(DB.findByKode("20260002I")) === "SHOTBLAST",
  "D18: Route tanpa Anti Rust -> next is SHOTBLAST (not ANTI_RUST)",
  "next=" + DB.getNextProcess(DB.findByKode("20260002I")),
);
assert(
  DB.getNextProcess(DB.findByKode("20260005I")) === null,
  "D19: Semua route selesai -> null",
  "next=" + DB.getNextProcess(DB.findByKode("20260005I")),
);

console.log("\n=== GROUP E: canStartProcess (prerequisite) ===");
setupFresh();
assert(
  DB.canStartProcess("20260006I", "SHOTBLAST").allowed === false,
  "E20: QC belum -> Shotblast false",
  "reason=" + DB.canStartProcess("20260006I", "SHOTBLAST").reason,
);
assert(
  DB.canStartProcess("20260004I", "SHOTBLAST").allowed === false,
  "E21: QC NG -> Shotblast false",
  "qcStatus=" + DB.canStartProcess("20260004I", "SHOTBLAST").qcStatus,
);
assert(
  DB.canStartProcess("20260001I", "SHOTBLAST").allowed === true,
  "E22: QC PASS + route Shotblast -> Shotblast true",
  "",
);
assert(
  DB.canStartProcess("20260003I", "ANTI_RUST").allowed === true,
  "E23: QC PASS + route Anti Rust -> Anti Rust true",
  "",
);
assert(
  DB.canStartProcess("20260001I", "ANTI_RUST").allowed === false,
  "E24: Shotblast required but belum selesai -> Anti Rust false",
  "reason=" + DB.canStartProcess("20260001I", "ANTI_RUST").reason,
);
seedShotblastProduction("20260001I", { status: "FINISH", result: "OK" });
assert(
  DB.canStartProcess("20260001I", "ANTI_RUST").allowed === true,
  "E25: Shotblast FINISH+OK -> Anti Rust true",
  "",
);
seedShotblastProduction("20260002I", { status: "FINISH", result: "NG", ngNote: "Surface defect" });
assert(
  DB.canStartProcess("20260002I", "ANTI_RUST").allowed === false,
  "E26: Shotblast FINISH+NG -> Anti Rust false (route has no Anti Rust but prerequisite check)",
  "reason=" + DB.canStartProcess("20260002I", "ANTI_RUST").reason,
);

console.log("\n=== GROUP F: skip process prevention ===");
setupFresh();
assert(
  DB.canStartProcess("20260001I", "ANTI_RUST").allowed === false,
  "F27a: Route HT->QC->SB->AR, skip Shotblast -> Anti Rust false",
  "reason=" + DB.canStartProcess("20260001I", "ANTI_RUST").reason,
);
seedShotblastProduction("20260001I", { status: "FINISH", result: "OK" });
assert(
  DB.canStartProcess("20260001I", "ANTI_RUST").allowed === true,
  "F27b: Setelah Shotblast selesai -> Anti Rust true",
  "",
);

console.log("\n=== GROUP G: snapshot protection ===");
setupFresh();
var matG = DB.findByKode("20260001I");
var routeBefore = JSON.parse(JSON.stringify(matG.process_route));
var partG = DB.findPartById(matG.part_id);
DB.update("parts", partG.id, {
  standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false },
});
var nextG = DB.getNextProcess(matG);
assert(
  nextG === "SHOTBLAST",
  "G28: getNextProcess tetap SHOTBLAST meski part.route berubah (material route = shotblast true)",
  "next=" + nextG,
);
var startG = DB.canStartProcess("20260001I", "ANTI_RUST");
assert(
  startG.allowed === false,
  "G29: canStartProcess ANTI_RUST false (route has Anti Rust but Shotblast not done)",
  "allowed=" + startG.allowed,
);
assert(
  startG.allowed === false && startG.reason && startG.reason.includes("SHOTBLAST"),
  "G30: reason mentions SHOTBLAST prerequisite",
  "reason=" + startG.reason,
);
assert(
  DB.checkQualityGate(matG).processRoute.shotblast === true,
  "G31: material.process_route.shotblast still true (snapshot preserved)",
  "route=" + JSON.stringify(DB.checkQualityGate(matG).processRoute),
);

console.log("\n=== GROUP H: Heat Treatment variant matching ===");
setupFresh();
assert(
  DB.isProcessCompleted(DB.findByKode("20260002I"), "Heat Treatment") === true,
  "H32a: 20260002I jenis_treatment='Hardening' FINISH+OK matched as HT -> true",
  "hasil=" + DB.getProcessProduction(DB.findByKode("20260002I"), "Heat Treatment")?.jenis_treatment,
);
assert(
  DB.isProcessCompleted(DB.findByKode("20260003I"), "Heat Treatment") === true,
  "H32b: 20260003I jenis_treatment='Heat Treatment' -> true",
  "",
);
assert(
  DB.isProcessCompleted(DB.findByKode("20260004I"), "Heat Treatment") === false,
  "H32c: 20260004I FINISH+NG -> false",
  "",
);

console.log("\n=== GROUP I: normalize & alias ===");
setupFresh();
assert(
  DB._normalizeProcessKey("shotblast") === "SHOTBLAST",
  "I33: normalize 'shotblast' -> SHOTBLAST",
  "",
);
assert(
  DB._normalizeProcessKey("Anti Rust") === "ANTI_RUST",
  "I34: normalize 'Anti Rust' -> ANTI_RUST",
  "",
);
assert(
  DB._normalizeProcessKey("anti-rust") === "ANTI_RUST",
  "I35: normalize 'anti-rust' -> ANTI_RUST",
  "",
);
assert(
  DB._normalizeProcessKey("anti_rust") === "ANTI_RUST",
  "I36: normalize 'anti_rust' -> ANTI_RUST",
  "",
);
assert(
  DB._normalizeProcessKey("Heat Treatment") === "HT",
  "I37: normalize 'Heat Treatment' -> HT",
  "",
);
assert(
  DB._normalizeProcessKey("HT") === "HT",
  "I38: normalize 'HT' -> HT",
  "",
);

console.log("\n=== GROUP J: duplicate protection (getProcessProduction detect existing) ===");
setupFresh();
var matJ = DB.findByKode("20260001I");
assert(
  DB.getProcessProduction(matJ, "Shotblast") === null,
  "J39: Shotblast production belum ada -> null",
  "",
);
seedShotblastProduction("20260001I", { status: "PROCESS", result: "" });
var existingProd = DB.getProcessProduction(matJ, "Shotblast");
assert(
  existingProd !== null && existingProd.production_status === "PROCESS",
  "J40: Shotblast PROCESS record detected by getProcessProduction",
  "status=" + (existingProd ? existingProd.production_status : "null"),
);

console.log("\n=== GROUP K: Regression - existing tidak rusak ===");
setupFresh();
assert(typeof DB.checkQualityGate === "function", "K41: checkQualityGate exists", "");
assert(typeof DB.canProceedToProcess === "function", "K42: canProceedToProcess exists", "");
assert(typeof DB.getProcessProduction === "function", "K43: getProcessProduction exists", "");
assert(typeof DB.isProcessCompleted === "function", "K44: isProcessCompleted exists", "");
assert(typeof DB.getNextProcess === "function", "K45: getNextProcess exists", "");
assert(typeof DB.canStartProcess === "function", "K46: canStartProcess exists", "");
assert(DB.get("productions").length === 8, "K47: Production seed count preserved (8 records, no duplication)", "count=" + DB.get("productions").length);
assert(DB.get("qcs").length === 5, "K48: QC seed count preserved (5 records)", "count=" + DB.get("qcs").length);

console.log("\n==========================================");
console.log("  TEST RESULTS");
console.log("==========================================");
for (const r of results) {
  const icon = r.pass ? "PASS" : "FAIL";
  console.log(
    "  [" + icon + "] " + r.name + (r.detail ? " - " + r.detail : ""),
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
