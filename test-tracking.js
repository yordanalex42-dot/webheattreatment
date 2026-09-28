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
  const dbCode = fs
    .readFileSync(path.join(__dirname, "js", "db.js"), "utf8")
    .replace("const DB", "var DB");
  DB = new Function("localStorage", dbCode + "\n; return DB;")(
    global.localStorage,
  );
  DB.init();
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

var _testCounter = 0;

function buildMaterial(db, opts) {
  opts = opts || {};
  _testCounter++;
  const route = opts.route || { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false };
  const mat = db.insert("materials", {
    kode: opts.kode || ("TRK" + _testCounter + Date.now()),
    customer_id: 1,
    part_id: 1,
    process_route: route,
    qty: opts.qty || 10,
    berat_part_snapshot: 2.5,
    berat_total_part: 25,
  });
  const steps = db._processRouteToSteps(route);
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
      catatan: opts.qcCatatan || "",
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

const ROUTE_A = { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true };
const ROUTE_B = { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: false };
const ROUTE_C = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: true };
const ROUTE_D = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false };

console.log("==========================================");
console.log("  HT SYSTEM - TRACKING MULTI-PROCESS TESTS");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================\n");

console.log("=== GROUP A: Route-aware timeline (getProcessHistory) ===");
setupFresh();
const matA1 = buildMaterial(DB, { kode: "TRKA01", route: ROUTE_A, qc: "OK" });
const histA1 = DB.getProcessHistory(matA1);
assert(
  histA1.length === 4,
  "A1: Route A history has 4 steps (HT+QC+SB+AR)",
  "steps=" + histA1.length,
);
assert(
  histA1[0].process === "HT" && histA1[1].process === "QC" &&
  histA1[2].process === "SHOTBLAST" && histA1[3].process === "ANTI_RUST",
  "A2: Route A step order is HT→QC→SHOTBLAST→ANTI_RUST",
  "steps=" + JSON.stringify(histA1.map(h => h.process)),
);
const matA3 = buildMaterial(DB, { kode: "TRKA03", route: ROUTE_D, qc: "OK" });
const histA3 = DB.getProcessHistory(matA3);
assert(
  histA3.length === 2,
  "A3: Route D history has 2 steps (HT+QC only)",
  "steps=" + histA3.length,
);

console.log("\n=== GROUP B: QC by material_id ===");
setupFresh();
const matB1 = buildMaterial(DB, { kode: "TRKB01", route: ROUTE_D, qc: "OK" });
const matB2 = buildMaterial(DB, { kode: "TRKB02", route: ROUTE_D, qc: "NG" });
const gateB1 = DB.canDeliver(matB1);
const gateB2 = DB.canDeliver(matB2);
assert(
  gateB1.qcStatus === "PASS",
  "B1: QC OK looked up by material_id -> qcStatus=PASS",
  "qcStatus=" + gateB1.qcStatus,
);
assert(
  gateB2.qcStatus === "NG",
  "B2: QC NG looked up by material_id -> qcStatus=NG",
  "qcStatus=" + gateB2.qcStatus,
);
const histB1 = DB.getProcessHistory(matB1);
const qcEntry = histB1.find(h => h.process === "QC" || h.process === "QC_CHECK");
assert(
  qcEntry && qcEntry.status === "PASS" && qcEntry.completed === true,
  "B3: History QC entry status=PASS, completed=true",
  "status=" + (qcEntry ? qcEntry.status : "null"),
);

console.log("\n=== GROUP C: Premature delivery prevention ===");
setupFresh();
const matC1 = buildMaterial(DB, {
  kode: "TRKC01", route: ROUTE_A, qc: "OK", delivery: true,
  processes: {
    HT: { status: "FINISH", result: "OK" },
    SHOTBLAST: { status: "WAITING", result: "" },
    ANTI_RUST: { status: "WAITING", result: "" },
  },
});
const gateC1 = DB.canDeliver(matC1);
assert(
  gateC1.allowed === false,
  "C1: Route A incomplete + delivery -> canDeliver=false",
  "allowed=" + gateC1.allowed + " reason=" + (gateC1.reason || "-"),
);
assert(
  gateC1.reason === "Proses SHOTBLAST belum selesai",
  "C2: Reason: SHOTBLAST not done (not 'sudah dikirim')",
  "reason=" + gateC1.reason,
);
assert(
  gateC1.qcStatus === "PASS",
  "C3: QC PASS even though route incomplete",
  "qcStatus=" + gateC1.qcStatus,
);

