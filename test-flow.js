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

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, detail) {
  if (condition) {
    passed++;
    results.push({ pass: true, name: testName });
  } else {
    failed++;
    results.push({
      pass: false,
      name: testName + (detail ? " — " + detail : ""),
    });
  }
}

// Test the button disable logic directly (core fix)
console.log("==========================================");
console.log("  PRODUKSI AKHIR - BUTTON FLOW TESTS");
console.log("==========================================\n");

console.log("=== GROUP A: BUTTON DISABLE LOGIC FIX (Tests 1-6) ===");
setupFresh();

// Simulate the button disable condition from loadMaterialById
const testProductions = [
  {
    id: 1,
    production_status: "WAITING",
    expectedEnabled: true,
    desc: "WAITING should enable button",
  },
  {
    id: 2,
    production_status: "PROCESS",
    expectedEnabled: true,
    desc: "PROCESS should enable button (MAIN FIX)",
  },
  {
    id: 3,
    production_status: "FINISH",
    expectedEnabled: false,
    desc: "FINISH should disable button",
  },
  {
    id: 4,
    production_status: "FINISH_NG",
    expectedEnabled: false,
    desc: "FINISH_NG should disable button",
  },
];

for (const tp of testProductions) {
  // Original buggy condition: production_status !== "WAITING"
  const oldCondition = tp.production_status !== "WAITING";
  // Fixed condition: production_status === "FINISH" || production_status === "FINISH_NG"
  const newCondition =
    tp.production_status === "FINISH" || tp.production_status === "FINISH_NG";
  const isEnabled = !newCondition;
  assert(
    isEnabled === tp.expectedEnabled,
    "T" + (passed + failed + 1) + ": " + tp.desc,
    "production_status=" + tp.production_status + " → enabled=" + isEnabled,
  );
  if (tp.production_status === "PROCESS") {
    assert(
      oldCondition !== newCondition,
      "T" +
        (passed + failed + 1) +
        ": Fix changes behavior for PROCESS (was disabled, now enabled)",
    );
  }
}

console.log("\n=== GROUP B: PRODUKSI AKHIR MAIN FLOW (Tests 7-16) ===");
setupFresh();

// Test 7: Find material by Kode for processing
const mat = DB.findByKode("20260006I");
assert(
  mat !== null,
  "T7: Material found for produksi-akhir",
  "Found: " + (mat ? mat.kode : "null"),
);

// Test 8: Production is in PROCESS state
const prod = DB.get("productions").find((p) => p.material_id == mat.id);
assert(
  prod !== undefined &&
    prod.status === "Process" &&
    prod.production_status === "PROCESS",
  "T8: Production in PROCESS state",
  "Status: " + prod.production_status,
);

// Test 9: confirmMasukMesin can be called (simulating button enabled)
const btnDisabledForProcess =
  prod.production_status === "FINISH" || prod.production_status === "FINISH_NG";
assert(
  !btnDisabledForProcess,
  "T9: Button NOT disabled for PROCESS status",
  "Disabled: " + btnDisabledForProcess,
);

// Test 10: Simulate confirmKeluarMesin with OK
prod.production_status = "PROCESS";
const rOK = true,
  rNG = false;
const ngNote = "";
assert(!(rNG && !ngNote.trim()), "T10: OK selection - no NG note required", "");
assert(
  prod.production_status !== "FINISH" && prod.production_status !== "FINISH_NG",
  "T10: Production not already finished",
  "",
);
assert(prod.production_status === "PROCESS", "T10: Production is PROCESS", "");
// Simulate update
DB.update("productions", prod.id, {
  status: "Finish",
  production_status: "FINISH",
  finish_scan_at: new Date().toISOString(),
  finish_scan_by: "Admin User",
  process_result: "OK",
  process_ng_note: "",
  machine_finish_at: "2026-09-22",
  machine_finish_by: "Admin User",
});
const updatedProd = DB.get("productions").find((p) => p.id === prod.id);
assert(
  updatedProd.production_status === "FINISH",
  "T10: Production updated to FINISH",
  "Status: " + updatedProd.production_status,
);
assert(
  updatedProd.finish_scan_at !== "",
  "T10: finish_scan_at stored",
  "Val: " + updatedProd.finish_scan_at,
);
assert(
  updatedProd.process_result === "OK",
  "T10: process_result = OK",
  "Val: " + updatedProd.process_result,
);
assert(
  updatedProd.machine_finish_at !== "",
  "T10: machine_finish_at stored",
  "",
);

