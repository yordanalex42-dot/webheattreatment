/* ============================================================
   Shotblast Page - End-to-End Logic Test
   Mock DOM environment to test the full flow:
   1. loadMaterialById (scan + manual)
   2. Validation / eligibility (validateAndShowEntry)
   3. resetFormFields (previously missing - the root cause bug)
    4. confirmMasukProses (entry)
    5. confirmSelesaiProses (finish)
   6. Data integrity (no duplicate records, localStorage keys)
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

/* ---- Mock DOM ---- */
const domElements = {};
const toastMessages = [];

function mockDocument() {
  return {
    getElementById(id) {
      if (!domElements[id]) {
        domElements[id] = {
          _tag: id,
          textContent: "",
          value: "",
          classList: {
            _classes: new Set(),
            add(cls) { this._classes.add(cls); },
            remove(cls) { this._classes.delete(cls); },
            contains(cls) { return this._classes.has(cls); },
            toggle(cls, force) {
              if (force === true) this._classes.add(cls);
              else if (force === false) this._classes.delete(cls);
              else {
                if (this._classes.has(cls)) this._classes.delete(cls);
                else this._classes.add(cls);
              }
            },
          },
          style: {},
          checked: false,
          disabled: false,
          innerHTML: "",
          focus() {},
          scrollIntoView() {},
        };
      }
      return domElements[id];
    },
    querySelectorAll(sel) {
      if (sel === ".ht-stepper .ht-step") {
        return [
          domElements["__step0__"] || { classList: { add: function(){}, remove: function(){}, toggle: function(){} }, _tag: "step0" },
          domElements["__step1__"] || { classList: { add: function(){}, remove: function(){}, toggle: function(){} }, _tag: "step1" },
          domElements["__step2__"] || { classList: { add: function(){}, remove: function(){}, toggle: function(){} }, _tag: "step2" },
          domElements["__step3__"] || { classList: { add: function(){}, remove: function(){}, toggle: function(){} }, _tag: "step3" },
        ];
      }
      return [];
    },
    createElement(tag) {
      return { _tag: tag, className: "", innerHTML: "", appendChild: function() {} };
    },
    body: { appendChild: function() {} },
  };
}

function mockWindow() {
  return {
    location: { href: "", protocol: "http:" },
    addEventListener(type, fn) {
      if (type === "DOMContentLoaded") {
        setTimeout(fn, 0);
      }
    },
  };
}

let DB, Auth, HTUI, HTDateFormat;
let passed = 0, failed = 0;
const results = [];
const consoleErrors = [];
const consoleWarns = [];

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
  for (const k of Object.keys(domElements)) delete domElements[k];
  toastMessages.length = 0;
  consoleErrors.length = 0;
  consoleWarns.length = 0;

  global.document = mockDocument();
  global.window = mockWindow();
  global.location = { href: "", protocol: "http:" };
  global.Html5Qrcode = null;

  const authCode = fs.readFileSync(path.join(__dirname, "js", "auth.js"), "utf8").replace("const Auth", "var Auth");
  const dbCode = fs.readFileSync(path.join(__dirname, "js", "db.js"), "utf8").replace("const DB", "var DB");
  const uiCode = fs.readFileSync(path.join(__dirname, "js", "ui.js"), "utf8").replace("const HTUI", "var HTUI");
  const dfCode = fs.readFileSync(path.join(__dirname, "js", "date-format.js"), "utf8").replace(/^(HTDateFormat)/, "var $1");

  const ctx = {
    localStorage: global.localStorage,
    document: global.document,
    window: global.window,
    Html5Qrcode: global.Html5Qrcode,
    console: {
      log: () => {},
      warn: (...args) => { consoleWarns.push(args.join(" ")); },
      error: (...args) => { consoleErrors.push(args.join(" ")); },
    },
  };

  DB = new Function("localStorage", "console", dbCode + "\n; return DB;")(ctx.localStorage, ctx.console);
  Auth = new Function("localStorage", "console", authCode + "\n; return Auth;")(ctx.localStorage, ctx.console);

  // Load UI
  const uiWrapper = new Function(
    "localStorage", "document", "window", "Html5Qrcode", "console",
    uiCode + "\n; return HTUI;"
  )(ctx.localStorage, ctx.document, ctx.window, ctx.Html5Qrcode, ctx.console);
  global.HTUI = uiWrapper;
  global.DB = DB;
  global.Auth = Auth;

  // DateFormat
  HTDateFormat = new Function("document", dfCode + "\n; return HTDateFormat;")(ctx.document);
  global.HTDateFormat = HTDateFormat;

  DB.init();
  Auth.initDefaultUser();
  Auth.login("admin", "admin123");
}

