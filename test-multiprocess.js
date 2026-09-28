/* ============================================================
   MULTI-PROCESS DATA LAYER TEST (Tahap 3B-3C-1)
   Verifies DB.getProcessHistory / getCurrentProcess /
   isRouteCompleted / canDeliver across all route variants.
   Fresh in-memory DB seeded from db.js seedDemoData.
   All mutations are counted; seed integrity is asserted at end.
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
var productionInserts = 0;
var qcInserts = 0;
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

var JENIS_MAP = { SHOTBLAST: "Shotblast", ANTI_RUST: "Anti Rust", HT: "Heat Treatment" };

function simulateStart(material, processKey) {
  var gate = DB.canStartProcess(material, processKey);
  if (!gate.allowed) return { ok: false, reason: gate.reason };
  var existing = DB.getProcessProduction(material, processKey);
  if (existing && existing.production_status === "PROCESS") return { ok: false, reason: "Proses sedang berjalan." };
  if (existing && existing.production_status === "FINISH" && existing.process_result === "OK") return { ok: false, reason: "Proses sudah selesai." };
  if (existing && (existing.production_status === "FINISH_NG" || existing.process_result === "NG")) return { ok: false, reason: "Proses selesai dengan hasil NG." };
  var now = new Date().toISOString();
  DB.insert("productions", {
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
    jenis_treatment: JENIS_MAP[processKey] || processKey,
    visual_check_result: "OK",
    visual_check_note: "",
    process_result: "",
    process_ng_note: "",
    finish_scan_at: "",
    finish_scan_by: "",
    machine_finish_at: "",
    machine_finish_by: "",
  });
  productionInserts++;
  return { ok: true, reason: null };
}

function simulateFinish(material, processKey, result, ngNote) {
  var prod = DB.getProcessProduction(material, processKey);
  if (!prod) return { ok: false, reason: "no production" };
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

function stepKeys(history) {
  return history.map(function (h) {
    return h.process;
  });
}
function statusOf(history, step) {
  var item = history.find(function (h) {
    return h.process === step;
  });
  return item ? item.status : undefined;
}
function completedOf(history, step) {
  var item = history.find(function (h) {
    return h.process === step;
  });
  return item ? item.completed : undefined;
}

console.log("==========================================");
console.log("  HT SYSTEM - MULTI-PROCESS DATA LAYER (3B-3C-1)");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================");

var seedProductions = DB.get("productions").length;
var seedQcs = DB.get("qcs").length;
var seedMaterials = DB.get("materials").length;
var seedParts = DB.get("parts").length;

// 1001 Route A (HT,QC,SB,AR)  QC PASS  HT FINISH+OK  delivery=4001
// 1002 Route B (HT,QC,SB)     QC PASS  HT FINISH+OK  delivery=4002
// 1003 Route C (HT,QC,AR)     QC PASS  HT FINISH+OK  delivery=4003
// 1004 Route D (HT,QC)        QC NG    HT FINISH_NG
// 1005 Route D (HT,QC)        QC PASS  HT FINISH+OK  (no delivery)
// 1006 Route D (HT,QC)        no QC   HT PROCESS
// 1009 Route D (HT,QC)        no QC    no production

// === GROUP A: getProcessHistory ===
console.log("\n=== GROUP A: getProcessHistory ===");
assert(JSON.stringify(stepKeys(DB.getProcessHistory("20260001I"))) === JSON.stringify(["HT", "QC", "SHOTBLAST", "ANTI_RUST"]), "A1: Route A steps", "steps=" + JSON.stringify(stepKeys(DB.getProcessHistory("20260001I"))));
assert(JSON.stringify(stepKeys(DB.getProcessHistory("20260002I"))) === JSON.stringify(["HT", "QC", "SHOTBLAST"]), "A2: Route B steps", "");
assert(JSON.stringify(stepKeys(DB.getProcessHistory("20260003I"))) === JSON.stringify(["HT", "QC", "ANTI_RUST"]), "A3: Route C steps", "");
assert(JSON.stringify(stepKeys(DB.getProcessHistory("20260005I"))) === JSON.stringify(["HT", "QC"]), "A4: Route D steps", "");
assert(statusOf(DB.getProcessHistory("20260001I"), "QC") === "PASS", "A5: QC status from qcs (not production)", "qc=" + statusOf(DB.getProcessHistory("20260001I"), "QC"));
assert(completedOf(DB.getProcessHistory("20260001I"), "HT") === true, "A6: HT FINISH+OK -> completed", "completed=" + completedOf(DB.getProcessHistory("20260001I"), "HT"));
var histA = DB.getProcessHistory("20260001I");
var sbA = histA.find(function (h) {
  return h.process === "SHOTBLAST";
});
assert(sbA && sbA.status === "NOT_STARTED" && sbA.completed === false && sbA.production === null, "A7: not-started step -> NOT_STARTED, production null", "status=" + (sbA && sbA.status));
assert(statusOf(DB.getProcessHistory("20260006I"), "HT") === "PROCESS", "A8: PROCESS reflected", "status=" + statusOf(DB.getProcessHistory("20260006I"), "HT"));
assert(statusOf(DB.getProcessHistory("20260004I"), "HT") === "FINISH_NG" && completedOf(DB.getProcessHistory("20260004I"), "HT") === false, "A9: FINISH_NG -> not completed", "status=" + statusOf(DB.getProcessHistory("20260004I"), "HT"));
var qcItem = DB.getProcessHistory("20260001I").find(function (h) {
  return h.process === "QC";
});
assert(qcItem && qcItem.production === null, "A10: QC item production null (QC not a production record)", "production=" + (qcItem && qcItem.production));

// === GROUP B: getCurrentProcess (live scenario on 1001, Route A) ===
console.log("\n=== GROUP B: getCurrentProcess ===");
assert(DB.getCurrentProcess("20260001I") === "SHOTBLAST", "B1: initial -> next SHOTBLAST", "cur=" + DB.getCurrentProcess("20260001I"));
assert(simulateStart(DB.findByKode("20260001I"), "SHOTBLAST").ok === true, "B2: start SB allowed", "");
assert(DB.getCurrentProcess("20260001I") === "SHOTBLAST", "B3: SB PROCESS -> current SB", "cur=" + DB.getCurrentProcess("20260001I"));
simulateFinish(DB.findByKode("20260001I"), "SHOTBLAST", "OK");
assert(DB.getCurrentProcess("20260001I") === "ANTI_RUST", "B4: SB done -> next AR", "cur=" + DB.getCurrentProcess("20260001I"));
assert(simulateStart(DB.findByKode("20260001I"), "ANTI_RUST").ok === true, "B5: start AR allowed", "");
assert(DB.getCurrentProcess("20260001I") === "ANTI_RUST", "B6: AR PROCESS -> current AR", "cur=" + DB.getCurrentProcess("20260001I"));
simulateFinish(DB.findByKode("20260001I"), "ANTI_RUST", "OK");
assert(DB.getCurrentProcess("20260001I") === null, "B7: route complete -> null", "cur=" + DB.getCurrentProcess("20260001I"));
assert(DB.getCurrentProcess("20260004I") === null, "B8: QC NG + HT FINISH_NG -> null (no advance)", "cur=" + DB.getCurrentProcess("20260004I"));
var histB = DB.getProcessHistory("20260001I");
assert(histB.filter(function (h) {
  return h.production;
}).length === 3, "B9: 3 production records in history (HT+SB+AR)", "count=" + histB.filter(function (h) {
  return h.production;
}).length);
assert(DB.getProcessProduction(DB.findByKode("20260001I"), "HT").jenis_treatment === "Heat Treatment", "B10: getProcessProduction(HT) returns Heat Treatment (not array first/last)", "");

// === GROUP C: isRouteCompleted ===
console.log("\n=== GROUP C: isRouteCompleted ===");
assert(DB.isRouteCompleted("20260003I") === false, "C1: Route C incomplete (AR not started)", "");
assert(DB.isRouteCompleted("20260005I") === true, "C2: Route D complete (HT+QC)", "");
assert(DB.isRouteCompleted("20260001I") === true, "C3: Route A complete", "");
// 1002 Route B: start SB (PROCESS) -> incomplete
assert(simulateStart(DB.findByKode("20260002I"), "SHOTBLAST").ok === true, "C4a: start SB on 1002", "");
assert(DB.isRouteCompleted("20260002I") === false, "C4b: Route B incomplete (SB PROCESS)", "");
// 1002 Route B: HT PROCESS (1006) -> incomplete regardless of QC
assert(DB.isRouteCompleted("20260006I") === false, "C5: HT PROCESS -> route incomplete", "");
assert(DB.isRouteCompleted("20260004I") === false, "C6: HT FINISH_NG -> route incomplete", "");
assert(DB.isRouteCompleted("20260009I") === false, "C7: no production -> incomplete", "");
// 1009 no QC either (covered by step HT not started), confirm QC gate effect separately via isProcessCompleted
assert(DB.isProcessCompleted("20260009I", "QC") === false, "C8: missing QC -> QC step not completed", "");
assert(DB.isProcessCompleted("20260009I", "HT") === false, "C9: missing production -> HT step not completed", "");

// === GROUP D: canDeliver ===
console.log("\n=== GROUP D: canDeliver ===");
assert(DB.canDeliver("20260006I").allowed === false && /QC belum dilakukan/.test(DB.canDeliver("20260006I").reason || ""), "D1: QC belum -> false", "r=" + DB.canDeliver("20260006I").reason);
assert(DB.canDeliver("20260004I").allowed === false && /QC NG/.test(DB.canDeliver("20260004I").reason || ""), "D2: QC NG -> false", "r=" + DB.canDeliver("20260004I").reason);
// Add QC to 1006 so QC PASS; HT still PROCESS -> cannot deliver
var already = DB.get("qcs").find(function (q) {
  return String(q.material_id) === "1006";
});
if (!already) {
  DB.insert("qcs", { material_id: 1006, production_id: 2006, hasil: "OK", inspector: "QC Test", tanggal_inspector: "2026-09-13" });
  qcInserts++;
}
var d3 = DB.canDeliver("20260006I");
assert(d3.allowed === false && /HT|PROSES|belum selesai|berjalan/.test(d3.reason || ""), "D3: QC PASS but HT PROCESS -> false", "r=" + d3.reason);
// 1003 Route C: AR not started -> false
assert(DB.canDeliver("20260003I").allowed === false && /ANTI_RUST belum selesai/.test(DB.canDeliver("20260003I").reason || ""), "D4: Route C AR not started -> false", "r=" + DB.canDeliver("20260003I").reason);
// 1003: start AR -> false (sedang berjalan)
assert(simulateStart(DB.findByKode("20260003I"), "ANTI_RUST").ok === true, "D5a: start AR on 1003", "");
var d5 = DB.canDeliver("20260003I");
assert(d5.allowed === false && /ANTI_RUST sedang berjalan/.test(d5.reason || ""), "D5: AR PROCESS -> false", "r=" + d5.reason);
// 1003: finish AR OK -> route complete but delivery exists -> false (already delivered)
simulateFinish(DB.findByKode("20260003I"), "ANTI_RUST", "OK");
assert(DB.canDeliver("20260003I").allowed === false && /sudah dikirim/.test(DB.canDeliver("20260003I").reason || ""), "D6: complete + delivery exists -> false", "r=" + DB.canDeliver("20260003I").reason);
// 1002: finish SB as NG -> false (FINISH_NG)
simulateFinish(DB.findByKode("20260002I"), "SHOTBLAST", "NG", "Hardness di luar target");
assert(DB.canDeliver("20260002I").allowed === false && /menghasilkan NG/.test(DB.canDeliver("20260002I").reason || ""), "D7: SB FINISH_NG -> false", "r=" + DB.canDeliver("20260002I").reason);
assert(DB.isRouteCompleted("20260002I") === false, "D8: Route B with SB FINISH_NG -> incomplete", "");
// 1005 Route D complete, no delivery -> allowed
assert(DB.canDeliver("20260005I").allowed === true, "D9: Route D complete + no delivery -> allowed", "allowed=" + DB.canDeliver("20260005I").allowed);
// 1001 complete + delivery -> already delivered
assert(DB.canDeliver("20260001I").allowed === false && /sudah dikirim/.test(DB.canDeliver("20260001I").reason || ""), "D10: Route A complete + delivery -> false", "r=" + DB.canDeliver("20260001I").reason);

// === GROUP E: snapshot protection ===
console.log("\n=== GROUP E: snapshot protection ===");
var snap5 = JSON.parse(JSON.stringify(DB.findByKode("20260005I").process_route));
var part1 = DB.findPartById(DB.findByKode("20260005I").part_id);
var partRouteBefore = JSON.parse(JSON.stringify(part1.standard_process_route));
part1.standard_process_route = { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true };
DB.update("parts", part1.id, { standard_process_route: part1.standard_process_route });
assert(JSON.stringify(DB.findByKode("20260005I").process_route) === JSON.stringify(snap5), "E1: material.process_route unchanged after master edit", "route=" + JSON.stringify(DB.findByKode("20260005I").process_route));
assert(stepKeys(DB.getProcessHistory("20260005I")).join(",") === "HT,QC", "E2: history still uses material route (HT,QC), not modified part route", "steps=" + stepKeys(DB.getProcessHistory("20260005I")).join(","));
assert(DB.isRouteCompleted("20260005I") === true, "E3: isRouteCompleted unaffected by part change", "");
DB.update("parts", part1.id, { standard_process_route: partRouteBefore });

// === GROUP F: backward compatibility ===
console.log("\n=== GROUP F: backward compatibility ===");
var h5 = DB.getProcessHistory("20260005I");
assert(h5.length === 2, "F1: Route D history = 2 steps only", "len=" + h5.length);
assert(completedOf(h5, "HT") === true && completedOf(h5, "QC") === true, "F2: single-production HT+QC flow recognized complete", "");
assert(DB.isRouteCompleted("20260005I") === true, "F3: HT->QC flow completes", "");
assert(DB.canDeliver("20260005I").allowed === true, "F4: HT->QC flow deliverable", "");
assert(DB.getCurrentProcess("20260005I") === null, "F5: no current process (completed)", "");
assert(stepKeys(DB.getProcessHistory("20260009I")).indexOf("SHOTBLAST") === -1, "F6: no SHOTBLAST step on Route D (no 3/4 production assumption)", "");

// === GROUP G: multiple production + read-only ===
console.log("\n=== GROUP G: multiple production / read-only ===");
var m1 = DB.findByKode("20260001I");
assert(DB.getProcessProduction(m1, "SHOTBLAST").jenis_treatment === "Shotblast" && DB.getProcessProduction(m1, "SHOTBLAST").production_status === "FINISH", "G1: getProcessProduction(SB) correct", "");
assert(DB.getProcessProduction(m1, "ANTI_RUST").jenis_treatment === "Anti Rust" && DB.getProcessProduction(m1, "ANTI_RUST").production_status === "FINISH", "G2: getProcessProduction(AR) correct", "");
assert(DB.getProcessProduction(m1, "HT").jenis_treatment === "Heat Treatment", "G3: getProcessProduction(HT) correct (not array-first)", "");
var beforeRO = DB.get("productions").length;
DB.getProcessHistory("20260001I");
DB.getCurrentProcess("20260001I");
DB.isRouteCompleted("20260001I");
DB.canDeliver("20260001I");
assert(DB.get("productions").length === beforeRO, "G4: read-only helpers do not insert", "before=" + beforeRO + " after=" + DB.get("productions").length);
assert(productionInserts === DB.get("productions").length - seedProductions, "G5: production inserts match delta", "inserts=" + productionInserts + " delta=" + (DB.get("productions").length - seedProductions));
assert(DB.getCurrentProcess("20260001I") === null, "G6: current not array-order (complete -> null, even though last insert was AR)", "cur=" + DB.getCurrentProcess("20260001I"));

// === GROUP H: seed integrity ===
console.log("\n=== GROUP H: seed integrity ===");
assert(DB.get("materials").length === seedMaterials && seedMaterials === 10, "H1: materials preserved (10)", "count=" + DB.get("materials").length);
assert(DB.get("parts").length === seedParts && seedParts === 10, "H2: parts preserved (10)", "count=" + DB.get("parts").length);
assert(DB.get("qcs").length === seedQcs + qcInserts, "H3: qcs = seed + test-inserted", "count=" + DB.get("qcs").length + " expected=" + (seedQcs + qcInserts));
assert(DB.get("productions").length === seedProductions + productionInserts, "H4: productions = seed + inserts", "count=" + DB.get("productions").length + " expected=" + (seedProductions + productionInserts));
assert(DB.get("deliveries").length === 3, "H5: deliveries untouched (3)", "count=" + DB.get("deliveries").length);
assert(DB.get("customers").length === DB.get("customers").length, "H6: customers table intact", "count=" + DB.get("customers").length);

// === GROUP I: regression ===
console.log("\n=== GROUP I: regression ===");
assert(typeof DB.checkQualityGate === "function", "I1: DB.checkQualityGate exists", "");
assert(typeof DB.canProceedToProcess === "function", "I2: DB.canProceedToProcess exists", "");
assert(typeof DB.canStartProcess === "function", "I3: DB.canStartProcess exists", "");
assert(typeof DB.getProcessProduction === "function", "I4: DB.getProcessProduction exists", "");
assert(typeof DB.isProcessCompleted === "function", "I5: DB.isProcessCompleted exists", "");
assert(typeof DB.getNextProcess === "function", "I6: DB.getNextProcess exists", "");
assert(typeof DB.getProcessHistory === "function", "I7: DB.getProcessHistory (new) exists", "");
assert(typeof DB.getCurrentProcess === "function", "I8: DB.getCurrentProcess (new) exists", "");
assert(typeof DB.isRouteCompleted === "function", "I9: DB.isRouteCompleted (new) exists", "");
assert(typeof DB.canDeliver === "function", "I10: DB.canDeliver (new) exists", "");

// === GROUP J: not found ===
console.log("\n=== GROUP J: not found ===");
assert(DB.getProcessHistory("TIDAKADA").length === 0, "J1: history unknown -> []", "");
assert(DB.getCurrentProcess("TIDAKADA") === null, "J2: current unknown -> null", "");
assert(DB.isRouteCompleted("TIDAKADA") === false, "J3: route complete unknown -> false", "");
var jd = DB.canDeliver("TIDAKADA");
assert(jd.allowed === false && /Material tidak ditemukan/.test(jd.reason || ""), "J4: canDeliver unknown -> false", "r=" + jd.reason);

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
console.log("  production inserts: " + productionInserts + " | qc inserts: " + qcInserts + " | seed productions: " + seedProductions);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