console.log("\n=== GROUP D: Seed material 1001 premature delivery ===");
setupFresh();
const seedMat1001 = DB.findByKote ? null : DB.findByKode("20260001I");
const gateD1 = DB.canDeliver(seedMat1001);
assert(
  gateD1.allowed === false,
  "D1: Seed 20260001I (Route A, only HT done) -> canDeliver=false",
  "allowed=" + gateD1.allowed + " reason=" + (gateD1.reason || "-"),
);
assert(
  gateD1.reason.includes("belum selesai"),
  "D2: Reason mentions belum selesai (not 'sudah dikirim')",
  "reason=" + gateD1.reason,
);
assert(
  !gateD1.reason.includes("sudah dikirim"),
  "D3: NOT 'sudah dikirim' (route incomplete, not delivered)",
  "reason=" + gateD1.reason,
);
const deliveriesFor1001 = DB.get("deliveries").filter(d => String(d.material_id) === String(seedMat1001.id));
assert(
  deliveriesFor1001.length === 1,
  "D4: Delivery 4001 exists by material_id",
  "count=" + deliveriesFor1001.length,
);

console.log("\n=== GROUP E: Legitimate delivery ===");
setupFresh();
const matE1 = buildMaterial(DB, { kode: "TRKE01", route: ROUTE_A, qc: "OK" });
const gateE1a = DB.canDeliver(matE1);
assert(
  gateE1a.allowed === true,
  "E1: Route A complete + QC OK + no delivery -> canDeliver=true",
  "allowed=" + gateE1a.allowed,
);
DB.insert("deliveries", { material_id: matE1.id, production_id: 0, tanggal_kirim: "2026-09-05", qty_kirim: 10, status: "Delivered" });
const gateE1b = DB.canDeliver(matE1);
assert(
  gateE1b.allowed === false && gateE1b.reason === "Material sudah dikirim",
  "E2: After delivery insert -> canDeliver=false, reason='sudah dikirim'",
  "allowed=" + gateE1b.allowed + " reason=" + (gateE1b.reason || "-"),
);

console.log("\n=== GROUP F: Current process detection ===");
setupFresh();
const matF1 = buildMaterial(DB, {
  kode: "TRKF01", route: ROUTE_D, qc: "OK",
  processes: { HT: { status: "FINISH", result: "OK" } },
});
assert(
  DB.getCurrentProcess(matF1) === null,
  "F1: Route D, HT done, no more steps -> currentProcess=null",
  "cur=" + DB.getCurrentProcess(matF1),
);
const matF2 = buildMaterial(DB, {
  kode: "TRKF02", route: ROUTE_A, qc: "OK",
  processes: { HT: { status: "FINISH", result: "OK" }, SHOTBLAST: { status: "PROCESS", result: "OK" } },
});
assert(
  DB.getCurrentProcess(matF2) === "SHOTBLAST",
  "F2: Route A, SB in PROCESS -> currentProcess=SHOTBLAST",
  "cur=" + DB.getCurrentProcess(matF2),
);
const matF3 = buildMaterial(DB, {
  kode: "TRKF03", route: ROUTE_A, qc: "OK",
  processes: { HT: { status: "FINISH", result: "OK" }, SHOTBLAST: { status: "FINISH", result: "OK" }, ANTI_RUST: { status: "PROCESS", result: "OK" } },
});
assert(
  DB.getCurrentProcess(matF3) === "ANTI_RUST",
  "F3: Route A, AR in PROCESS -> currentProcess=ANTI_RUST",
  "cur=" + DB.getCurrentProcess(matF3),
);