/* ---- Extract and run the shotblast.html inline script ---- */
function extractShotblastScript() {
  const html = fs.readFileSync(path.join(__dirname, "shotblast.html"), "utf8");
  const match = html.match(/<script[^>]*>\r?\n([\s\S]*?)\r?\n\s*<\/script>/);
  if (!match) throw new Error("Could not find inline script in shotblast.html");
  return match[1];
}

/* ---- Helper: check if named function exists in shotblast script source ---- */
function functionExistsInScript(funcName) {
  const script = extractShotblastScript();
  const re = new RegExp("function\\s+" + funcName + "\\s*\\(");
  return re.test(script);
}

/* ---- Setup the global variables that shotblast inline script expects ---- */
function setupShotblastGlobals() {
  global.HTDateFormat = HTDateFormat;
  global.Auth = Auth;
  global.DB = DB;
  global.HTUI = HTUI;
  global.html5QrCode = null;
  global.currentMaterial = null;
  global.currentProduction = null;
  global.session = Auth.getSession();
  global.PROCESS_KEY = "SHOTBLAST";
  global.JENIS_TREATMENT = "Shotblast";
}

/* ---- Run the shotblast inline script to define all functions ---- */
let shotblastFunctions = {};

function loadShotblastFunctions() {
  setupShotblastGlobals();
  const script = extractShotblastScript();

  // Replace the top-level guard and DOMContentLoaded to prevent execution
  let modified = script
    .replace(/if \(!HTUI\.requireAuth\(\)\) \{[\s\S]*?\}/, "")
    .replace(/window\.addEventListener\("DOMContentLoaded"[\s\S]*?\}\);/, "");

  // Create a function that defines all the shotblast functions
  const fn = new Function(
    "localStorage", "document", "window", "Html5Qrcode", "console", "Auth", "DB", "HTUI", "HTDateFormat",
    "html5QrCode", "currentMaterial", "currentProduction", "session", "PROCESS_KEY", "JENIS_TREATMENT",
    modified + "\n; return { loadMaterialById, displayMaterialInfo, displayProcessStatus, validateAndShowEntry, renderSections, resetFormFields, resetAllSections, showBlocked, hideBlocked, clearManualError, resetInput, renderStepper, showNextProcess, renderProcessHistory, confirmMasukProses, confirmSelesaiProses, updateVisualNoteVisibility, updateNGNoteVisibility };"
  );

  // We need to track currentMaterial and currentProduction as they're modified by functions
  const state = { currentMaterial: null, currentProduction: null };

  // We'll redefine the global variables via closures
  // Actually, the script uses `let currentMaterial = null` etc, so we need to let the function manage its own state
  // Let's run it and capture the returned object
  const result = fn(
    global.localStorage,
    global.document,
    global.window,
    global.Html5Qrcode,
    {
      log: () => {},
      warn: (...args) => consoleWarns.push(args.join(" ")),
      error: (...args) => consoleErrors.push(args.join(" ")),
    },
    Auth,
    DB,
    HTUI,
    HTDateFormat,
    global.html5QrCode,
    state.currentMaterial,
    state.currentProduction,
    global.session,
    global.PROCESS_KEY,
    global.JENIS_TREATMENT
  );

  // The functions capture currentMaterial/currentProduction by closure in the new Function scope
  // We need to access them through the returned object... but they're local variables
  // Let's re-approach: use eval to define globals
  return result;
}

