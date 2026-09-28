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

console.log("==========================================");
console.log("  HT SYSTEM - QUALITY GATE TESTS (Tahap 3B-1 & 3B-2)");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================\n");

function gateCStr(g) {
  return "allowed=" + g.allowed + " qcStatus=" + g.qcStatus + " reason=" + (g.reason || "-");
}
function gateStr(g) {
  return "allowed=" + g.allowed + " qcStatus=" + g.qcStatus + " processName=" + (g.processName || "-") + " steps=" + JSON.stringify(g.processRouteSteps || []);
}

console.log("=== GROUP A: QC belum dilakukan (NOT_CHECKED) ===");
setupFresh();
assert(
  DB.checkQualityGate("20260006I").qcStatus === "NOT_CHECKED",
  "A1: Material 20260006I (no QC) -> NOT_CHECKED",
  "qcStatus=" + DB.checkQualityGate("20260006I").qcStatus,
);
assert(
  DB.checkQualityGate("20260006I").allowed === false,
  "A2: Material 20260006I (no QC) -> allowed=false",
  "",
);
assert(
  DB.checkQualityGate("20260006I").reason === "QC belum dilakukan",
  "A3: Material 20260006I (no QC) -> reason='QC belum dilakukan'",
  "reason=" + DB.checkQualityGate("20260006I").reason,
);

console.log("\n=== GROUP B: QC hasil OK (PASS) ===");
setupFresh();
const gateOK = DB.checkQualityGate("20260001I");
assert(
  gateOK.qcStatus === "PASS",
  "B1: Material 20260001I (QC OK) -> qcStatus=PASS",
  "qcStatus=" + gateOK.qcStatus,
);
assert(
  gateOK.allowed === true,
  "B2: Material 20260001I (QC OK) -> allowed=true",
  "",
);
assert(
  gateOK.reason === null,
  "B3: Material 20260001I (QC OK) -> reason=null",
  "reason=" + gateOK.reason,
);

console.log("\n=== GROUP C: QC hasil NG ===");
setupFresh();
const gateNG = DB.checkQualityGate("20260004I");
assert(
  gateNG.qcStatus === "NG",
  "C1: Material 20260004I (QC NG) -> qcStatus=NG",
  "qcStatus=" + gateNG.qcStatus,
);
assert(
  gateNG.allowed === false,
  "C2: Material 20260004I (QC NG) -> allowed=false",
  "",
);
assert(
  gateNG.reason === "QC NG",
  "C3: Material 20260004I (QC NG) -> reason='QC NG'",
  "reason=" + gateNG.reason,
);

console.log("\n=== GROUP D: process_route validation ===");
setupFresh();
const gateRoute1 = DB.checkQualityGate("20260001I");
assert(
  Array.isArray(gateRoute1.processRouteSteps),
  "D1: processRouteSteps is an array",
  "",
);
assert(
  gateRoute1.processRouteSteps.includes("HT") &&
    gateRoute1.processRouteSteps.includes("QC") &&
    gateRoute1.processRouteSteps.includes("SHOTBLAST") &&
    gateRoute1.processRouteSteps.includes("ANTI_RUST"),
  "D2: 20260001I route = HT + QC + SHOTBLAST + ANTI_RUST",
  "steps=" + JSON.stringify(gateRoute1.processRouteSteps),
);
assert(
  gateRoute1.processRoute && gateRoute1.processRoute.heat_treatment === true,
  "D3: processRoute is the material object (heat_treatment=true)",
  "processRoute=" + JSON.stringify(gateRoute1.processRoute),
);
const gateRoute2 = DB.checkQualityGate("20260004I");
assert(
  !gateRoute2.processRouteSteps.includes("SHOTBLAST") &&
    !gateRoute2.processRouteSteps.includes("ANTI_RUST"),
  "D4: 20260004I route = HT + QC only (no Shotblast, no Anti Rust)",
  "steps=" + JSON.stringify(gateRoute2.processRouteSteps),
);

console.log("\n=== GROUP E: Material tidak ditemukan ===");
setupFresh();
const gateNotFound = DB.checkQualityGate("99999999ZZ");
assert(
  gateNotFound.allowed === false,
  "E1: Invalid kode -> allowed=false",
  "",
);
assert(
  gateNotFound.qcStatus === "NOT_FOUND",
  "E2: Invalid kode -> qcStatus=NOT_FOUND",
  "qcStatus=" + gateNotFound.qcStatus,
);
assert(
  gateNotFound.reason === "Material tidak ditemukan",
  "E3: Invalid kode -> reason='Material tidak ditemukan'",
  "reason=" + gateNotFound.reason,
);