console.log("\n=== GROUP G: FINISH_NG in process ===");
setupFresh();
const matG1 = buildMaterial(DB, {
  kode: "TRKG01", route: ROUTE_A, qc: "OK",
  processes: { HT: { status: "FINISH_NG", result: "NG" } },
});
const histG1 = DB.getProcessHistory(matG1);
const htStep = histG1.find(h => h.process === "HT");
assert(
  htStep && htStep.status === "FINISH_NG" && htStep.completed === false,
  "G1: HT FINISH_NG -> status=FINISH_NG, completed=false",
  "status=" + (htStep ? htStep.status : "null"),
);
const gateG1 = DB.canDeliver(matG1);
assert(
  gateG1.allowed === false && gateG1.reason.includes("NG"),
  "G2: canDeliver=false (NG in route)",
  "reason=" + gateG1.reason,
);

console.log("\n=== GROUP H: QC NG blocks delivery ===");
setupFresh();
const matH1 = buildMaterial(DB, {
  kode: "TRKH01", route: ROUTE_A, qc: "NG",
  processes: { HT: { status: "FINISH", result: "OK" }, SHOTBLAST: { status: "FINISH", result: "OK" }, ANTI_RUST: { status: "FINISH", result: "OK" } },
});
const gateH1 = DB.canDeliver(matH1);
assert(
  gateH1.allowed === false && gateH1.qcStatus === "NG",
  "H1: All route done but QC NG -> canDeliver=false, qcStatus=NG",
  "allowed=" + gateH1.allowed + " qcStatus=" + gateH1.qcStatus,
);
assert(
  gateH1.reason === "QC NG",
  "H2: Reason='QC NG' (not route-related)",
  "reason=" + gateH1.reason,
);

console.log("\n=== GROUP I: Backward compatibility (Route D = HT→QC) ===");
setupFresh();
const matI1 = buildMaterial(DB, { kode: "TRKI01", route: ROUTE_D, qc: "OK" });
const histI1 = DB.getProcessHistory(matI1);
assert(
  histI1.length === 2 && histI1[0].process === "HT" && histI1[1].process === "QC",
  "I1: Route D history = HT + QC only",
  "steps=" + JSON.stringify(histI1.map(h => h.process)),
);
const gateI1 = DB.canDeliver(matI1);
assert(
  gateI1.allowed === true && gateI1.processRouteSteps.length === 2,
  "I2: Route D complete + QC OK -> canDeliver=true, steps=2",
  "allowed=" + gateI1.allowed + " steps=" + JSON.stringify(gateI1.processRouteSteps),
);

console.log("\n=== GROUP J: Multi-production distinction ===");
setupFresh();
const matJ1 = buildMaterial(DB, {
  kode: "TRKJ01", route: ROUTE_A, qc: "OK",
  processes: {
    HT: { status: "FINISH", result: "OK" },
    SHOTBLAST: { status: "FINISH", result: "NG", }, 
    ANTI_RUST: { status: "PROCESS", result: "OK" },
  },
});
const histJ1 = DB.getProcessHistory(matJ1);
const sbStep = histJ1.find(h => h.process === "SHOTBLAST");
const arStep = histJ1.find(h => h.process === "ANTI_RUST");
assert(
  sbStep && sbStep.status === "FINISH_NG" && sbStep.production && sbStep.production.process_result === "NG",
  "J1: SHOTBLAST production found and FINISH_NG",
  "status=" + (sbStep ? sbStep.status : "null"),
);
assert(
  arStep && arStep.status === "PROCESS" && arStep.production && arStep.production.production_status === "PROCESS",
  "J2: ANTI_RUST production found and PROCESS",
  "status=" + (arStep ? arStep.status : "null"),
);
assert(
  DB.getProcessProduction(matJ1, "HT").production_status === "FINISH",
  "J3: getProcessProduction(HT) returns HT production (not SB or AR)",
  "status=" + DB.getProcessProduction(matJ1, "HT").production_status,
);
assert(
  DB.getProcessProduction(matJ1, "SHOTBLAST").jenis_treatment === "Shotblast",
  "J4: getProcessProduction(SHOTBLAST) returns SB production",
  "treatment=" + DB.getProcessProduction(matJ1, "SHOTBLAST").jenis_treatment,
);
assert(
  DB.getProcessProduction(matJ1, "ANTI_RUST").jenis_treatment === "Anti Rust",
  "J5: getProcessProduction(ANTI_RUST) returns AR production",
  "treatment=" + DB.getProcessProduction(matJ1, "ANTI_RUST").jenis_treatment,
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
    failed,
);
console.log("==========================================");
if (failed > 0) process.exit(1);