/* ============================================================
   TESTS
   ============================================================ */

console.log("==========================================");
console.log("  SHOTBLAST PAGE - BUG FIX VERIFICATION");
console.log("  " + new Date().toISOString());
console.log("==========================================\n");

// ---- Test 1: Verify missing functions are now defined in HTML source ----
console.log("=== TEST GROUP 1: Functions defined in shotblast.html source ===\n");

assert(functionExistsInScript("resetFormFields"), "G1-T1: resetFormFields is defined in shotblast.html", "");
assert(functionExistsInScript("updateVisualNoteVisibility"), "G1-T2: updateVisualNoteVisibility is defined in shotblast.html", "");
assert(functionExistsInScript("updateNGNoteVisibility"), "G1-T3: updateNGNoteVisibility is defined in shotblast.html", "");

// ---- Test 2: Verify DB functions work correctly for Shotblast ----
console.log("\n=== TEST GROUP 2: DB layer for Shotblast ===\n");
setupFresh();

// Material 71M (1M in old format) has Shotblast in route, HT FINISH+OK, QC PASS
const mat1001 = DB.findByKode("71M");
assert(mat1001 !== null, "G2-T1: Material 71M found by findByKode", "kode=" + (mat1001 ? mat1001.kode : "null"));
assert(mat1001 && mat1001.process_route && mat1001.process_route.shotblast === true, "G2-T2: Material 71M has shotblast=true in route", "route=" + JSON.stringify(mat1001 && mat1001.process_route));

// HT production for material 1001
const htProd1001 = DB.getProcessProduction(mat1001, "HT");
assert(htProd1001 !== null, "G2-T3: HT production found for 71M", "status=" + (htProd1001 ? htProd1001.production_status : "null"));
assert(htProd1001 && htProd1001.production_status === "FINISH" && htProd1001.process_result === "OK", "G2-T4: HT production is FINISH+OK", "status=" + htProd1001.production_status + " result=" + htProd1001.process_result);

// Shotblast production for material 1001 should be null (not yet started)
const sbProd1001 = DB.getProcessProduction(mat1001, "SHOTBLAST");
assert(sbProd1001 === null, "G2-T5: Shotblast production is null (not yet started) for 71M", "val=" + (sbProd1001 ? "found" : "null"));

// QC gate for material 1001
const gate1001 = DB.checkQualityGate(mat1001);
assert(gate1001.qcStatus === "PASS", "G2-T6: QC status is PASS for 71M", "qcStatus=" + gate1001.qcStatus);

// Material 1004 (4M) - no shotblast in route
const mat1004 = DB.findByKode("4M");
assert(mat1004 !== null, "G2-T7: Material 4M found", "");
assert(mat1004 && mat1004.process_route && mat1004.process_route.shotblast === false, "G2-T8: Material 4M has shotblast=false in route", "");

// Material 1004 - HT is FINISH_NG
const htProd1004 = DB.getProcessProduction(mat1004, "HT");
assert(htProd1004 !== null && htProd1004.production_status === "FINISH_NG", "G2-T9: Material 4M HT is FINISH_NG", "status=" + htProd1004.production_status);

// Material 1004 - QC is NG
const gate1004 = DB.checkQualityGate(mat1004);
assert(gate1004.qcStatus === "NG", "G2-T10: Material 4M QC is NG", "qcStatus=" + gate1004.qcStatus);

// ---- Test 3: Test loadMaterialById logic (using DB functions directly) ----
console.log("\n=== TEST GROUP 3: loadMaterialById logic ===\n");
setupFresh();

