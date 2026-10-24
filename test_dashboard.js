/* ============================================================
   HT Dashboard — Regression Tests

   Tests for:
   1. computePartStatus() — INCOMING status for un-started materials
   2. renderKPIs() — monthly target achievement percentage
   3. Chart labels — "Output Delivery" accuracy
   ============================================================ */

const fs = require("fs");
const path = require("path");

class MemoryStorage {
  constructor() { this.store = {}; }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, val) { this.store[key] = String(val); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
  keys() { return Object.keys(this.store); }
}

let DB, HTDashboard;
let passed = 0, failed = 0;
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

function setupFresh() {
  global.localStorage = new MemoryStorage();
  const dbCode = fs.readFileSync(path.join(__dirname, "js", "db.js"), "utf8").replace("const DB", "var DB");
  const dashCode = fs.readFileSync(path.join(__dirname, "js", "dashboard.js"), "utf8").replace("const HTDashboard", "var HTDashboard");

  DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);

  const mockDoc = {
    getElementById: (id) => ({
      _tag: id,
      textContent: "",
      value: "",
      classList: {
        _c: new Set(),
        add(cls) { this._c.add(cls); },
        remove(cls) { this._c.delete(cls); },
        contains(cls) { return this._c.has(cls); },
        toggle(cls, force) {
          if (force === true) this._c.add(cls);
          else if (force === false) this._c.delete(cls);
          else { if (this._c.has(cls)) this._c.delete(cls); else this._c.add(cls); }
        },
      },
      style: {},
      checked: false,
      disabled: false,
      innerHTML: "",
      focus() {},
      scrollIntoView() {},
      addEventListener() {},
    }),
    querySelectorAll: () => [],
    createElement: () => ({ className: "", innerHTML: "", appendChild() {} }),
    body: { appendChild() {} },
  };

  const ctx = {
    localStorage: global.localStorage,
    document: mockDoc,
    window: {
      location: { href: "", protocol: "http:" },
      addEventListener(type, fn) {
        if (type === "DOMContentLoaded") setTimeout(fn, 0);
      },
    },
    console: { log() {}, warn() {}, error() {} },
  };

  ctx.HTUI = {
    requireAuth: () => true,
    openModal: () => {},
    closeModal: () => {},
    toast: () => {},
  };
  global.HTUI = ctx.HTUI;
  global.DB = DB;

  const fullDashCode = dashCode.replace(
    /window\.addEventListener\("DOMContentLoaded"[^{]*\{[\s\S]*?\}\);/,
    "// DOMContentLoaded handler disabled for testing"
  );

  HTDashboard = new Function("localStorage", "document", "window", "console", "DB", "HTUI",
    fullDashCode + "\nreturn HTDashboard;")(ctx.localStorage, ctx.document, ctx.window, ctx.console, DB, ctx.HTUI);

  DB.init();
  HTDashboard._cacheData();
}

setupFresh();

// ====================================================================
// TEST GROUP 1: INCOMING Status Classification
// ====================================================================
console.log("\n=== TEST GROUP 1: INCOMING Status Classification ===\n");

// 1a. WAITING materials (no production started) should be INCOMING
const waitingMats = DB.get("materials").filter(m => m.status_proses === "WAITING");
const incomingCount = waitingMats.filter(m => HTDashboard.computePartStatus(m) === "INCOMING").length;
assert(
  incomingCount === waitingMats.length,
  "G1-T1: All WAITING materials classified as INCOMING",
  "expected=" + waitingMats.length + " got=" + incomingCount
);

// 1b. Material 1M specifically (WAITING, has route)
const mat1 = DB.findByKode("1M");
const status1 = HTDashboard.computePartStatus(mat1);
assert(
  status1 === "INCOMING",
  "G1-T2: Material 1M (WAITING) is INCOMING",
  "got=" + status1
);

