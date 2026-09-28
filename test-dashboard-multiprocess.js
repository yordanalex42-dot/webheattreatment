/* ============================================================
   DASHBOARD MULTI-PROCESS TEST (Tahap 3B-3C-1)
   Verifies HTDashboard computes status, relations, and chart
   data correctly for multi-process materials.
   Uses buildMaterial fixture-builder pattern with isolated
   MemoryStorage per test group.
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

let DB;
let HTDashboard;
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

const ROUTE_A = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false };
const ROUTE_B = { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: false };
const ROUTE_C = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: true };
const ROUTE_D = { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true };

var _testCounter = 0;

function setupFresh() {
  global.localStorage = new MemoryStorage();

  const authCode = fs
    .readFileSync(path.join(__dirname, "js", "auth.js"), "utf8")
    .replace("const Auth", "var Auth");
  const authFn = new Function("localStorage", authCode + "\n; return Auth;")(global.localStorage);
  authFn.initDefaultUser();

  const dbCode = fs
    .readFileSync(path.join(__dirname, "js", "db.js"), "utf8")
    .replace("const DB", "var DB");
  DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);
  DB.init();

  global.window = { addEventListener: function () { return; } };
  global.document = {
    documentElement: { style: { getPropertyValue: function () { return ""; } } },
    body: { style: {}, getBoundingClientRect: function () { return { width: 0 }; } },
    getElementById: function () { return null; },
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} } }; },
  };
  global.Chart = function () { this.destroy = function () {}; };
  global.HTUI = { requireAuth: function () { return true; }, initDate: function () {}, toast: function () {} };
  global.XLSX = {
    utils: {
      json_to_sheet: function () { return {}; },
      book_new: function () { return {}; },
      book_append_sheet: function () {},
    },
    writeFile: function () {},
  };

  const dashCode = fs
    .readFileSync(path.join(__dirname, "js", "dashboard.js"), "utf8")
    .replace("const HTDashboard", "var HTDashboard");
  HTDashboard = new Function("localStorage", "DB", dashCode + "\n; return HTDashboard;")(global.localStorage, DB);

  HTDashboard._cacheData();
  return { DB, HTDashboard };
}

function buildMaterial(db, opts) {
  opts = opts || {};
  _testCounter++;
  if (HTDashboard) HTDashboard._cacheData();
  const result = doBuildMaterial(db, opts);
  if (HTDashboard) HTDashboard._cacheData();
  return result;
}

function doBuildMaterial(db, opts) {
  opts = opts || {};
  const route = opts.route || { ...ROUTE_A };
  const steps = db._processRouteToSteps(route);
  const mat = db.insert("materials", {
    kode: opts.kode || ("DASH" + _testCounter + Date.now()),
    customer_id: 1,
    part_id: 1,
    process_route: route,
    qty: opts.qty || 10,
    berat_part_snapshot: 2.5,
    berat_total_part: 25,
  });
  const processStates = opts.processes || {};
  steps.forEach(function (step) {
    if (step === "QC" || step === "QC_CHECK") return;
    var state = processStates[step] || { status: "FINISH", result: "OK" };
    var jenisTreatment;
    if (step === "HT") jenisTreatment = "Heat Treatment";
    else if (step === "SHOTBLAST") jenisTreatment = "Shotblast";
    else if (step === "ANTI_RUST") jenisTreatment = "Anti Rust";
    else jenisTreatment = step;
    db.insert("productions", {
      material_id: mat.id,
      jenis_treatment: jenisTreatment,
      process_type: jenisTreatment,
      production_status: state.status,
      status: state.status === "FINISH" ? "Finish" : (state.status === "PROCESS" ? "Process" : "Waiting"),
      process_result: state.result || "",
      process_ng_note: state.result === "NG" ? "Test NG note" : "",
      start_scan_at: state.status !== "WAITING" ? "2026-09-01T08:00:00" : "",
      start_scan_by: "Test Operator",
      finish_scan_at: (state.status === "FINISH" || state.status === "FINISH_NG") ? "2026-09-01T10:00:00" : "",
      finish_scan_by: (state.status === "FINISH" || state.status === "FINISH_NG") ? "Test Operator" : "",
      machine_start_at: state.status !== "WAITING" ? "2026-09-01T08:05:00" : "",
      machine_start_by: "Test Operator",
      machine_finish_at: (state.status === "FINISH" || state.status === "FINISH_NG") ? "2026-09-01T10:05:00" : "",
      machine_finish_by: (state.status === "FINISH" || state.status === "FINISH_NG") ? "Test Operator" : "",
      visual_check_result: "OK",
      tanggal_proses: "2026-09-01",
    });
  });
  if (opts.qc !== undefined) {
    db.insert("qcs", {
      material_id: mat.id,
      production_id: 0,
      hardness: "60",
      satuan_hardness: "HRC",
      hasil: opts.qc,
      inspector: "Test Inspector",
      tanggal_inspector: "2026-09-02",
    });
  }
  if (opts.delivery) {
    db.insert("deliveries", {
      material_id: mat.id,
      production_id: opts.delivery.production_id || 0,
      tanggal_kirim: "2026-09-03",
      qty_kirim: opts.delivery.qty || mat.qty,
      status: "Delivered",
      catatan: opts.delivery.catatan || "",
    });
  }
  return mat;
}

console.log("==========================================");
console.log("  HT SYSTEM - DASHBOARD MULTI-PROCESS TEST (3B-3C-1)");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================");

// === GROUP A: _hasRoute / _isMaterialProductionComplete ===
console.log("\n=== GROUP A: _hasRoute / _isMaterialProductionComplete ===");
setupFresh();

const matA1 = buildMaterial(DB, { kode: "DASHA01", route: ROUTE_A, qc: "OK" });
assert(
  HTDashboard._hasRoute(matA1) === true,
  "A1: _hasRoute=true for material with process_route",
  ""
);
assert(
  HTDashboard._isMaterialProductionComplete(matA1) === true,
  "A2: Route A complete + QC OK -> _isMaterialProductionComplete=true",
  ""
);

const matA2 = buildMaterial(DB, { kode: "DASHA02", route: ROUTE_D, qc: "OK" });
assert(
  HTDashboard._isMaterialProductionComplete(matA2) === true,
  "A3: Route D complete + QC OK -> _isMaterialProductionComplete=true",
  ""
);

const matA3 = buildMaterial(DB, { kode: "DASHA03", route: ROUTE_D, qc: "OK", processes: { HT: { status: "PROCESS", result: "OK" }, SHOTBLAST: { status: "FINISH", result: "OK" }, ANTI_RUST: { status: "FINISH", result: "OK" } } });
assert(
  HTDashboard._isMaterialProductionComplete(matA3) === false,
  "A4: Route D, HT in PROCESS -> _isMaterialProductionComplete=false",
  ""
);

const matA4 = buildMaterial(DB, { kode: "DASHA04", route: ROUTE_A, qc: "NG" });
assert(
  HTDashboard._isMaterialProductionComplete(matA4) === false,
  "A5: QC NG -> _isMaterialProductionComplete=false",
  ""
);

// === GROUP B: _getRelations multi-process structure ===
console.log("\n=== GROUP B: _getRelations multi-process ===");
setupFresh();

const matB1 = buildMaterial(DB, { kode: "DASHB01", route: ROUTE_D, qc: "OK" });
const relB1 = HTDashboard._getRelations(matB1);
assert(
  Array.isArray(relB1.history) && relB1.history.length === 4,
  "B1: history has 4 steps for Route D (HT,QC,SB,AR)",
  "history.length=" + relB1.history.length
);
assert(
  relB1.history[0].process === "HT" && relB1.history[0].status === "FINISH" && relB1.history[0].completed === true,
  "B2: HT step completed=true",
  "status=" + relB1.history[0].status + " completed=" + relB1.history[0].completed
);
assert(
  relB1.history[1].process === "QC" && relB1.history[1].completed === true,
  "B3: QC step completed=true (qcStatus=PASS)",
  "qc=" + relB1.history[1].status
);
assert(
  relB1.currentProcess === null && relB1.routeCompleted === true,
  "B4: routeCompleted=true, currentProcess=null for complete route",
  "routeCompleted=" + relB1.routeCompleted + " currentProcess=" + relB1.currentProcess
);

const matB2 = buildMaterial(DB, { kode: "DASHB02", route: ROUTE_D, qc: "OK", processes: { HT: { status: "PROCESS", result: "OK" } } });
const relB2 = HTDashboard._getRelations(matB2);
assert(
  relB2.currentProcess === "HT" && relB2.routeCompleted === false,
  "B5: HT in PROCESS -> currentProcess=HT, routeCompleted=false",
  "currentProcess=" + relB2.currentProcess + " routeCompleted=" + relB2.routeCompleted
);
assert(
  relB2.prod !== null && relB2.prod.production_status === "PROCESS",
  "B6: prod is the HT production in PROCESS",
  "prod.status=" + (relB2.prod ? relB2.prod.production_status : "null")
);

// === GROUP C: _getRelations QC/Delivery keyed by material_id ===
console.log("\n=== GROUP C: _getRelations QC/Delivery keyed by material_id ===");
setupFresh();

const matC1 = buildMaterial(DB, { kode: "DASHC01", route: ROUTE_A, qc: "OK", delivery: true });
const relC1 = HTDashboard._getRelations(matC1);
assert(
  relC1.qc !== null && relC1.qc.hasil === "OK",
  "C1: qc found by material_id",
  "qc=" + (relC1.qc ? relC1.qc.hasil : "null")
);
assert(
  relC1.del !== null && relC1.del.tanggal_kirim === "2026-09-03",
  "C2: del found by material_id",
  "del=" + (relC1.del ? relC1.del.tanggal_kirim : "null")
);

const matC2 = buildMaterial(DB, { kode: "DASHC02", route: ROUTE_A, qc: "OK" });
const relC2 = HTDashboard._getRelations(matC2);
assert(
  relC2.qc !== null,
  "C3: qc found for material without delivery (keyed by material_id, not production_id)",
  ""
);
assert(
  relC2.del === null,
  "C4: del is null when no delivery exists",
  ""
);

// === GROUP D: computePartStatus multi-process ===
console.log("\n=== GROUP D: computePartStatus multi-process ===");
setupFresh();

const matD1 = buildMaterial(DB, { kode: "DASHD01", route: ROUTE_A, qc: "OK", delivery: true });
assert(
  HTDashboard.computePartStatus(matD1) === "DELIVERY",
  "D1: Delivered material -> DELIVERY",
  ""
);

const matD2 = buildMaterial(DB, { kode: "DASHD02", route: ROUTE_A, qc: "OK" });
assert(
  HTDashboard.computePartStatus(matD2) === "READY DELIVERY",
  "D2: Route complete + QC OK + no delivery -> READY DELIVERY",
  ""
);

const matD3 = buildMaterial(DB, { kode: "DASHD03", route: ROUTE_D, qc: "OK", processes: { HT: { status: "PROCESS", result: "OK" } } });
assert(
  HTDashboard.computePartStatus(matD3) === "PROSES PRODUKSI",
  "D3: HT in PROCESS + QC OK -> PROSES PRODUKSI (not prematurely READY DELIVERY)",
  ""
);

const matD4 = buildMaterial(DB, { kode: "DASHD04", route: ROUTE_D, qc: "OK", processes: { HT: { status: "FINISH", result: "OK" }, SHOTBLAST: { status: "FINISH", result: "OK" }, ANTI_RUST: { status: "PROCESS", result: "OK" } } });
assert(
  HTDashboard.computePartStatus(matD4) === "PROSES PRODUKSI",
  "D4: AR in PROCESS -> PROSES PRODUKSI (route not complete yet)",
  ""
);

const matD5 = buildMaterial(DB, { kode: "DASHD05", route: ROUTE_A, qc: "NG" });
assert(
  HTDashboard.computePartStatus(matD5) === "QC - NG",
  "D5: QC NG -> QC - NG",
  ""
);

const matD6 = buildMaterial(DB, { kode: "DASHD06", route: ROUTE_A });
assert(
  HTDashboard.computePartStatus(matD6) === "QC",
  "D6: Route complete but no QC -> QC (NOT_CHECKED)",
  ""
);

const matD7 = buildMaterial(DB, { kode: "DASHD07", route: ROUTE_D, qc: "OK", processes: { HT: { status: "FINISH_NG", result: "NG" } } });
assert(
  HTDashboard.computePartStatus(matD7) === "PRODUKSI - NG",
  "D7: HT FINISH_NG -> PRODUKSI - NG",
  ""
);

// === GROUP E: computePartStatus backward compatibility (single-process) ===
console.log("\n=== GROUP E: computePartStatus backward compatibility ===");
setupFresh();

const matE1 = DB.insert("materials", {
  kode: "DASHE01",
  customer_id: 1,
  part_id: 1,
  qty: 10,
  berat_part_snapshot: 2.5,
  berat_total_part: 25,
});
DB.insert("productions", {
  material_id: matE1.id,
  jenis_treatment: "Heat Treatment",
  production_status: "FINISH",
  status: "Finish",
  process_result: "OK",
  tanggal_proses: "2026-09-01",
});
DB.insert("qcs", {
  material_id: matE1.id,
  production_id: 0,
  hasil: "OK",
  inspector: "Test",
  tanggal_inspector: "2026-09-02",
  });
  HTDashboard._cacheData();
  assert(
    HTDashboard.computePartStatus(matE1) === "READY DELIVERY",
    "E1: Single-process FINISH + QC OK -> READY DELIVERY",
    ""
  );

  const matE2 = DB.insert("materials", {
  kode: "DASHE02",
  customer_id: 1,
  part_id: 1,
  qty: 10,
  berat_part_snapshot: 2.5,
  berat_total_part: 25,
});
DB.insert("productions", {
  material_id: matE2.id,
  jenis_treatment: "Heat Treatment",
  production_status: "PROCESS",
  status: "Process",
  process_result: "",
  tanggal_proses: "2026-09-01",
  });
  HTDashboard._cacheData();
  assert(
    HTDashboard.computePartStatus(matE2) === "PROSES PRODUKSI",
    "E2: Single-process PROCESS -> PROSES PRODUKSI",
    ""
  );

  const matE3 = DB.insert("materials", {
  kode: "DASHE03",
  customer_id: 1,
  part_id: 1,
  qty: 10,
  status_proses: "Process",
  });
  HTDashboard._cacheData();
  assert(
    HTDashboard.computePartStatus(matE3) === "PROSES PRODUKSI",
    "E3: No production, status_proses=Process -> PROSES PRODUKSI",
    ""
  );

  const matE4 = DB.insert("materials", {
  kode: "DASHE04",
  customer_id: 1,
  part_id: 1,
  qty: 10,
});
assert(
  HTDashboard.computePartStatus(matE4) === "INCOMING",
  "E4: No production, no status_proses -> INCOMING",
  ""
);

// === GROUP F: _getProductionChartData uses route completion ===
console.log("\n=== GROUP F: _getProductionChartData ===");
setupFresh();

const matF1 = buildMaterial(DB, { kode: "DASHF01", route: ROUTE_A, qc: "OK", processes: { HT: { status: "FINISH", result: "OK" } } });
const dataF1 = HTDashboard._getProductionChartData();
assert(
  dataF1["2026-09-01"] === 25,
  "F1: Route complete + QC OK -> weight counted in chart",
  "value=" + (dataF1["2026-09-01"] || 0)
);
assert(
  dataF1["2026-09-01"] !== undefined,
  "F2: Chart data includes date from completed material",
  ""
);

setupFresh();
const matF2 = buildMaterial(DB, { kode: "DASHF02", route: ROUTE_D, qc: "OK", processes: { HT: { status: "PROCESS", result: "OK" } } });
const matF2b = buildMaterial(DB, { kode: "DASHF02B", route: ROUTE_A, qc: "OK" });
const dataF2 = HTDashboard._getProductionChartData();
assert(
  dataF2["2026-09-01"] === 25,
  "F3: Only route-complete material counted (F2 excluded, F2b included)",
  "value=" + (dataF2["2026-09-01"] || 0)
);

// === GROUP G: _getRelations prod fallback for completed routes ===
console.log("\n=== GROUP G: _getRelations prod fallback ===");
setupFresh();

const matG1 = buildMaterial(DB, { kode: "DASHG01", route: ROUTE_A, qc: "OK" });
const relG1 = HTDashboard._getRelations(matG1);
assert(
  relG1.prod !== null && relG1.prod.production_status === "FINISH",
  "G1: Completed route -> prod is last FINISH production",
  "prod.status=" + (relG1.prod ? relG1.prod.production_status : "null")
);

const matG2 = buildMaterial(DB, { kode: "DASHG02", route: ROUTE_B, qc: "OK", processes: { HT: { status: "FINISH", result: "OK" }, SHOTBLAST: { status: "PROCESS", result: "OK" } } });
const relG2 = HTDashboard._getRelations(matG2);
assert(
  relG2.currentProcess === "SHOTBLAST" && relG2.prod !== null && relG2.prod.production_status === "PROCESS",
  "G2: SB in PROCESS -> currentProcess=SHOTBLAST, prod=SHOTBLAST production",
  "currentProcess=" + relG2.currentProcess + " prod.status=" + (relG2.prod ? relG2.prod.production_status : "null")
);

// === GROUP H: prodMap is array for multiple productions ===
console.log("\n=== GROUP H: prodMap is array ===");
setupFresh();

const matH1 = buildMaterial(DB, { kode: "DASHH01", route: ROUTE_D, qc: "OK" });
assert(
  Array.isArray(HTDashboard._data.prodMap[matH1.id]) && HTDashboard._data.prodMap[matH1.id].length === 3,
  "H1: prodMap[material_id] is array with 3 productions for Route D",
  "length=" + (HTDashboard._data.prodMap[matH1.id] ? HTDashboard._data.prodMap[matH1.id].length : "null")
);

console.log("\n==========================================");
console.log("  TEST RESULTS");
console.log("==========================================");
for (const r of results) {
  const icon = r.pass ? "PASS" : "FAIL";
  console.log("  [" + icon + "] " + r.name + (r.detail ? " - " + r.detail : ""));
}
console.log("==========================================");
console.log(
  "  Total: " +
    results.length +
    " | Passed: " +
    passed +
    " | Failed: " +
    failed +
    " ",
);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
