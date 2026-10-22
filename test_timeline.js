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
  };
}

global.localStorage = new MemoryStorage();
const dbCode = fs.readFileSync(path.join(__dirname, "js", "db.js"), "utf8").replace("const DB", "var DB");
const DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);
DB.init();
DB.migrate();
DB.migrate48Items();

// Add mock materials for scenarios not covered by seed data
localStorage.setItem("ht_materials", JSON.stringify([...DB.get("materials"),
  { id: 9994, kode: "TEST4", part_id: 1, customer_id: 1,
    tanggal_masuk: "2026-09-01", nomor_surat_jalan: "SJ-TEST4", qty: 50,
    berat_total_part: 125, diinput_oleh: "Operator Test",
    process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true },
    status_proses: "FINISH" },
  { id: 99913, kode: "TEST13", part_id: 1, customer_id: 1,
    tanggal_masuk: "2026-10-01", nomor_surat_jalan: "SJ-TEST13", qty: 30,
    berat_total_part: 75, diinput_oleh: "Operator Test",
    process_route: undefined,
    status_proses: "WAITING" }
]));
localStorage.setItem("ht_productions", JSON.stringify([...DB.get("productions"),
  { id: 99941, material_id: 9994, status: "FINISH", production_status: "FINISH", process_result: "OK", visual_check_result: "OK", start_scan_at: "2026-09-01T08:00:00", finish_scan_at: "2026-09-01T10:00:00", machine_start_by: "Operator Mesin 01", jenis_treatment: "Heat Treatment", tanggal_proses: "2026-09-01", machine_finish_at: "2026-09-01T10:05:00" },
  { id: 99942, material_id: 9994, status: "PROCESS", production_status: "PROCESS", process_result: "", jenis_treatment: "Shotblast", start_scan_at: "2026-09-02T08:00:00", machine_start_by: "Operator Mesin 02", tanggal_proses: "2026-09-02" },
  { id: 999131, material_id: 99913, status: "WAITING", production_status: "WAITING", process_result: "", jenis_treatment: "Heat Treatment", tanggal_proses: "2026-10-01" }
]));
localStorage.setItem("ht_qcs", JSON.stringify([...DB.get("qcs"),
  { id: 9994, material_id: 9994, production_id: 99941, hasil: "OK", hardness: "60", satuan_hardness: "HRC", inspector: "Inspector 01", tanggal_inspector: "2026-09-01T10:00:00" }
]));

/* Add mock Parts for Target Hardness verification */
const mockParts = [...DB.get("parts"),
  { id: 99, customer_id: 1, nomor_part: "HT-TEST-99", nama_part: "Test Part No Hardness", berat_part: 1.0, satuan_berat: "KG", target_hardness: null, standard_temperature: 600, process_type: "Heat Treatment", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }
];
localStorage.setItem("ht_parts", JSON.stringify(mockParts));

/* Add mock materials referencing Part 4 (700-750 HV, 650°C) and Part 99 (null hardness, 600°C) */
localStorage.setItem("ht_materials", JSON.stringify([...DB.get("materials"),
  { id: 9994, kode: "TEST4", part_id: 1, customer_id: 1,
    tanggal_masuk: "2026-09-01", nomor_surat_jalan: "SJ-TEST4", qty: 50,
    berat_total_part: 125, diinput_oleh: "Operator Test",
    process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true },
    status_proses: "FINISH" },
  { id: 9995, kode: "TEST5", part_id: 4, customer_id: 1,
    tanggal_masuk: "2026-09-15", nomor_surat_jalan: "SJ-TEST5", qty: 10,
    berat_total_part: 32, diinput_oleh: "Operator Test",
    process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false },
    status_proses: "FINISH" },
  { id: 9999, kode: "TEST9", part_id: 99, customer_id: 1,
    tanggal_masuk: "2026-10-01", nomor_surat_jalan: "SJ-TEST9", qty: 10,
    berat_total_part: 10, diinput_oleh: "Operator Test",
    process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false },
    status_proses: "FINISH" },
  { id: 99913, kode: "TEST13", part_id: 1, customer_id: 1,
    tanggal_masuk: "2026-10-01", nomor_surat_jalan: "SJ-TEST13", qty: 30,
    berat_total_part: 75, diinput_oleh: "Operator Test",
    process_route: undefined,
    status_proses: "WAITING" }
]));