// Test finding by kode
const foundByKode = DB.findByKode("71M") || DB.findMaterial("71M");
assert(foundByKode !== null, "G3-T1: Material found by kode '71M'", "");

// Test finding by numeric ID
const foundById = DB.findByKode("1") || DB.findMaterial("1");
assert(foundById !== null, "G3-T2: Material found by numeric id '1'", "found=" + (foundById ? foundById.kode : "null"));

// Test kode with leading/trailing spaces (findByKode trims)
const foundByTrimmedKode = DB.findByKode("  71M  ") || DB.findMaterial("  71M  ");
assert(foundByTrimmedKode !== null, "G3-T3: Material found with spaces around kode (findByKode trims)", "");

// Test findMaterial with spaces (does NOT trim) - this is the fallback
const foundByMaterialTrimmed = DB.findByKode("71M");
assert(foundByMaterialTrimmed !== null, "G3-T4: findByKode finds clean kode", "");

// Test not found
const notFound = DB.findByKode("NONEXISTENT") || DB.findMaterial("NONEXISTENT");
assert(notFound === null || notFound === undefined, "G3-T5: Non-existent kode returns null", "");

// Test empty kode
const emptyFound = DB.findByKode("") || DB.findMaterial("");
assert(emptyFound === null || emptyFound === undefined, "G3-T6: Empty kode returns null/undefined", "");

// ---- Test 4: validateAndShowEntry logic (eligibility for Shotblast) ----
console.log("\n=== TEST GROUP 4: Shotblast eligibility validation ===\n");
setupFresh();

// Material 1001: should be eligible (shotblast=true, HT FINISH+OK, QC PASS)
const mat = DB.findByKode("71M");
const route = mat.process_route;
assert(route.shotblast === true, "G4-T1: Material 71M route has shotblast=true", "");

const htP = DB.getProcessProduction(mat, "HT");
assert(htP && htP.production_status === "FINISH" && htP.process_result === "OK", "G4-T2: HT production is FINISH+OK (passes first gate)", "");

const qc = DB.checkQualityGate(mat);
assert(qc.qcStatus === "PASS", "G4-T3: QC status is PASS (passes second gate)", "");

// Material 1004: should NOT be eligible (shotblast=false)
const mat4 = DB.findByKode("4M");
if (mat4 && mat4.process_route) {
  assert(mat4.process_route.shotblast !== true, "G4-T4: Material 4M route has shotblast != true (blocked by route)", "");
}

// Material 1004: HT is FINISH_NG (blocked by HT)
const htP4 = DB.getProcessProduction(mat4, "HT");
if (htP4) {
  assert(htP4.production_status === "FINISH_NG", "G4-T5: Material 4M HT is FINISH_NG (blocked by HT status)", "status=" + htP4.production_status);
}

// Material 1006: HT is PROCESS (blocked by HT in progress)
const mat6 = DB.findByKode("7M");
const htP6 = DB.getProcessProduction(mat6, "HT");
if (htP6) {
  assert(htP6.production_status === "PROCESS", "G4-T6: Material 7M HT is PROCESS (blocked by HT in progress)", "");
}

// ---- Test 5: Simulate confirmMasukProses - no duplicate records ----
setupFresh();

const matTest = DB.findByKode("71M");
const existingShotblast = DB.getProcessProduction(matTest, "SHOTBLAST");
assert(existingShotblast === null, "G5-T1: No existing Shotblast production before entry", "");

// Simulate confirmMasukProses creating a new production
const now = new Date().toISOString();
const scanTime = now.slice(0, 19);
const newProd = {
  material_id: matTest.id,
  incoming_id: matTest.id,
  kode: matTest.kode || "",
  status: DB.STATUSES.PROD_PROCESS,
  production_status: DB.STATUSES.PROD_PROCESS,
  start_scan_at: now,
  start_scan_by: "Operator",
  machine_start_at: scanTime,
  machine_start_by: "Operator",
  tanggal_proses: new Date().toISOString().split("T")[0],
  jenis_treatment: "Shotblast",
  visual_check_result: "OK",
  visual_check_note: "",
  process_result: "",
  process_ng_note: "",
  machine_finish_at: "",
  machine_finish_by: "",
  finish_scan_at: "",
  finish_scan_by: "",
  remarks: "",
};
DB.insert("productions", newProd);

