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

const ROUTE_A = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false };
const ROUTE_B = { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: false };
const ROUTE_C = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: true };
const ROUTE_D = { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true };

var _testCounter = 0;

function buildMaterial(db, opts) {
  opts = opts || {};
  _testCounter++;
  const route = opts.route || { ...ROUTE_A };
  const steps = db._processRouteToSteps(route);
  const mat = db.insert("materials", {
    kode: opts.kode || ("DLV" + _testCounter + Date.now()),
    customer_id: 1,
    part_id: 1,
    process_route: route,
    qty: opts.qty || 10,
    berat_part_snapshot: 2.5,
    berat_total_part: 25,
  });
  const processStates = opts.processes || {};
  steps.forEach(function(step) {
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
console.log("  HT SYSTEM - DELIVERY QUALITY GATE TESTS (Tahap 3B-3C-2)");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================\n");

console.log("=== GROUP A: QC belum dilakukan (NOT_CHECKED) ===");
setupFresh();
const matA1 = buildMaterial(DB, { kode: "DLVA01", route: ROUTE_A });
const gateA1 = DB.canDeliver(matA1);
assert(
  gateA1.allowed === false,
  "A1: QC not checked -> canDeliver=false",
  "allowed=" + gateA1.allowed + " reason=" + (gateA1.reason || "-")
);
assert(
  gateA1.qcStatus === "NOT_CHECKED",
  "A2: QC not checked -> qcStatus=NOT_CHECKED",
  "qcStatus=" + gateA1.qcStatus
);
const matA3 = buildMaterial(DB, { kode: "DLVA03", route: ROUTE_D });
const gateA3 = DB.canDeliver(matA3);
assert(
  gateA3.qcStatus === "NOT_CHECKED",
  "A3: Route D, no QC -> NOT_CHECKED",
  "qcStatus=" + gateA3.qcStatus
);
assert(
  matA1.qcStatus === undefined && gateA1.reason === "QC belum dilakukan",
  "A4: Reason is 'QC belum dilakukan'",
  "reason=" + gateA1.reason
);

console.log("\n=== GROUP B: QC NG ===");
setupFresh();
const matB1 = buildMaterial(DB, { kode: "DLVB01", route: ROUTE_A, qc: "NG" });
const gateB1 = DB.canDeliver(matB1);
assert(
  gateB1.allowed === false,
  "B1: QC NG -> canDeliver=false",
  "allowed=" + gateB1.allowed + " qcStatus=" + gateB1.qcStatus
);
assert(
  gateB1.qcStatus === "NG",
  "B2: QC NG -> qcStatus=NG",
  "qcStatus=" + gateB1.qcStatus
);
assert(
  gateB1.reason === "QC NG",
  "B3: QC NG -> reason='QC NG'",
  "reason=" + gateB1.reason
);

console.log("\n=== GROUP C: QC PASS, route incomplete ===");
setupFresh();
const matC1 = buildMaterial(DB, { kode: "DLVC01", route: ROUTE_D, qc: "OK", processes: { HT: { status: "PROCESS", result: "OK" } } });
const gateC1 = DB.canDeliver(matC1);
assert(
  gateC1.allowed === false,
  "C1: QC OK, HT in PROCESS -> canDeliver=false",
  "allowed=" + gateC1.allowed + " reason=" + (gateC1.reason || "-")
);
assert(
  gateC1.reason.includes("sedang berjalan"),
  "C2: Reason mentions PROCESS",
  "reason=" + gateC1.reason
);
const matC3 = buildMaterial(DB, { kode: "DLVC03", route: ROUTE_D, qc: "OK", processes: { HT: { status: "FINISH", result: "OK" }, SHOTBLAST: { status: "FINISH", result: "OK" }, ANTI_RUST: { status: "PROCESS", result: "OK" } } });
const gateC3 = DB.canDeliver(matC3);
assert(
  gateC3.allowed === false,
  "C3: QC OK, HT+SB done, AR in PROCESS -> canDeliver=false",
  "allowed=" + gateC3.allowed + " reason=" + (gateC3.reason || "-")
);
const matC4 = buildMaterial(DB, { kode: "DLVC04", route: ROUTE_B, qc: "OK", processes: { HT: { status: "FINISH", result: "NG" } } });
const gateC4 = DB.canDeliver(matC4);
assert(
  gateC4.allowed === false,
  "C4: QC OK, HT FINISH+NG -> canDeliver=false",
  "allowed=" + gateC4.allowed + " reason=" + (gateC4.reason || "-")
);
assert(
  gateC4.reason.includes("menghasilkan NG"),
  "C5: HT FINISH+NG reason mentions NG",
  "reason=" + gateC4.reason
);

console.log("\n=== GROUP D: QC PASS, route complete, no delivery -> allowed ===");
setupFresh();
const matD1 = buildMaterial(DB, { kode: "DLVD01", route: ROUTE_A, qc: "OK" });
const gateD1 = DB.canDeliver(matD1);
assert(
  gateD1.allowed === true,
  "D1: Route A complete, QC OK, no delivery -> canDeliver=true",
  "allowed=" + gateD1.allowed + " reason=" + (gateD1.reason || "-")
);
const matD2 = buildMaterial(DB, { kode: "DLVD02", route: ROUTE_D, qc: "OK" });
const gateD2 = DB.canDeliver(matD2);
assert(
  gateD2.allowed === true,
  "D2: Route D complete, QC OK, no delivery -> canDeliver=true",
  "allowed=" + gateD2.allowed + " reason=" + (gateD2.reason || "-")
);
assert(
  gateD2.canDeliver === true,
  "D3: canDeliver.canDeliver=true",
  "canDeliver=" + gateD2.canDeliver
);
assert(
  gateD2.qcStatus === "PASS",
  "D4: qcStatus=PASS for allowed delivery",
  "qcStatus=" + gateD2.qcStatus
);

console.log("\n=== GROUP E: Sudah dikirim (existing delivery) ===");
setupFresh();
const matE1 = buildMaterial(DB, { kode: "DLVE01", route: ROUTE_A, qc: "OK", delivery: true });
const gateE1 = DB.canDeliver(matE1);
assert(
  gateE1.allowed === false,
  "E1: Route complete + delivery exists -> canDeliver=false",
  "allowed=" + gateE1.allowed + " reason=" + (gateE1.reason || "-")
);
assert(
  gateE1.reason === "Material sudah dikirim",
  "E2: Reason is 'Material sudah dikirim'",
  "reason=" + gateE1.reason
);
assert(
  gateE1.canDeliver === false,
  "E3: canDeliver.canDeliver=false for delivered material",
  "canDeliver=" + gateE1.canDeliver
);

console.log("\n=== GROUP F: Material tidak ditemukan ===");
setupFresh();
const gateF1 = DB.canDeliver("99999DUMMY");
assert(
  gateF1.allowed === false,
  "F1: Invalid kode -> canDeliver=false",
  "allowed=" + gateF1.allowed
);
assert(
  gateF1.qcStatus === "NOT_FOUND",
  "F2: Invalid kode -> qcStatus=NOT_FOUND",
  "qcStatus=" + gateF1.qcStatus
);

console.log("\n=== GROUP G: Route variations ===");
setupFresh();
const matG1 = buildMaterial(DB, { kode: "DLVG01", route: ROUTE_B, qc: "OK" });
const gateG1 = DB.canDeliver(matG1);
assert(
  gateG1.allowed === true,
  "G1: Route B complete (HT+QC+SB), QC OK -> canDeliver=true",
  "allowed=" + gateG1.allowed
);
const matG2 = buildMaterial(DB, { kode: "DLVG02", route: ROUTE_C, qc: "OK" });
const gateG2 = DB.canDeliver(matG2);
assert(
  gateG2.allowed === true,
  "G2: Route C complete (HT+QC+AR), QC OK -> canDeliver=true",
  "allowed=" + gateG2.allowed
);
const matG3 = buildMaterial(DB, { kode: "DLVG03", route: ROUTE_B, qc: "OK", processes: { SHOTBLAST: { status: "WAITING", result: "" } } });
const gateG3 = DB.canDeliver(matG3);
assert(
  gateG3.allowed === false,
  "G3: Route B, SB not done -> canDeliver=false",
  "allowed=" + gateG3.allowed + " reason=" + (gateG3.reason || "-")
);
assert(
  gateG3.reason.includes("SHOTBLAST"),
  "G4: Reason mentions SHOTBLAST not done",
  "reason=" + gateG3.reason
);
const matG5 = buildMaterial(DB, { kode: "DLVG05", route: ROUTE_A, qc: "OK" });
const gateG5 = DB.canDeliver(matG5);
assert(
  gateG5.processRouteSteps.length === 2,
  "G5: Route A steps = HT + QC only (length 2)",
  "steps=" + JSON.stringify(gateG5.processRouteSteps)
);

console.log("\n=== GROUP H: FINISH_NG in different steps ===");
setupFresh();
const matH1 = buildMaterial(DB, { kode: "DLVH01", route: ROUTE_A, qc: "OK", processes: { HT: { status: "FINISH_NG", result: "NG" } } });
const gateH1 = DB.canDeliver(matH1);
assert(
  gateH1.allowed === false,
  "H1: HT FINISH_NG -> canDeliver=false",
  "allowed=" + gateH1.allowed + " reason=" + (gateH1.reason || "-")
);
assert(
  gateH1.reason.includes("NG"),
  "H2: H1 reason mentions NG",
  "reason=" + gateH1.reason
);
const matH3 = buildMaterial(DB, { kode: "DLVH03", route: ROUTE_D, qc: "OK", processes: { HT: { status: "FINISH", result: "OK" }, SHOTBLAST: { status: "FINISH", result: "OK" }, ANTI_RUST: { status: "FINISH_NG", result: "NG" } } });
const gateH3 = DB.canDeliver(matH3);
assert(
  gateH3.allowed === false,
  "H3: AR FINISH_NG -> canDeliver=false",
  "allowed=" + gateH3.allowed + " reason=" + (gateH3.reason || "-")
);
assert(
  gateH3.reason.includes("ANTI_RUST") && gateH3.reason.includes("NG"),
  "H4: H3 reason mentions ANTI_RUST and NG",
  "reason=" + gateH3.reason
);

console.log("\n=== GROUP I: Delivery material_id matching ===");
setupFresh();
const matI1 = buildMaterial(DB, { kode: "DLVI01", route: ROUTE_A, qc: "OK" });
const gateI1 = DB.canDeliver(matI1);
assert(
  gateI1.allowed === true,
  "I1: No delivery -> canDeliver=true",
  "allowed=" + gateI1.allowed
);
DB.insert("deliveries", { material_id: matI1.id, production_id: 1, tanggal_kirim: "2026-09-03", qty_kirim: 10, status: "Delivered" });
const gateI2 = DB.canDeliver(matI1);
assert(
  gateI2.allowed === false,
  "I2: Delivery with correct material_id -> canDeliver=false",
  "allowed=" + gateI2.allowed + " reason=" + (gateI2.reason || "-")
);
assert(
  gateI2.reason === "Material sudah dikirim",
  "I3: Reason is 'Material sudah dikirim'",
  "reason=" + gateI2.reason
);
const matI4 = buildMaterial(DB, { kode: "DLVI04", route: ROUTE_A, qc: "OK" });
DB.insert("deliveries", { material_id: 99999, production_id: 1, tanggal_kirim: "2026-09-03", qty_kirim: 10, status: "Delivered" });
const gateI4 = DB.canDeliver(matI4);
assert(
  gateI4.allowed === true,
  "I4: Delivery with wrong material_id -> canDeliver=true (not detected)",
  "allowed=" + gateI4.allowed + " reason=" + (gateI4.reason || "-")
);
const matI5 = buildMaterial(DB, { kode: "DLVI05", route: ROUTE_A, qc: "OK" });
DB.insert("deliveries", { material_id: matI5.id, production_id: 1, tanggal_kirim: "2026-09-03", qty_kirim: 10, status: "Delivered" });
DB.insert("deliveries", { material_id: matI5.id, production_id: 2, tanggal_kirim: "2026-09-04", qty_kirim: 10, status: "Delivered" });
const gateI5 = DB.canDeliver(matI5);
assert(
  gateI5.allowed === false,
  "I5: Multiple deliveries for same material -> still blocked",
  "allowed=" + gateI5.allowed + " reason=" + (gateI5.reason || "-")
);
assert(
  gateI5.reason === "Material sudah dikirim",
  "I6: Reason is 'Material sudah dikirim' for duplicate",
  "reason=" + gateI5.reason
);

console.log("\n=== GROUP J: Regression & structure ===");
setupFresh();
assert(
  typeof DB.canDeliver === "function",
  "J1: DB.canDeliver is a function",
  ""
);
const matJ2 = buildMaterial(DB, { kode: "DLVJ02", route: ROUTE_A, qc: "OK" });
const gateJ2 = DB.canDeliver(matJ2);
assert(
  gateJ2.hasOwnProperty("allowed") && gateJ2.hasOwnProperty("reason") &&
  gateJ2.hasOwnProperty("qcStatus") && gateJ2.hasOwnProperty("processRoute") &&
  gateJ2.hasOwnProperty("processRouteSteps") && gateJ2.hasOwnProperty("canDeliver"),
  "J2: canDeliver returns all expected fields",
  "keys=" + JSON.stringify(Object.keys(gateJ2))
);
const seedMats = DB.get("materials").filter(m => m.kode.startsWith("2026"));
assert(
  seedMats.length === 10,
  "J3: Seed materials preserved (10 materials starting with 2026)",
  "count=" + seedMats.length
);
const matJ4 = buildMaterial(DB, { kode: "DLVJ04", route: ROUTE_A, qc: "OK" });
const beforeRoute = JSON.parse(JSON.stringify(matJ4.process_route));
DB.canDeliver(matJ4);
DB.canDeliver(matJ4.kode);
const afterRoute = JSON.parse(JSON.stringify(matJ4.process_route));
assert(
  JSON.stringify(beforeRoute) === JSON.stringify(afterRoute),
  "J4: process_route not mutated by canDeliver calls",
  "before=" + JSON.stringify(beforeRoute) + " after=" + JSON.stringify(afterRoute)
);
const matJ5 = buildMaterial(DB, { kode: "DLVJ05", route: ROUTE_D, qc: "OK" });
const gateJ5 = DB.canDeliver(matJ5);
assert(
  gateJ5.processRoute === matJ5.process_route,
  "J5: processRoute references material.process_route (not part.standard_process_route)",
  "route=" + JSON.stringify(gateJ5.processRoute)
);
const seedProdsBefore = DB.get("productions").length;
DB.canDeliver(matJ5);
const seedProdsAfter = DB.get("productions").length;
assert(
  seedProdsBefore === seedProdsAfter,
  "J6: No production records created by canDeliver (read-only)",
  "before=" + seedProdsBefore + " after=" + seedProdsAfter
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