global.document = mockDocument();
global.Auth = { getSession: () => ({ name: "user" }) };

const df = fs.readFileSync(path.join(__dirname, "js", "date-format.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "tracking.html"), "utf8");
const inline = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || "";
const code = df + "\n" + inline + "\n";

const HTUI = { requireAuth: () => true };
function mockWindow() {
  const el = { _tag: "_window", textContent: "", innerHTML: "", style: {}, classList: { _c: new Set(), add(){}, remove(){}, contains(){return false;}, toggle(){} }, appendChild(){}, setAttribute(){}, getAttribute(){return null;} };
  return { addEventListener(){}, document: { getElementById: (id) => el }, location: {} };
}
const ctx = { DB, document: global.document, HTUI, window: mockWindow() };

const fn = new Function("DB", "document", "HTUI", "window", code + "\n; return { buildTimeline: buildTimeline, renderTimeline: renderTimeline, renderProgressBar: renderProgressBar, getJourneyDescription: getJourneyDescription, classifyStepState: classifyStepState, badgeForStep: badgeForStep, STEP_LABELS: STEP_LABELS, STEP_ICONS: STEP_ICONS, renderPartData: renderPartData };");
const api = fn(ctx.DB, ctx.document, ctx.HTUI, ctx.window);

var passCount = 0;
var failCount = 0;

function check(label, actual, expected) {
  var ok = actual === expected;
  if (ok) { passCount++; } else { failCount++; }
  console.log("  " + (ok ? "PASS" : "FAIL") + " - " + label + ": got \"" + actual + "\"" + (ok ? "" : ", expected \"" + expected + "\""));
}

function getStepStates(steps) {
  return steps.map(s => s.key + "=" + s.state + "(" + s.badge.label + ")").join(", ");
}

function run(kode) {
  const m = DB.findByKode(kode);
  if (!m) {
    console.log("\n=== " + kode + " === NOT FOUND");
    failCount++;
    return;
  }
  const part = DB.findPartById(m.part_id);
  const customer = DB.findCustomerById(m.customer_id);
  const qcs = DB.get("qcs").filter(q => String(q.material_id) === String(m.id));
  const delivery = DB.get("deliveries").find(d => String(d.material_id) === String(m.id)) || null;
  const steps = api.buildTimeline(m, qcs, delivery, part, customer);

  Object.keys(domElements).forEach(k => {
    delete domElements[k].innerHTML;
    domElements[k].textContent = "";
  });

  console.log("\n=== " + kode + " ===");

  check("step count", steps.length, 6);

  var expectedKeys = ["INCOMING", "HT", "QC", "SHOTBLAST", "ANTI_RUST", "DELIVERY"];
  for (var i = 0; i < steps.length; i++) {
    check("  step[" + i + "] key", steps[i].key, expectedKeys[i]);
  }

  console.log("  states: " + getStepStates(steps));

  api.renderTimeline(steps);
  var timelineEl = domElements["timelineContainer"];
  var htmlOut = timelineEl ? timelineEl.innerHTML : "(no timelineContainer)";
  var leaks = (htmlOut.match(/undefined|NaN/g) || []);
  check("  no undefined/NaN leaks", leaks.length === 0, true);
  if (leaks.length) console.log("    LEAKS:", leaks);

  api.renderProgressBar(m, steps);
  var progressPct = domElements["trackProgressPercent"] ? domElements["trackProgressPercent"].textContent : "(none)";
  var progressSteps = domElements["trackProgressSteps"] ? domElements["trackProgressSteps"].textContent : "(none)";
  var nextProcess = domElements["trackNextProcess"] ? domElements["trackNextProcess"].textContent : "(none)";
  console.log("  progress: " + progressPct + " | " + progressSteps + " | Berikutnya: " + nextProcess);

  var deliveryState = { delivered: !!delivery && (delivery.status === "Delivered" || delivery.status === "DELIVERED") };
  var currentProcess = DB.getCurrentProcess(m);
  var journey = api.getJourneyDescription(steps, deliveryState.delivered, currentProcess);
  console.log("  journey: " + journey);
}

// Scenario 1: Material selesai Incoming, HT belum dimulai (WAITING)
// 1M: WAITING, no QC, route {ht,qc,!sb,!ar}
run("1M");

// Scenario 2: Material sedang HT (PROCESS)
// 2M: PROCESS, visual_check=OK, no QC
run("2M");

// Scenario 3: Material selesai HT, belum QC
// 5M: FINISH OK, no QC
run("5M");

// Scenario 4: Material selesai QC, sedang Shotblast (mock: HT FINISH + QC OK + Shotblast PROCESS)
run("TEST4");

// Scenario 5: Material selesai Shotblast, sedang Anti Rust
// 37M: HT FINISH, QC OK, Shotblast FINISH, Anti-Rust PROCESS, no delivery
run("37M");

// Scenario 6: Material tidak memerlukan Shotblast maupun Anti Rust
// 1M: route {ht,qc,!sb,!ar}
run("1M");

// Scenario 7: Material tidak memerlukan Shotblast, tetapi memerlukan Anti Rust
// 20260003I: route {ht,qc,!sb,ar}
run("20260003I");

// Scenario 8: Material tidak memerlukan Anti Rust, tetapi memerlukan Shotblast
// 20260002I: route {ht,qc,sb,!ar}
run("20260002I");

// Scenario 9: Material memiliki hasil QC NG
// 4M: HT FINISH_NG, QC NG
run("4M");

// Scenario 10: Material selesai QC + semua proses wajib, belum Delivery
// 3M: HT FINISH OK, QC OK, no delivery, route {ht,qc,!sb,!ar}
run("3M");

// Scenario 11: Material sudah Delivery, Qty Out berbeda dari Qty Incoming
// 20260001I: delivered, qty_kirim=50, qty=50, route {ht,qc,sb,ar}
run("20260001I");

// Scenario 12: Data proses belum lengkap
// 2M: HT PROCESS, no QC
run("2M");

// Scenario 13: Rute proses Shotblast/Anti Rust tidak tersedia
// TEST13: process_route=undefined
run("TEST13");

/* ================================================================
   Target Hardness Verification Tests
   Memastikan trackTargetHardness menampilkan part.target_hardness,
   bukan standard_temperature. Dan Target Suhu di kartu HT tetap
   menampilkan nilai suhu standar (°C).
   ================================================================ */

function runTargetHardnessTest(kode, expectedHardness, expectedTempC) {
  var m = DB.findByKode(kode);
  if (!m) {
    console.log("\n=== " + kode + " (Target Hardness) === NOT FOUND");
    failCount++;
    return;
  }
  var part = DB.findPartById(m.part_id);
  var customer = DB.findCustomerById(m.customer_id);
  var qcs = DB.get("qcs").filter(q => String(q.material_id) === String(m.id));
  var delivery = DB.get("deliveries").find(d => String(d.material_id) === String(m.id)) || null;

  Object.keys(domElements).forEach(k => {
    delete domElements[k].innerHTML;
    domElements[k].textContent = "";
  });

  api.renderPartData(m, part, customer, qcs, delivery);

  var thEl = domElements["trackTargetHardness"];
  check("  trackTargetHardness", thEl ? thEl.textContent : "(none)", expectedHardness);

  /* Verify HT card Target Suhu is unchanged — still uses standard_temperature */
  var steps = api.buildTimeline(m, qcs, delivery, part, customer);
  var htStep = steps[1];
  var targetSuhuRow = htStep.card.rows.find(r => r.label === "Target Suhu");
  var expectedTempStr = expectedTempC !== null ? expectedTempC + " °C" : "-";
  check("  HT Target Suhu", targetSuhuRow ? targetSuhuRow.value : "(none)", expectedTempStr);
}

/* Part 1: target_hardness="58-62 HRC", standard_temperature=580 */
console.log("\n=== Target Hardness: Part 1 (TEST4) ===");
runTargetHardnessTest("TEST4", "58-62 HRC", 580);

/* Part 4: target_hardness="700-750 HV", standard_temperature=650 */
console.log("\n=== Target Hardness: Part 4 (TEST5) ===");
runTargetHardnessTest("TEST5", "700-750 HV", 650);

/* Part 99: target_hardness=null, standard_temperature=600 → hardness shows "-" */
console.log("\n=== Target Hardness: Part 99 (TEST9) ===");
runTargetHardnessTest("TEST9", "-", 600);

console.log("\n=== SUMMARY: " + passCount + " passed, " + failCount + " failed ===");
process.exit(failCount > 0 ? 1 : 0);
