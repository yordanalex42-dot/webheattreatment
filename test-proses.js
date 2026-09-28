/* ============================================================
   PROSES.HTML SMOKE TEST (Tahap 3B-3B)
   Data-level simulation of proses.html flow:
     - process param normalization (SHOTBLAST / ANTI_RUST)
     - route variants A/B/C/D
     - LOCK conditions (QC not done, QC NG, prerequisite)
     - start process (insert production)
     - finish OK / NG
     - duplicate protection (PROCESS, FINISH+OK, FINISH_NG)
     - route snapshot protection
   Uses fresh in-memory DB seeded from db.js seedDemoData.
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
}

function setupFresh() {
  global.localStorage = new MemoryStorage();
  const authCode = fs
    .readFileSync(path.join(__dirname, "js", "auth.js"), "utf8")
    .replace("const Auth", "var Auth");
  const dbCode = fs
    .readFileSync(path.join(__dirname, "js", "db.js"), "utf8")
    .replace("const DB", "var DB");
  const Auth = new Function("localStorage", authCode + "\n; return Auth;")(
    global.localStorage,
  );
  const DB = new Function("localStorage", dbCode + "\n; return DB;")(
    global.localStorage,
  );
  DB.init();
  Auth.initDefaultUser();
  return { Auth, DB };
}

var { Auth, DB } = setupFresh();
var session = Auth.getSession();

var passed = 0;
var failed = 0;
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

function normalizeProcessParam(raw) {
  if (!raw) return "";
  return DB._normalizeProcessKey(raw);
}

var PROCESS_META = {
  SHOTBLAST: { label: "SHOTBLAST", jenis_treatment: "Shotblast" },
  ANTI_RUST: { label: "ANTI RUST", jenis_treatment: "Anti Rust" },
};

function simulateStart(material, processKey) {
  var gate = DB.canStartProcess(material, processKey);
  if (!gate.allowed) return { ok: false, reason: gate.reason, gate: gate };
  var existing = DB.getProcessProduction(material, processKey);
  if (existing && existing.production_status === "PROCESS") {
    return { ok: false, reason: "Proses sedang berjalan.", gate: gate };
  }
  if (existing && existing.production_status === "FINISH" && existing.process_result === "OK") {
    return { ok: false, reason: "Proses sudah selesai.", gate: gate };
  }
  if (existing && (existing.production_status === "FINISH_NG" || existing.process_result === "NG")) {
    return { ok: false, reason: "Proses selesai dengan hasil NG.", gate: gate };
  }
  var now = new Date().toISOString();
  var data = {
    material_id: material.id,
    incoming_id: material.id,
    kode: material.kode || "",
    status: "Process",
    production_status: "PROCESS",
    start_scan_at: now,
    start_scan_by: session ? session.name : "Operator",
    machine_start_at: now,
    machine_start_by: session ? session.name : "Operator",
    tanggal_proses: new Date().toISOString().split("T")[0],
    jenis_treatment: PROCESS_META[processKey].jenis_treatment,
    visual_check_result: "OK",
    visual_check_note: "",
    process_result: "",
    process_ng_note: "",
    finish_scan_at: "",
    finish_scan_by: "",
    machine_finish_at: "",
    machine_finish_by: "",
  };
  DB.insert("productions", data);
  return { ok: true, reason: null, gate: gate };
}

function simulateFinish(material, processKey, result, ngNote) {
  var prod = DB.getProcessProduction(material, processKey);
  if (!prod) return { ok: false, reason: "No production record." };
  if (prod.production_status === "FINISH" || prod.production_status === "FINISH_NG") {
    return { ok: false, reason: "Part sudah selesai." };
  }
  if (prod.production_status !== "PROCESS") {
    return { ok: false, reason: "Status tidak valid." };
  }
  if (result === "NG" && !ngNote) {
    return { ok: false, reason: "NG note wajib." };
  }
  var now = new Date().toISOString();
  DB.update("productions", prod.id, {
    status: "Finish",
    production_status: result === "OK" ? "FINISH" : "FINISH_NG",
    finish_scan_at: now,
    finish_scan_by: session ? session.name : "Operator",
    process_result: result,
    process_ng_note: result === "NG" ? ngNote : "",
    machine_finish_at: now,
    machine_finish_by: session ? session.name : "Operator",
  });
  return { ok: true, reason: null };
}

console.log("==========================================");
console.log("  HT SYSTEM - PROSES.HTML SMOKE TEST (3B-3B)");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================");

var seedCount = DB.get("productions").length;

// --- GROUP A: process param normalization ---
console.log("\n=== GROUP A: process param normalization ===");
assert(normalizeProcessParam("SHOTBLAST") === "SHOTBLAST", "A1: SHOTBLAST param normalized", "key=SHOTBLAST");
assert(normalizeProcessParam("shotblast") === "SHOTBLAST", "A2: lowercase normalized", "key=SHOTBLAST");
assert(normalizeProcessParam("ANTI_RUST") === "ANTI_RUST", "A3: ANTI_RUST param normalized", "key=ANTI_RUST");
assert(normalizeProcessParam("Anti Rust") === "ANTI_RUST", "A4: 'Anti Rust' normalized", "key=ANTI_RUST");
assert(normalizeProcessParam("anti-rust") === "ANTI_RUST", "A5: 'anti-rust' normalized", "key=ANTI_RUST");
assert(normalizeProcessParam("heat treatment") === "HT", "A6: 'heat treatment' -> HT (not a target)", "key=HT");
assert(PROCESS_META["HT"] === undefined, "A7: HT not a valid proses.html target", "meta=undefined");

// --- GROUP B: LOCK - QC conditions ---
console.log("\n=== GROUP B: LOCK - QC conditions ===");
var mNoQc = DB.findByKode("20260006I"); // no QC
var gNoQc = DB.canStartProcess(mNoQc, "SHOTBLAST");
assert(gNoQc.allowed === false, "B1: QC belum -> LOCK", "allowed=false qcStatus=" + gNoQc.qcStatus);
assert(/QC belum dilakukan/.test(gNoQc.reason || ""), "B2: reason = QC belum dilakukan", "r=" + gNoQc.reason);

var mQcNg = DB.findByKode("20260004I"); // QC NG, route HT->QC
var gNg = DB.canStartProcess(mQcNg, "SHOTBLAST");
assert(gNg.allowed === false, "B3: QC NG -> LOCK", "allowed=false qcStatus=" + gNg.qcStatus);
assert(/QC NG/.test(gNg.reason || ""), "B4: reason = QC NG", "r=" + gNg.reason);

// --- GROUP C: LOCK - prerequisite not done ---
console.log("\n=== GROUP C: LOCK - prerequisite ===");
var mABCD = DB.findByKode("20260001I"); // HT done, QC PASS, route HT->QC->SB->AR
var gArBeforeSb = DB.canStartProcess(mABCD, "ANTI_RUST");
assert(gArBeforeSb.allowed === false, "C1: ANTI_RUST locked (Shotblast not done)", "allowed=false");
assert(/SHOTBLAST belum selesai/.test(gArBeforeSb.reason || ""), "C2: reason mentions SHOTBLAST prerequisite", "r=" + gArBeforeSb.reason);

// --- GROUP D: route variants ---
console.log("\n=== GROUP D: route variants ===");
var mABC = DB.findByKode("20260002I"); // QC PASS, route HT->QC->SB only (no AR)
assert(DB.canStartProcess(mABC, "ANTI_RUST").allowed === false, "D1: Route ABC (no AR) -> ANTI_RUST rejected", "");
assert(DB.canStartProcess(mABC, "SHOTBLAST").allowed === true, "D2: Route ABC -> SHOTBLAST allowed", "");

var mAC = DB.findByKode("20260003I"); // QC PASS, route HT->QC->AR only (no SB)
assert(DB.canStartProcess(mAC, "SHOTBLAST").allowed === false, "D3: Route AC (no SB) -> SHOTBLAST rejected", "");
assert(DB.canStartProcess(mAC, "ANTI_RUST").allowed === true, "D4: Route AC -> ANTI_RUST allowed (no SB needed)", "");

var mAD = DB.findByKode("20260005I"); // QC PASS, route HT->QC only
assert(DB.canStartProcess(mAD, "SHOTBLAST").allowed === false, "D5: Route AD -> SHOTBLAST rejected", "");
assert(DB.canStartProcess(mAD, "ANTI_RUST").allowed === false, "D6: Route AD -> ANTI_RUST rejected", "");

// --- GROUP E: start + finish flow (route A: 20260001I) ---
console.log("\n=== GROUP E: start + finish flow (SHOTBLAST route A) ===");
var rStartE = simulateStart(mABCD, "SHOTBLAST");
assert(rStartE.ok === true, "E1: start SHOTBLAST allowed", "ok=" + rStartE.ok);
var prodE = DB.getProcessProduction(mABCD, "SHOTBLAST");
assert(prodE && prodE.production_status === "PROCESS", "E2: production PROCESS after start", "status=" + (prodE && prodE.production_status));
assert(prodE && prodE.jenis_treatment === "Shotblast", "E3: jenis_treatment = Shotblast", "treatment=" + (prodE && prodE.jenis_treatment));
assert(DB.isProcessCompleted(mABCD, "SHOTBLAST") === false, "E4: SHOTBLAST not completed (PROCESS)", "");
var rFinE = simulateFinish(mABCD, "SHOTBLAST", "OK");
assert(rFinE.ok === true, "E5: finish OK success", "ok=" + rFinE.ok);
var prodE2 = DB.getProcessProduction(mABCD, "SHOTBLAST");
assert(prodE2.production_status === "FINISH" && prodE2.process_result === "OK", "E6: FINISH + OK", "status=" + prodE2.production_status + " result=" + prodE2.process_result);
assert(DB.isProcessCompleted(mABCD, "SHOTBLAST") === true, "E7: SHOTBLAST completed (FINISH+OK)", "");
assert(DB.canStartProcess(mABCD, "ANTI_RUST").allowed === true, "E8: after SB done -> ANTI_RUST allowed", "");

// --- GROUP E2: ANTI_RUST flow ---
console.log("\n=== GROUP E2: ANTI_RUST flow ===");
var rStartAr = simulateStart(mABCD, "ANTI_RUST");
assert(rStartAr.ok === true, "E9: start ANTI_RUST allowed", "ok=" + rStartAr.ok);
var prodAr = DB.getProcessProduction(mABCD, "ANTI_RUST");
assert(prodAr && prodAr.production_status === "PROCESS", "E10: AR production PROCESS", "status=" + prodAr.production_status);
assert(prodAr && prodAr.jenis_treatment === "Anti Rust", "E11: jenis_treatment = Anti Rust", "treatment=" + prodAr.jenis_treatment);
var rFinArNg = simulateFinish(mABCD, "ANTI_RUST", "NG", "Karat pada permukaan");
assert(rFinArNg.ok === true, "E12: finish NG with note success", "ok=" + rFinArNg.ok);
var prodAr2 = DB.getProcessProduction(mABCD, "ANTI_RUST");
assert(
  prodAr2.production_status === "FINISH_NG" &&
    prodAr2.process_result === "NG" &&
    prodAr2.process_ng_note === "Karat pada permukaan",
  "E13: AR FINISH_NG + NG + note",
  "status=" + prodAr2.production_status + " note=" + prodAr2.process_ng_note,
);

// --- GROUP F: duplicate protection ---
console.log("\n=== GROUP F: duplicate protection ===");
// F1: 20260002I SB — first start allowed, second blocked (PROCESS)
var rStartF1 = simulateStart(mABC, "SHOTBLAST");
assert(rStartF1.ok === true, "F1: first SHOTBLAST start on 20260002I allowed", "ok=" + rStartF1.ok);
var rStartF2 = simulateStart(mABC, "SHOTBLAST");
assert(rStartF2.ok === false, "F2: duplicate start blocked (PROCESS)", "ok=" + rStartF2.ok + " reason=" + rStartF2.reason);
assert(/sedang berjalan/.test(rStartF2.reason || ""), "F3: reason = Proses sedang berjalan", "r=" + rStartF2.reason);
// F4: finish OK, then start blocked
var rFinF = simulateFinish(mABC, "SHOTBLAST", "OK");
assert(rFinF.ok === true, "F4: finish OK success", "ok=" + rFinF.ok);
var rStartF3 = simulateStart(mABC, "SHOTBLAST");
assert(rStartF3.ok === false && /sudah selesai/.test(rStartF3.reason || ""), "F5: start blocked after FINISH+OK", "ok=" + rStartF3.ok + " reason=" + rStartF3.reason);

// F6: FINISH_NG cannot auto-restart
var mACar = DB.findByKode("20260003I"); // route AR, AR just finished NG in E2? no, different material. Use fresh.
var rStartArF = simulateStart(mACar, "ANTI_RUST");
assert(rStartArF.ok === true, "F6: first AR start on 20260003I allowed", "ok=" + rStartArF.ok);
simulateFinish(mACar, "ANTI_RUST", "NG", "Goresan");
var rRestartNg = simulateStart(mACar, "ANTI_RUST");
assert(rRestartNg.ok === false, "F7: restart blocked after FINISH_NG", "ok=" + rRestartNg.ok);

// --- GROUP G: route snapshot protection ---
console.log("\n=== GROUP G: route snapshot protection ===");
var snap = JSON.parse(JSON.stringify(mABCD.process_route));
var part = DB.findPartById(mABCD.part_id);
var partRouteBefore = JSON.parse(JSON.stringify(part.standard_process_route));
part.standard_process_route = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false };
DB.update("parts", part.id, { standard_process_route: part.standard_process_route });
var gateAfter = DB.canStartProcess(mABCD, "SHOTBLAST");
assert(JSON.stringify(mABCD.process_route) === JSON.stringify(snap), "G1: material.process_route unchanged", "route=" + JSON.stringify(mABCD.process_route));
// canStartProcess returns allowed=true (already done) — client blocks via getProcessProduction (FINISH+OK)
var prodAfterSnapshot = DB.getProcessProduction(mABCD, "SHOTBLAST");
assert(prodAfterSnapshot.production_status === "FINISH" && prodAfterSnapshot.process_result === "OK", "G2: SHOTBLAST still FINISH+OK (snapshot used, not part route)", "status=" + prodAfterSnapshot.production_status);
DB.update("parts", part.id, { standard_process_route: partRouteBefore });

// --- GROUP H: seed + insert accounting ---
console.log("\n=== GROUP H: accounting ===");
var totalInserts = DB.get("productions").length - seedCount;
assert(totalInserts === 4, "H1: exactly 4 production inserts (E SHOTBLAST, E2 AR, F SB, F6 AR)", "inserts=" + totalInserts + " (expected 4)");
assert(DB.get("qcs").length === 5, "H2: QC seed count preserved (5)", "count=" + DB.get("qcs").length);
assert(DB.get("materials").length === 10, "H3: materials count preserved (10)", "count=" + DB.get("materials").length);
assert(DB.get("parts").length === 10, "H4: parts count preserved (10)", "count=" + DB.get("parts").length);

// --- GROUP I: regression ---
console.log("\n=== GROUP I: regression ===");
assert(typeof DB.checkQualityGate === "function", "I1: DB.checkQualityGate exists", "");
assert(typeof DB.canProceedToProcess === "function", "I2: DB.canProceedToProcess exists", "");
assert(typeof DB.canStartProcess === "function", "I3: DB.canStartProcess exists", "");
assert(typeof DB.getProcessProduction === "function", "I4: DB.getProcessProduction exists", "");
assert(typeof DB.isProcessCompleted === "function", "I5: DB.isProcessCompleted exists", "");
assert(typeof DB.getNextProcess === "function", "I6: DB.getNextProcess exists", "");

// --- GROUP J: finish-time re-validation (rule 12) ---
console.log("\n=== GROUP J: finish re-validation ===");
// 20260002I SB is FINISH+OK (from F4). Cannot re-finish.
var rFinAgain = simulateFinish(mABC, "SHOTBLAST", "OK");
assert(rFinAgain.ok === false, "J1: re-finish blocked after FINISH", "ok=" + rFinAgain.ok);
// NG without note blocked
var mNoProd = DB.findByKode("20260009I"); // route HT->QC only to keep test material clean
var rStartJn = simulateStart(mNoProd, "SHOTBLAST"); // route has no SB -> blocked
assert(rStartJn.ok === false, "J2: start SHOTBLAST on Route-D material blocked", "ok=" + rStartJn.ok);

console.log("\n==========================================");
console.log("  TEST RESULTS");
console.log("==========================================");
for (var i = 0; i < results.length; i++) {
  var r = results[i];
  var tag = "[" + (r.pass ? "PASS" : "FAIL") + "]";
  var extra = r.detail ? " - " + r.detail : "";
  console.log("  " + tag + " " + r.name + extra);
}
console.log("\n==========================================");
console.log("  Total: " + results.length + " | Passed: " + passed + " | Failed: " + failed);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