console.log("\n=== GROUP F: Material dengan process_route kosong/null ===");
setupFresh();
const materials = DB.get("materials");
const matTest = materials[0];
DB.update("materials", matTest.id, { process_route: null });
const gateNoRoute = DB.checkQualityGate(matTest.kode);
assert(
  gateNoRoute.allowed === false,
  "F1: Empty process_route -> allowed=false",
  "",
);
assert(
  gateNoRoute.reason === "Process route material tidak tersedia",
  "F2: Empty process_route -> reason='Process route material tidak tersedia'",
  "reason=" + gateNoRoute.reason,
);

console.log("\n=== GROUP G: Backward compatibility - material object langsung ===");
setupFresh();
const matDirect = DB.findByKode("20260002I");
const gateDirect = DB.checkQualityGate(matDirect);
assert(
  gateDirect.qcStatus === "PASS",
  "G1: checkQualityGate(materialObject) works -> qcStatus=PASS",
  "qcStatus=" + gateDirect.qcStatus,
);
assert(
  gateDirect.allowed === true,
  "G2: checkQualityGate(materialObject) works -> allowed=true",
  "",
);

console.log("\n=== GROUP H: QC hasil 'PASS' string (frontend komputasi) ===");
setupFresh();
const matH = DB.findByKode("20260003I");
const prodH = DB.get("productions").find((p) => p.material_id == matH.id);
DB.insert("qcs", {
  production_id: prodH.id,
  material_id: matH.id,
  hardness: "60",
  satuan_hardness: "HRC",
  hasil: "PASS",
  microstructure: "OK",
  inspector: "Test",
  tanggal_inspector: "2026-09-20",
  catatan: "",
  user_id: 1,
});
const gateHPass = DB.checkQualityGate("20260003I");
assert(
  gateHPass.qcStatus === "PASS",
  "H1: QC hasil='PASS' string -> qcStatus=PASS",
  "qcStatus=" + gateHPass.qcStatus,
);
assert(
  gateHPass.allowed === true,
  "H2: QC hasil='PASS' string -> allowed=true",
  "",
);

console.log("\n=== REGRESSION A: Tahap 3A QC data integrity ===");
setupFresh();
const qcs = DB.get("qcs");
assert(qcs.length === 5, "R1: QC seed count preserved (5 records)", "count=" + qcs.length);
const qc004 = qcs.find((q) => q.material_id == 1004);
assert(qc004 && qc004.hasil === "NG", "R2: Material 20260004I QC hasil=NG preserved", "hasil=" + (qc004 ? qc004.hasil : "null"));
const qc005 = qcs.find((q) => q.material_id == 1005);
assert(qc005 && qc005.hasil === "OK", "R3: Material 20260005I QC hasil=OK preserved", "hasil=" + (qc005 ? qc005.hasil : "null"));
assert(typeof DB.checkQualityGate === "function", "R4: DB.checkQualityGate is a function", "");
assert(typeof DB.findByKode === "function" && typeof DB.findMaterial === "function", "R5: Existing DB.findByKode and DB.findMaterial still present", "");
assert(typeof DB.migrate === "function" && typeof DB.insert === "function", "R6: Existing DB.migrate and DB.insert still present", "");

/* ===================== GROUP INTEGRATION (Tahap 3B-2) ===================== */
console.log("\n=== GROUP I: Integration - canProceedToProcess ===");
assert(typeof DB.canProceedToProcess === "function", "I1: DB.canProceedToProcess is a function", "");

console.log("\n--- TEST 1: QC belum dilakukan (20260006I) ---");
setupFresh();
const i1sb = DB.canProceedToProcess("20260006I", "SHOTBLAST");
const i1ar = DB.canProceedToProcess("20260006I", "ANTI_RUST");
assert(i1sb.allowed === false, "I1a: 20260006I SHOTBLAST rejected (QC not done)", gateStr(i1sb));
assert(i1sb.qcStatus === "NOT_CHECKED", "I1b: qcStatus=NOT_CHECKED", "qcStatus=" + i1sb.qcStatus);
assert(i1sb.reason === "QC belum dilakukan", "I1c: reason='QC belum dilakukan'", "reason=" + i1sb.reason);
assert(i1ar.allowed === false, "I1d: 20260006I ANTI_RUST rejected (QC not done)", gateStr(i1ar));
const prodsI1 = DB.get("productions").length;
assert(prodsI1 === 8, "I1e: No new production records created (count=" + prodsI1 + ")", "");