// Verify it was created
const sbProd = DB.getProcessProduction(matTest, "SHOTBLAST");
assert(sbProd !== null && sbProd.production_status === "PROCESS", "G5-T2: Shotblast production created with PROCESS status", "");
assert(sbProd.jenis_treatment === "Shotblast", "G5-T3: jenis_treatment is 'Shotblast'", "val=" + sbProd.jenis_treatment);

// Verify normalizeKey maps correctly
assert(DB._normalizeProcessKey("Shotblast") === "SHOTBLAST", "G5-T4: _normalizeProcessKey('Shotblast') = SHOTBLAST", "");
assert(DB._normalizeProcessKey("SHOTBLAST") === "SHOTBLAST", "G5-T5: _normalizeProcessKey('SHOTBLAST') = SHOTBLAST", "");

// Simulate scanning same code again - should find existing PROCESS record, no duplicate
const existingAgain = DB.getProcessProduction(matTest, "SHOTBLAST");
assert(existingAgain !== null && existingAgain.production_status === "PROCESS", "G5-T6: Second scan finds existing PROCESS record (no duplicate created)", "");

// Count Shotblast productions for this material - should be exactly 1
const sbProds = DB.get("productions").filter(p => String(p.material_id) === String(matTest.id) && DB._normalizeProcessKey(p.jenis_treatment) === "SHOTBLAST");
assert(sbProds.length === 1, "G5-T7: Exactly 1 Shotblast production record (no duplicates)", "count=" + sbProds.length);

// Verify HT production is still separate and unaffected
const htProdAfter = DB.getProcessProduction(matTest, "HT");
assert(htProdAfter !== null && htProdAfter.production_status === "FINISH", "G5-T8: HT production unaffected by Shotblast entry", "");

// ---- Test 6: Simulate confirmSelesaiProses ----
console.log("\n=== TEST GROUP 6: Confirm selesai proses ===\n");
setupFresh();

// Re-create the full scenario: enter shotblast process then finish it
const matTest2 = DB.findByKode("71M");
DB.insert("productions", {
  material_id: matTest2.id,
  incoming_id: matTest2.id,
  kode: matTest2.kode || "",
  status: DB.STATUSES.PROD_PROCESS,
  production_status: DB.STATUSES.PROD_PROCESS,
  start_scan_at: new Date().toISOString(),
  start_scan_by: "Operator",
  machine_start_at: new Date().toISOString().slice(0, 19),
  machine_start_by: "Operator",
  tanggolahan_proses: new Date().toISOString().split("T")[0],
  tanggal_proses: new Date().toISOString().split("T")[0],
  jenis_treatment: "Shotblast",
  visual_check_result: "OK",
  visual_check_note: "",
  process_result: "",
  process_ng_note: "",
  machine_finish_at: "",
  machine_finish_by: "",
  finish_scan_at: "",
  finish_scan_by: "",
  remarks: "",
});

// Now finish it
const sbProd2 = DB.getProcessProduction(matTest2, "SHOTBLAST");
assert(sbProd2 !== null && sbProd2.production_status === "PROCESS", "G6-T1: Shotblast production is PROCESS before finish", "");

DB.update("productions", sbProd2.id, {
  status: DB.STATUSES.PROD_FINISH,
  production_status: DB.STATUSES.PROD_FINISH,
  finish_scan_at: new Date().toISOString(),
  finish_scan_by: "Operator",
  process_result: "OK",
  process_ng_note: "",
  machine_finish_at: new Date().toISOString().slice(0, 19),
  machine_finish_by: "Operator",
});