// 1c. Material 2M (PROCESS) should NOT be INCOMING
const mat2 = DB.findByKode("2M");
const status2 = HTDashboard.computePartStatus(mat2);
assert(
  status2 !== "INCOMING",
  "G1-T3: Material 2M (PROCESS) is NOT INCOMING",
  "got=" + status2
);
assert(
  status2 === "PROSES PRODUKSI",
  "G1-T4: Material 2M (PROCESS) is PROSES PRODUKSI",
  "got=" + status2
);

// 1d. Material 3M (FINISH+OK) should NOT be INCOMING
const mat3 = DB.findByKode("3M");
const status3 = HTDashboard.computePartStatus(mat3);
assert(
  status3 !== "INCOMING",
  "G1-T5: Material 3M (FINISH+OK) is NOT INCOMING",
  "got=" + status3
);

// 1e. Material with route but no production → INCOMING
// Material 66M is WAITING with route
const mat66 = DB.findByKode("66M");
assert(
  HTDashboard.computePartStatus(mat66) === "INCOMING",
  "G1-T6: Material 66M (WAITING with route) is INCOMING",
  "got=" + HTDashboard.computePartStatus(mat66)
);

// 1f. Material 4M (FINISH_NG) should be PRODUKSI - NG
const mat4 = DB.findByKode("4M");
assert(
  HTDashboard.computePartStatus(mat4) === "PRODUKSI - NG",
  "G1-T7: Material 4M (FINISH_NG) is PRODUKSI - NG",
  "got=" + HTDashboard.computePartStatus(mat4)
);

// 1g. Verify INCOMING count matches actual WAITING count
const allIncoming = DB.get("materials").filter(m => HTDashboard.computePartStatus(m) === "INCOMING");
assert(
  allIncoming.length === waitingMats.length,
  "G1-T8: INCOMING count matches WAITING count",
  "incoming=" + allIncoming.length + " waiting=" + waitingMats.length
);

// ====================================================================
// TEST GROUP 2: Monthly Target Achievement
// ====================================================================
console.log("\n=== TEST GROUP 2: Monthly Target Achievement ===\n");

// 2a. October 2026 — no deliveries, target exists → percentage should be 0 not 6
const octTarget = DB.get("targets").find(t => t.year === 2026 && t.month === 10);
if (octTarget) {
  const octOutput = HTDashboard._getMonthlyDeliveryWeight(2026, 10);
  const octTargetVal = parseFloat(octTarget.target_berat_output);
  const octPct = octTargetVal > 0 ? Math.round((octOutput / octTargetVal) * 100) : null;
  assert(
    octOutput === 0,
    "G2-T1: October 2026 delivery output is 0",
    "got=" + octOutput
  );
  assert(
    octPct === 0,
    "G2-T2: October 2026 target percentage is 0% (not cumulative)",
    "got=" + octPct
  );
}

// 2b. January 2026 — has delivery
const janOutput = HTDashboard._getMonthlyDeliveryWeight(2026, 1);
const janTarget = DB.get("targets").find(t => t.year === 2026 && t.month === 1);
const janTargetVal = janTarget ? parseFloat(janTarget.target_berat_output) : 0;
const janPct = janTargetVal > 0 ? Math.round((janOutput / janTargetVal) * 100) : null;
assert(
  janOutput === 175,
  "G2-T3: January 2026 delivery output is 175 KG",
  "got=" + janOutput
);
assert(
  janPct === 3,
  "G2-T4: January 2026 target percentage is 3%",
  "got=" + janPct
);

// 2c. Month with no target
const noTargetOutput = HTDashboard._getMonthlyDeliveryWeight(2025, 5);
const noTargetRecord = DB.get("targets").find(t => t.year === 2025 && t.month === 5);
assert(
  noTargetOutput === 0,
  "G2-T5: Nonexistent month output is 0",
  "got=" + noTargetOutput
);
assert(
  noTargetRecord === undefined,
  "G2-T6: No target record for 2025-05",
  "got=" + (noTargetRecord ? "exists" : "undefined")
);