console.log("\n--- TEST 2: QC NG (20260004I) ---");
setupFresh();
const i2sb = DB.canProceedToProcess("20260004I", "SHOTBLAST");
const i2ar = DB.canProceedToProcess("20260004I", "ANTI_RUST");
assert(i2sb.allowed === false, "I2a: 20260004I SHOTBLAST rejected (QC NG)", gateStr(i2sb));
assert(i2sb.qcStatus === "NG", "I2b: qcStatus=NG", "qcStatus=" + i2sb.qcStatus);
assert(i2sb.reason === "QC NG", "I2c: reason='QC NG'", "reason=" + i2sb.reason);
assert(i2ar.allowed === false, "I2d: 20260004I ANTI_RUST rejected (QC NG)", gateStr(i2ar));

console.log("\n--- TEST 3: QC PASS + HT->QC->SHOTBLAST->ANTI_RUST (20260001I) ---");
setupFresh();
const i3sb = DB.canProceedToProcess("20260001I", "SHOTBLAST");
const i3ar = DB.canProceedToProcess("20260001I", "ANTI_RUST");
assert(i3sb.allowed === true, "I3a: SHOTBLAST allowed (route has shotblast)", gateStr(i3sb));
assert(i3sb.qcStatus === "PASS", "I3b: qcStatus=PASS", "qcStatus=" + i3sb.qcStatus);
assert(i3sb.processRoute.shotblast === true, "I3c: processRoute.shotblast=true", "");
assert(i3sb.processRouteSteps.includes("SHOTBLAST"), "I3d: processRouteSteps includes SHOTBLAST", JSON.stringify(i3sb.processRouteSteps));
assert(i3ar.allowed === true, "I3e: ANTI_RUST allowed (route has anti_rust)", gateStr(i3ar));
assert(i3ar.processRoute.anti_rust === true, "I3f: processRoute.anti_rust=true", "");
assert(i3ar.processRouteSteps.includes("ANTI_RUST"), "I3g: processRouteSteps includes ANTI_RUST", JSON.stringify(i3ar.processRouteSteps));

console.log("\n--- TEST 4: QC PASS + HT->QC->SHOTBLAST (20260002I, no anti_rust) ---");
setupFresh();
const i4sb = DB.canProceedToProcess("20260002I", "SHOTBLAST");
const i4ar = DB.canProceedToProcess("20260002I", "ANTI_RUST");
assert(i4sb.allowed === true, "I4a: SHOTBLAST allowed", gateStr(i4sb));
assert(i4ar.allowed === false, "I4b: ANTI_RUST rejected (not in route)", gateStr(i4ar));
assert(i4ar.reason.includes("ANTI_RUST") && i4ar.reason.includes("tidak termasuk"), "I4c: reason mentions route mismatch", "reason=" + i4ar.reason);
assert(i4ar.qcStatus === "PASS", "I4d: qcStatus=PASS (QC passed but route mismatch)", "qcStatus=" + i4ar.qcStatus);

console.log("\n--- TEST 5: QC PASS + HT->QC->ANTI_RUST (20260003I, no shotblast) ---");
setupFresh();
const i5sb = DB.canProceedToProcess("20260003I", "SHOTBLAST");
const i5ar = DB.canProceedToProcess("20260003I", "ANTI_RUST");
assert(i5sb.allowed === false, "I5a: SHOTBLAST rejected (not in route)", gateStr(i5sb));
assert(i5sb.reason.includes("SHOTBLAST") && i5sb.reason.includes("tidak termasuk"), "I5b: reason mentions route mismatch", "reason=" + i5sb.reason);
assert(i5ar.allowed === true, "I5c: ANTI_RUST allowed (route has anti_rust)", gateStr(i5ar));
assert(i5ar.processRoute.anti_rust === true, "I5d: processRoute.anti_rust=true", "");

console.log("\n--- TEST 6: QC PASS + HT->QC only (20260005I) ---");
setupFresh();
const i6sb = DB.canProceedToProcess("20260005I", "SHOTBLAST");
const i6ar = DB.canProceedToProcess("20260005I", "ANTI_RUST");
assert(i6sb.allowed === false, "I6a: SHOTBLAST rejected (no shotblast in route)", gateStr(i6sb));
assert(i6sb.reason.includes("SHOTBLAST") && i6sb.reason.includes("tidak termasuk"), "I6b: reason mentions route mismatch", "reason=" + i6sb.reason);
assert(i6ar.allowed === false, "I6c: ANTI_RUST rejected (no anti_rust in route)", gateStr(i6ar));
assert(i6ar.reason.includes("ANTI_RUST") && i6ar.reason.includes("tidak termasuk"), "I6d: reason mentions route mismatch", "reason=" + i6ar.reason);
assert(
  JSON.stringify(i6sb.processRouteSteps) === JSON.stringify(["HT", "QC"]),
  "I6e: processRouteSteps = ['HT','QC'] only",
  "steps=" + JSON.stringify(i6sb.processRouteSteps),
);