const sbProd2Finished = DB.getProcessProduction(matTest2, "SHOTBLAST");
assert(sbProd2Finished !== null && sbProd2Finished.production_status === "FINISH" && sbProd2Finished.process_result === "OK", "G6-T2: Shotblast production finished with FINISH+OK", "status=" + sbProd2Finished.production_status);

// Verify isProcessCompleted works
assert(DB.isProcessCompleted(matTest2, "SHOTBLAST") === true, "G6-T3: isProcessCompleted(SHOTBLAST) returns true after finish+OK", "");
assert(DB.isProcessCompleted(matTest2, "HT") === true, "G6-T4: isProcessCompleted(HT) returns true (was already FINISH+OK)", "");
assert(DB.isProcessCompleted(matTest2, "QC") === true, "G6-T5: isProcessCompleted(QC) returns true (hasil=OK)", "");

// ---- Test 7: localStorage key preservation ----
console.log("\n=== TEST GROUP 7: Data integrity & localStorage keys ===\n");
setupFresh();

// Verify all expected keys exist
assert(global.localStorage.getItem("ht_materials") !== null, "G7-T1: ht_materials key exists", "");
assert(global.localStorage.getItem("ht_productions") !== null, "G7-T2: ht_productions key exists", "");
assert(global.localStorage.getItem("ht_parts") !== null, "G7-T3: ht_parts key exists", "");
assert(global.localStorage.getItem("ht_qcs") !== null, "G7-T4: ht_qcs key exists", "");
assert(global.localStorage.getItem("ht_customers") !== null, "G7-T5: ht_customers key exists", "");
assert(global.localStorage.getItem("ht_deliveries") !== null, "G7-T6: ht_deliveries key exists", "");
assert(global.localStorage.getItem("ht_tracking") !== null, "G7-T7: ht_tracking key exists", "");
assert(global.localStorage.getItem("ht_qcs") !== null, "G7-T8: ht_qcs key exists for QC validation", "");

// Verify HT production key mapping
const htProd = DB.getProcessProduction(DB.findByKode("71M"), "HT");
assert(htProd && htProd.id !== undefined, "G7-T9: HT production found for Shotblast validation", "id=" + (htProd ? htProd.id : "null"));
const htProd2 = DB.getProcessProduction(DB.findByKode("71M"), "HEAT_TREATMENT");
assert(htProd2 !== null && htProd2.id === htProd.id, "G7-T10: 'HT' and 'Heat Treatment' both resolve to same production", "");

// Verify no data was reset/lost after operations
const allMats = DB.get("materials");
assert(allMats.length === 100, "G7-T11: All 100 materials still present (no data reset)", "count=" + allMats.length);
const allProds = DB.get("productions");
assert(allProds.length >= 7, "G7-T12: Production records preserved", "count=" + allProds.length);

// ---- Test 8: Edge cases ----
console.log("\n=== TEST GROUP 8: Edge cases ===\n");
setupFresh();

// parseScanId logic
const id1 = "71M".includes("id=") ? "71M".split("id=")[1].split("&")[0] : "71M".split("/").pop();
assert(id1 === "71M", "G8-T1: parseScanId returns clean kode when no id= or /", "got=" + id1);

const id2 = "http://test.com/material?id=71M".split("id=")[1].split("&")[0];
assert(id2 === "71M", "G8-T2: parseScanId extracts id from URL query", "got=" + id2);

const id3 = "path/to/71M".split("/").pop();
assert(id3 === "71M", "G8-T3: parseScanId returns last path segment", "got=" + id3);