// 2d. Verify monthly output differs from cumulative total
const allDeliveries = DB.get("deliveries").filter(d => d.status === DB.STATUSES.DELIVERY_DELIVERED);
const materialById = {};
DB.get("materials").forEach(m => { materialById[m.id] = m; });
let cumulativeOutput = 0;
allDeliveries.forEach(d => {
  const mat = materialById[d.material_id];
  if (mat) {
    cumulativeOutput += (parseFloat(d.qty_kirim) || 0) * (parseFloat(mat.berat_part_snapshot) || 0);
  }
});
assert(
  cumulativeOutput > janOutput,
  "G2-T7: Cumulative output exceeds monthly output",
  "cumulative=" + cumulativeOutput + " monthly=" + janOutput
);

// ====================================================================
// TEST GROUP 3: Chart Labels Accuracy
// ====================================================================
console.log("\n=== TEST GROUP 3: Chart Labels Accuracy ===\n");

const dashCode = fs.readFileSync(path.join(__dirname, "js", "dashboard.js"), "utf8");

// Verify chart labels have been updated
assert(
  dashCode.includes("Output Delivery (KG)"),
  "G3-T1: Chart label updated to 'Output Delivery (KG)'",
  ""
);
assert(
  !dashCode.includes("Output Produksi (KG)"),
  "G3-T2: Old label 'Output Produksi (KG)' removed",
  ""
);
assert(
  !dashCode.includes("Output Aktual (KG)"),
  "G3-T3: Old label 'Output Aktual (KG)' removed",
  ""
);

// ====================================================================
// TEST GROUP 4: Status Regression — no regressions
// ====================================================================
console.log("\n=== TEST GROUP 4: Status Regression ===\n");

// Material 71M (ready for Shotblast) should NOT be INCOMING
const mat71 = DB.findByKode("71M");
assert(
  HTDashboard.computePartStatus(mat71) !== "INCOMING",
  "G4-T1: Material 71M (ready Shotblast) is NOT INCOMING",
  "got=" + HTDashboard.computePartStatus(mat71)
);
assert(
  HTDashboard.computePartStatus(mat71) === "PROSES PRODUKSI",
  "G4-T2: Material 71M is PROSES PRODUKSI (next process available)",
  "got=" + HTDashboard.computePartStatus(mat71)
);

// Material 91M-95M (ready delivery) should be READY DELIVERY
const mat91 = DB.findByKode("91M");
assert(
  HTDashboard.computePartStatus(mat91) === "READY DELIVERY",
  "G4-T3: Material 91M is READY DELIVERY",
  "got=" + HTDashboard.computePartStatus(mat91)
);

// Material 96M-100M (delivered) should be DELIVERY
const mat96 = DB.findByKode("96M");
assert(
  HTDashboard.computePartStatus(mat96) === "DELIVERY",
  "G4-T4: Material 96M is DELIVERY",
  "got=" + HTDashboard.computePartStatus(mat96)
);

// Material 4M (FINISH_NG) should be PRODUKSI - NG
assert(
  HTDashboard.computePartStatus(mat4) === "PRODUKSI - NG",
  "G4-T5: Material 4M is PRODUKSI - NG (regression check)",
  "got=" + HTDashboard.computePartStatus(mat4)
);

// Material 5M (FINISH+OK, no route beyond HT) should not be INCOMING
const mat5 = DB.findByKode("5M");
assert(
  HTDashboard.computePartStatus(mat5) !== "INCOMING",
  "G4-T6: Material 5M (FINISH+OK) is NOT INCOMING",
  "got=" + HTDashboard.computePartStatus(mat5)
);

// Summary
console.log("\n==========================================");
console.log("  DASHBOARD TEST SUMMARY");
console.log("  Total: " + (passed + failed) + " | Passed: " + passed + " | Failed: " + failed);
console.log("==========================================\n");

if (failed > 0) {
  console.log("  FAILED:");
  results.filter(r => !r.pass).forEach(r => console.log("    [FAIL] " + r.name + (r.detail ? " - " + r.detail : "")));
  process.exit(1);
} else {
  console.log("  ALL TESTS PASSED ✓");
}
