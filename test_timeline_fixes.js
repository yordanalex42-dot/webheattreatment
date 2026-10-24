const fs = require("fs");
const path = require("path");

class MemoryStorage {
  constructor() { this.store = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; }
  setItem(key, val) { this.store[key] = String(val); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
  keys() { return Object.keys(this.store); }
}

const domElements = {};
function mockDocument() {
  return {
    getElementById(id) {
      if (!domElements[id]) domElements[id] = {
        _tag: id, textContent: "", value: "", innerHTML: "", style: {},
        classList: { _c: new Set(), add(c){this._c.add(c);}, remove(c){this._c.delete(c);}, contains(c){return this._c.has(c);}, toggle(c,f){if(f===true)this._c.add(c);else if(f===false)this._c.delete(c);else{this._c.has(c)?this._c.delete(c):this._c.add(c);}}, },
        appendChild(c){return c;}, setAttribute(n,v){this[n]=v;}, getAttribute(n){return this[n]||null;}
      };
      return domElements[id];
    },
    createElement(tag) { return mockDocument().getElementById("_" + tag); },
    querySelectorAll(selector) { return []; },
  };
}

global.localStorage = new MemoryStorage();
const dbCode = fs.readFileSync(path.join(__dirname, "js", "db.js"), "utf8").replace("const DB", "var DB");
const DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);
DB.init();
DB.migrate();

global.document = mockDocument();
global.window = { addEventListener(){}, document: global.document, location: {} };
global.Auth = { getSession: () => ({ name: "user" }) };

const HTUI = { requireAuth: () => true };

var passCount = 0;
var failCount = 0;

function check(label, actual, expected) {
  var ok = actual === expected;
  if (ok) { passCount++; } else { failCount++; }
  console.log("  " + (ok ? "PASS" : "FAIL") + " - " + label + ": got \"" + actual + "\"" + (ok ? "" : ", expected \"" + expected + "\""));
}

/* ================================================================
   Bug 1: heat-treatment.html - renderProcessHistory not called
   ================================================================ */
console.log("\n=== Bug 1: heat-treatment.html renderProcessHistory integration ===");
var htHtml = fs.readFileSync(path.join(__dirname, "heat-treatment.html"), "utf8");
check("  historyGrid element in modal HTML", htHtml.includes('id="historyGrid"'), true);
check("  Riwayat Proses heading in modal", htHtml.includes("Riwayat Proses"), true);
check("  renderProcessHistory called in loadMaterialById", htHtml.includes("renderProcessHistory(material)"), true);
check("  No duplicate historyGrid IDs", (htHtml.match(/id="historyGrid"/g) || []).length === 1, true);

/* ================================================================
   Bug 2: Stepper step 2 - completed state on FINISH/FINISH_NG
   ================================================================ */