console.log("\n--- TEST 7: Material tidak ditemukan ---");
setupFresh();
const i7sb = DB.canProceedToProcess("99999999ZZ", "SHOTBLAST");
const i7ar = DB.canProceedToProcess("99999999ZZ", "ANTI_RUST");
assert(i7sb.allowed === false, "I7a: Unknown material SHOTBLAST rejected", gateStr(i7sb));
assert(i7sb.qcStatus === "NOT_FOUND", "I7b: qcStatus=NOT_FOUND", "qcStatus=" + i7sb.qcStatus);
assert(i7sb.reason === "Material tidak ditemukan", "I7c: reason='Material tidak ditemukan'", "reason=" + i7sb.reason);
assert(i7ar.allowed === false, "I7d: Unknown material ANTI_RUST rejected", gateStr(i7ar));
assert(DB.get("productions").length === 8, "I7e: No new production records created", "");

console.log("\n--- TEST 8: processName case-insensitive & format-tolerant ---");
setupFresh();
const i8a = DB.canProceedToProcess("20260001I", "shotblast");
const i8b = DB.canProceedToProcess("20260001I", "Anti Rust");
const i8c = DB.canProceedToProcess("20260001I", "anti-rust");
assert(i8a.allowed === true, "I8a: lowercase 'shotblast' works", gateStr(i8a));
assert(i8a.processName === "SHOTBLAST", "I8b: normalized processName=SHOTBLAST", "processName=" + i8a.processName);
assert(i8b.allowed === true, "I8c: 'Anti Rust' (space) works", gateStr(i8b));
assert(i8b.processName === "ANTI_RUST", "I8d: normalized processName=ANTI_RUST", "processName=" + i8b.processName);
assert(i8c.allowed === true, "I8e: 'anti-rust' (hyphen) works", gateStr(i8c));

console.log("\n--- TEST 9: Backward compat - material object langsung ---");
setupFresh();
const mat9 = DB.findByKode("20260001I");
const i9 = DB.canProceedToProcess(mat9, "SHOTBLAST");
assert(i9.allowed === true, "I9: canProceedToProcess(materialObj, 'SHOTBLAST') works", gateStr(i9));

console.log("\n--- TEST 10: Route tidak diubah oleh Quality Gate ---");
setupFresh();
const matBefore = DB.findByKode("20260001I");
const routeSnapshot = JSON.parse(JSON.stringify(matBefore.process_route));
DB.canProceedToProcess("20260001I", "SHOTBLAST");
DB.canProceedToProcess("20260001I", "ANTI_RUST");
DB.checkQualityGate("20260001I");
const matAfter = DB.findByKode("20260001I");
assert(
  JSON.stringify(matAfter.process_route) === JSON.stringify(routeSnapshot),
  "I10: material.process_route tidak berubah setelah Quality Gate",
  "before=" + JSON.stringify(routeSnapshot) + " after=" + JSON.stringify(matAfter.process_route),
);

console.log("\n--- TEST 11: standard_process_route NOT used for route decision ---");
setupFresh();
const mat11 = DB.findByKode("20260004I");
const part11 = DB.findPartById(mat11.part_id);
const gate11 = DB.checkQualityGate(mat11);
assert(
  JSON.stringify(gate11.processRoute) === JSON.stringify(mat11.process_route),
  "I11a: processRoute berasal dari material.process_route",
  "material=" + JSON.stringify(mat11.process_route),
);
var mat11b = DB.findByKode("20260001I");
var part11b = DB.findPartById(mat11b.part_id);
var matRouteBefore = JSON.parse(JSON.stringify(mat11b.process_route));
DB.update("parts", part11b.id, {
  standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false },
});
var gate11b = DB.checkQualityGate(mat11b);
assert(
  JSON.stringify(gate11b.processRoute) === JSON.stringify(matRouteBefore),
  "I11b: processRoute follows material (not updated part.standard_process_route)",
  "material_route=" + JSON.stringify(matRouteBefore) + " gate_route=" + JSON.stringify(gate11b.processRoute),
);
assert(
  gate11b.processRoute.shotblast === true,
  "I11c: material.process_route.shotblast still true (unchanged by part edit)",
  "shotblast=" + gate11b.processRoute.shotblast,
);

console.log("\n--- TEST 12: Regression - existing tests still pass ---");
setupFresh();
assert(DB.tables.includes("qcs"), "I12a: qcs table exists", "");
assert(DB.tables.includes("materials"), "I12b: materials table exists", "");
assert(DB.findByKode("20260001I") !== null, "I12c: findByKode still works", "");
assert(DB.findMaterial(1001) !== null, "I12d: findMaterial still works", "");

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