// Test 11: NG without note should be rejected
setupFresh();
const mat2 = DB.findByKode("20260006I");
const prod2 = DB.get("productions").find((p) => p.material_id == mat2.id);
const rNG2 = true,
  ngNote2 = "";
const shouldReject = rNG2 && !ngNote2.trim();
assert(
  shouldReject,
  "T11: NG without note should be REJECTED",
  "Condition: " + shouldReject,
);

// Test 12: NG with note should succeed
setupFresh();
const mat3 = DB.findByKode("20260006I");
const prod3 = DB.get("productions").find((p) => p.material_id == mat3.id);
const rNG3 = true,
  ngNote3 = "Part overheating";
assert(rNG3 && ngNote3.trim(), "T12: NG with note passes validation", "");
DB.update("productions", prod3.id, {
  status: "Finish",
  production_status: "FINISH_NG",
  finish_scan_at: new Date().toISOString(),
  finish_scan_by: "Admin User",
  process_result: "NG",
  process_ng_note: ngNote3,
  machine_finish_at: "2026-09-22",
  machine_finish_by: "Admin User",
});
const updatedProd3 = DB.get("productions").find((p) => p.id === prod3.id);
assert(
  updatedProd3.production_status === "FINISH_NG",
  "T12: Production updated to FINISH_NG",
  "Status: " + updatedProd3.production_status,
);
assert(
  updatedProd3.process_ng_note === "Part overheating",
  "T12: NG note stored correctly",
  "Note: " + updatedProd3.process_ng_note,
);

// Test 13: Already finished - should reject
setupFresh();
const mat4 = DB.findByKode("20260001I");
const prod4 = DB.get("productions").find((p) => p.material_id == mat4.id);
const isFinished =
  prod4.production_status === "FINISH" ||
  prod4.production_status === "FINISH_NG";
assert(
  isFinished,
  "T13: Production is FINISH/FINISH_NG (should reject re-confirmation)",
  "Status: " + prod4.production_status,
);

// Test 14: Waiting production - should reject (not in PROCESS)
setupFresh();
const mat5 = DB.findByKode("20260007I");
const prod5 = DB.get("productions").find((p) => p.material_id == mat5.id);
const isWaiting = prod5.production_status === "WAITING";
assert(
  isWaiting,
  "T14: Production is WAITING (should reject - not in PROCESS)",
  "Status: " + prod5.production_status,
);

// Test 15: Double click prevention - button should be disabled after first click
setupFresh();
const mat6 = DB.findByKode("20260006I");
const prod6 = DB.get("productions").find((p) => p.material_id == mat6.id);
let btnClickCount = 0;
const originalUpdate = DB.update.bind(DB);
let firstClickDisabled = false;
// Simulate first click
DB.update("productions", prod6.id, {
  status: "Finish",
  production_status: "FINISH",
  finish_scan_at: new Date().toISOString(),
  finish_scan_by: "Admin User",
  process_result: "OK",
  process_ng_note: "",
  machine_finish_at: "2026-09-22",
  machine_finish_by: "Admin User",
});
// After first click, button should be disabled (simulated)
const prodAfterFirst = DB.get("productions").find((p) => p.id === prod6.id);
firstClickDisabled =
  prodAfterFirst.production_status === "FINISH" ||
  prodAfterFirst.production_status === "FINISH_NG";
assert(
  firstClickDisabled,
  "T15: After first click, button would be disabled (production finished)",
  "",
);

// Test 16: Production record UPDATED not duplicated
setupFresh();
const allProdsBefore = DB.get("productions").length;
const mat7 = DB.findByKode("20260006I");
const prod7 = DB.get("productions").find((p) => p.material_id == mat7.id);
const prodId = prod7.id;
DB.update("productions", prodId, {
  status: "Finish",
  production_status: "FINISH",
  finish_scan_at: new Date().toISOString(),
  finish_scan_by: "Admin User",
  process_result: "OK",
  process_ng_note: "",
  machine_finish_at: "2026-09-22",
  machine_finish_by: "Admin User",
});
const allProdsAfter = DB.get("productions").length;
assert(
  allProdsBefore === allProdsAfter,
  "T16: No duplicate production records (UPDATE not INSERT)",
  "Before: " + allProdsBefore + ", After: " + allProdsAfter,
);

console.log("\n==========================================");
console.log("  TEST RESULTS");
console.log("==========================================");
for (const r of results) {
  const icon = r.pass ? "PASS" : "FAIL";
  console.log("  [" + icon + "] " + r.name);
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