console.log("\n=== Bug 2: Stepper Step 2 completed on FINISH/FINISH_NG ===");
["heat-treatment.html", "shotblast.html", "anti-rust.html"].forEach(function(f) {
  var html = fs.readFileSync(path.join(__dirname, f), "utf8");
  var fnName = f === "heat-treatment.html" ? "updateStepper" : "renderStepper";

  // Check step 2 uses isProcessDone for completed
  check("  [" + fnName + "] step 2 uses isProcessDone for completed", html.includes('steps[2].classList.toggle(\n          "completed",\n          isProcessDone') ||
    html.includes('steps[2].classList.toggle("completed",isProcessDone') ||
    /steps\[2\]\.classList\.toggle\(\s*"completed"\s*,\s*isProcessDone/.test(html), true);

  // Check step 2 gets "active" class
  check("  [" + fnName + "] step 2 has active class", /steps\[2\]\.classList\.toggle\(\s*"active"/.test(html), true);

  // Check step 2 does NOT have the old broken logic
  check("  [" + fnName + "] old broken step 2 logic removed", !html.includes('steps[2].classList.remove("active");'), true);

  // Check all three steps have "completed" for FINISH and FINISH_NG
  ["FINISH", "FINISH_NG", "Finish"].forEach(function(status) {
    check("  [" + fnName + "] status " + status + " in isProcessDone check",
      html.includes('status === "FINISH" || status === "FINISH_NG" || status === "Finish"'), true);
  });
});

/* ================================================================
   Bug 3: No "active" on step 0 when production is null
   ================================================================ */
console.log("\n=== Bug 3: No active class on null production ===");
["heat-treatment.html", "shotblast.html", "anti-rust.html"].forEach(function(f) {
  var html = fs.readFileSync(path.join(__dirname, f), "utf8");
  var fnName = f === "heat-treatment.html" ? "updateStepper" : "renderStepper";

  // Extract the function and check if it adds "active" to steps[0] when null
  var funcPattern = new RegExp(fnName.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&') + "[\\s\\S]*?if\\s*\\(!production\\)[\\s\\S]*?steps\\[0\\]\\.classList\\.add\\(\"active\"\\)");
  check("  [" + fnName + "] no steps[0].add('active') on null", !funcPattern.test(html), true);
});

/* ================================================================
   Bug 4: Stepper icon animation (CSS)
   ================================================================ */
console.log("\n=== Bug 4: Stepper active icon animation ===");
var css = fs.readFileSync(path.join(__dirname, "css", "components.css"), "utf8");
check("  stepperPulse keyframes defined", css.includes("@keyframes stepperPulse"), true);
check("  .ht-step.active has animation rule", css.includes(".ht-step.active .step-icon"), true);
check("  animation property in active", css.includes("animation: stepperPulse"), true);
check("  prefers-reduced-motion disables animation", css.includes("@media (prefers-reduced-motion: reduce)"), true);
check("  reduced-motion removes animation for stepper", /prefers-reduced-motion[\s\S]*?\.ht-step\.active \.step-icon[\s\S]*?animation:\s*none/.test(css), true);

/* ================================================================
   Bug 5: Status label user-friendly mapping
   ================================================================ */
console.log("\n=== Bug 5: Status Label User-Friendly Mapping ===");
["heat-treatment.html", "shotblast.html", "anti-rust.html"].forEach(function(f) {
  var html = fs.readFileSync(path.join(__dirname, f), "utf8");
  check("  [" + f + "] STATUS_LABEL_MAP defined", html.includes("STATUS_LABEL_MAP"), true);
  check("  [" + f + "] NOT_STARTED -> Belum Dimulai", html.includes('NOT_STARTED: "Belum Dimulai"'), true);
  check("  [" + f + "] WAITING -> Menunggu", html.includes('WAITING: "Menunggu"'), true);
  check("  [" + f + "] PROCESS -> Sedang Diproses", html.includes('PROCESS: "Sedang Diproses"'), true);
  check("  [" + f + "] FINISH -> Selesai", html.includes('FINISH: "Selesai"'), true);
  check("  [" + f + "] FINISH_NG -> Selesai (NG)", html.includes('FINISH_NG: "Selesai (NG)"'), true);
  check("  [" + f + "] NOT_CHECKED -> Belum Diperiksa", html.includes('NOT_CHECKED: "Belum Diperiksa"'), true);
  check("  [" + f + "] NOT_FOUND -> Belum Dimasukkan", html.includes('NOT_FOUND: "Belum Dimasukkan"'), true);
});

/* ================================================================
   Bug 6: CSS color rules for stepper
   ================================================================ */
console.log("\n=== Bug 6: CSS Color Rules ===");
check("  .ht-step.completed .step-icon is green", css.includes(".ht-step.completed .step-icon"), true);
check("  --success used for completed", css.includes("background: var(--success);") && css.includes(".ht-step.completed .step-icon"), true);
check("  .ht-step.active .step-icon is blue gradient", css.includes("--gradient-primary") && css.includes(".ht-step.active .step-icon"), true);
// completed CSS should come AFTER active CSS so green overrides blue when both classes present
var activeIdx = css.indexOf(".ht-step.active .step-icon");
var completedIdx = css.indexOf(".ht-step.completed .step-icon");
check("  completed CSS after active CSS (green wins)", completedIdx > activeIdx, true);

console.log("\n=== SUMMARY: " + passCount + " passed, " + failCount + " failed ===");
process.exit(failCount > 0 ? 1 : 0);