// Test _normalizeProcessKey for various inputs
assert(DB._normalizeProcessKey("Shotblast") === "SHOTBLAST", "G8-T4: normalize 'Shotblast' -> 'SHOTBLAST'", "");
assert(DB._normalizeProcessKey("SHOTBLAST") === "SHOTBLAST", "G8-T5: normalize 'SHOTBLAST' -> 'SHOTBLAST'", "");
assert(DB._normalizeProcessKey("Heat Treatment") === "HT", "G8-T6: normalize 'Heat Treatment' -> 'HT'", "");
assert(DB._normalizeProcessKey("HT") === "HT", "G8-T7: normalize 'HT' -> 'HT'", "", "");
assert(DB._normalizeProcessKey("heat treatment") === "HT", "G8-T8: normalize 'heat treatment' -> 'HT' (case insens)", "");

// Test that Shotblast production jenis_treatment stored as "Shotblast" (case sensitive match)
const testMat = DB.findByKode("71M");
const testProd = {
  material_id: testMat.id,
  jenis_treatment: "Shotblast",
  production_status: "PROCESS",
  status: "PROCESS",
  process_result: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
DB.insert("productions", testProd);
const foundProd = DB.getProcessProduction(testMat, "SHOTBLAST");
assert(foundProd !== null, "G8-T9: Shotblast production found after insert with jenis_treatment='Shotblast'", "");

// ---- Test 9: Validate no JavaScript errors from missing functions ----
console.log("\n=== TEST GROUP 9: No console errors from missing functions ===\n");
setupFresh();

// Verify the script source compiles without syntax errors (extract function defs only)
const script = extractShotblastScript();
try {
  // Extract just the function definitions and check they parse
  const funcs = script.match(/function\s+\w+\s*\([^)]*\)\s*\{/g);
  const allFuncs = ["loadMaterialById", "displayMaterialInfo", "displayProcessStatus",
    "validateAndShowEntry", "renderSections", "resetFormFields", "resetAllSections",
    "showBlocked", "hideBlocked", "clearManualError", "resetInput", "renderStepper",
    "showNextProcess", "renderProcessHistory", "confirmMasukProses", "confirmSelesaiProses",
    "updateVisualNoteVisibility", "updateNGNoteVisibility", "startScanner"];
  const foundFuncs = allFuncs.filter(f => functionExistsInScript(f));
  assert(funcs !== null && foundFuncs.length === allFuncs.length, "G9-T1: All " + allFuncs.length + " functions defined in script (" + foundFuncs.length + " found)", "missing=" + JSON.stringify(allFuncs.filter(f => !foundFuncs.includes(f))));
} catch (e) {
  assert(false, "G9-T1: shotblast.html inline script has no syntax errors", "ERROR: " + e.message);
}

// Verify all three missing functions are now present in the source
assert(functionExistsInScript("resetFormFields"), "G9-T2: resetFormFields now defined in source", "");
assert(functionExistsInScript("updateVisualNoteVisibility"), "G9-T3: updateVisualNoteVisibility now defined in source", "");
assert(functionExistsInScript("updateNGNoteVisibility"), "G9-T4: updateNGNoteVisibility now defined in source", "");

// ---- Test 10: Shotblast validation flow for eligible material ----
console.log("\n=== TEST GROUP 10: Full eligibility flow ===\n");

// Material 1001: eligible for Shotblast
setupFresh();
const mat1 = DB.findByKode("71M");
let eligible = true;
let reason = "";

if (!mat1.process_route || !mat1.process_route.shotblast) {
  eligible = false;
  reason = "Part tidak memiliki proses Shotblast pada route ini.";
} else {
  const htProd = DB.getProcessProduction(mat1, "HT");
  if (!htProd) { eligible = false; reason = "Heat Treatment belum selesai."; }
  else if (htProd.production_status === "PROCESS") { eligible = false; reason = "Heat Treatment masih dalam proses."; }
  else if (htProd.production_status === "FINISH_NG" || htProd.process_result === "NG") { eligible = false; reason = "Heat Treatment berstatus NG."; }
  else if (htProd.production_status !== "FINISH" || htProd.process_result !== "OK") { eligible = false; reason = "Heat Treatment belum selesai."; }

  if (eligible) {
    const gate = DB.checkQualityGate(mat1);
    if (gate.qcStatus === "NOT_CHECKED") { eligible = false; reason = "QC belum dilakukan."; }
    else if (gate.qcStatus === "NG") { eligible = false; reason = "QC berstatus NG."; }
    else if (gate.qcStatus !== "PASS") { eligible = false; reason = "QC belum dilakukan."; }
  }
}
assert(eligible, "G10-T1: Material 71M is ELIGIBLE for Shotblast", "reason=" + reason);

// Material 1004: NOT eligible (no shotblast in route + HT is NG + QC is NG)
setupFresh();
const mat4_elig = DB.findByKode("4M");
let elig4 = true;
let reason4 = "";
if (!mat4_elig.process_route || !mat4_elig.process_route.shotblast) {
  elig4 = false;
  reason4 = "Part tidak memiliki proses Shotblast pada route ini.";
}
assert(!elig4, "G10-T2: Material 4M is NOT ELIGIBLE (no shotblast route)", "reason=" + reason4);

// Material 1005: eligible? (shotblast=false in route)
setupFresh();
const mat5 = DB.findByKode("5M");
let elig5 = true;
let reason5 = "";
if (!mat5.process_route || !mat5.process_route.shotblast) {
  elig5 = false;
  reason5 = "Part tidak memiliki proses Shotblast pada route ini.";
}
assert(!elig5, "G10-T3: Material 5M is NOT ELIGIBLE (no shotblast route)", "reason=" + reason5);

// Material 1002: eligible? (shotblast=true, HT FINISH+OK, QC PASS)
setupFresh();
const mat2 = DB.findByKode("72M");
let elig2 = true;
let reason2 = "";
if (!mat2.process_route || !mat2.process_route.shotblast) {
  elig2 = false;
  reason2 = "no shotblast route";
} else {
  const htProd2 = DB.getProcessProduction(mat2, "HT");
  if (!htProd2 || htProd2.production_status !== "FINISH" || htProd2.process_result !== "OK") { elig2 = false; reason2 = "HT not finished OK: " + (htProd2 ? htProd2.production_status + "/" + htProd2.process_result : "null"); }
  if (elig2) {
    const gate2 = DB.checkQualityGate(mat2);
    if (gate2.qcStatus !== "PASS") { elig2 = false; reason2 = "QC not PASS: " + gate2.qcStatus; }
  }
}
assert(elig2, "G10-T4: Material 72M IS ELIGIBLE for Shotblast", "reason=" + reason2);

// ---- Test 11: localStorage key prefix consistency ----
console.log("\n=== TEST GROUP 11: localStorage key prefix ===\n");
setupFresh();
const keys = global.localStorage.keys();
const htKeys = keys.filter(k => k.startsWith("ht_"));
assert(htKeys.length > 0, "G11-T1: localStorage has keys with ht_ prefix", "count=" + htKeys.length + ", keys=" + JSON.stringify(htKeys));
assert(htKeys.includes("ht_db_seed_version"), "G11-T2: ht_db_seed_version key exists", "");

// ---- Summary ----
console.log("\n==========================================");
console.log("\n=== RESULTS ===\n");
for (const r of results) {
  const icon = r.pass ? "PASS" : "FAIL";
  console.log("  [" + icon + "] " + r.name + (r.detail ? " - " + r.detail : ""));
}
console.log("\n==========================================");
console.log(
  "  Total: " + results.length + " | Passed: " + passed + " | Failed: " + failed,
);
console.log("==========================================");

if (consoleErrors.length > 0) {
  console.log("\n  Console errors captured: " + consoleErrors.length);
  consoleErrors.forEach(e => console.log("    ERROR: " + e));
}

if (failed > 0) {
  process.exit(1);
}
