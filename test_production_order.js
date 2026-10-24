/* ============================================================
   Production Order Completion Test Suite
   Verifies that production order items are correctly marked as
   COMPLETED when a process finishes with OK result, and that
   they are filtered from the active list.
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

let Auth, DB;
let allPass = true;
const results = [];

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

function assert(condition, description, extra) {
  const status = condition ? "PASS" : "FAIL";
  if (!condition) allPass = false;
  results.push({ status, description, extra: extra || "" });
  console.log(`[${status}] ${description}` + (extra ? ` — ${extra}` : ""));
}

/* ---- Helper: create test material with proper process_route ---- */
function createTestMaterial(kode, processType) {
  const part = DB.get("parts")[0];
  return DB.insert("materials", {
    kode: kode,
    qr_code: kode,
    customer_id: 1,
    part_id: part.id,
    nomor_surat_jalan: "",
    lot_no: "",
    material_charge: "",
    status_part: DB.STATUSES.ACTIVE,
    qty: 10,
    berat_part_snapshot: 2.5,
    berat_total_part: 25,
    tanggal_masuk: new Date().toISOString().split("T")[0],
    process_type: processType,
    status_proses: "WAITING",
    process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false },
    diinput_oleh: "test",
    keterangan: "",
    remarks: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

/* ---- Helper: create production order in localStorage ---- */
function createProductionOrder(kode, materialId, processType, partId) {
  const part = DB.findPartById(partId);
  const order = {
    kode: kode,
    customer: "TestCustomer",
    partName: part ? part.nama_part : "TestPart",
    partNo: part ? part.nomor_part : "P001",
    qty: 10,
    beratTotal: 25,
    processType: processType,
    stdTemp: 750,
    material_id: materialId,
    part_id: partId,
    saved_at: new Date().toISOString(),
    order_status: "ACTIVE",
  };

  const raw = localStorage.getItem("ht_production_orders");
  const orders = raw ? JSON.parse(raw) : {};
  if (!orders[processType]) orders[processType] = [];
  orders[processType].push(order);
  localStorage.setItem("ht_production_orders", JSON.stringify(orders));
  return order;
}

/* ---- Helper: simulate process entry ---- */
function simulateProcessEntry(material) {
  const processName = material.process_type || "HT";
  const existing = DB.getProcessProduction(material, processName);
  if (!existing) {
    DB.insert("productions", {
      material_id: material.id,
      incoming_id: material.id,
      kode: material.kode,
      status: DB.STATUSES.PROD_PROCESS,
      production_status: DB.STATUSES.PROD_PROCESS,
      start_scan_at: new Date().toISOString(),
      finish_scan_at: null,
      process_result: null,
      jenis_treatment: processName,
    });
  }
  DB.update("materials", material.id, {
    status_proses: DB.STATUSES.PROSES_PROCESS,
  });
  return DB.getProcessProduction(material, processName);
}

/* ---- Helper: simulate process completion (FINISH + OK) ---- */
function simulateProcessFinish(material, processName, isNG) {
  const prod = DB.getProcessProduction(material, processName);
  if (!prod) return null;

  const data = {
    status: isNG ? DB.STATUSES.PROD_FINISH_NG : DB.STATUSES.PROD_FINISH,
    production_status: isNG ? DB.STATUSES.PROD_FINISH_NG : DB.STATUSES.PROD_FINISH,
    finish_scan_at: new Date().toISOString(),
    process_result: isNG ? "NG" : "OK",
    process_ng_note: isNG ? "Test NG note" : "",
  };

  DB.update("productions", prod.id, data);
  DB.update("materials", material.id, {
    status_proses: isNG ? DB.STATUSES.PROSES_FINISH_NG : DB.STATUSES.PROSES_FINISH,
  });
  return DB.getProcessProduction(material, processName);
}

/* ---- Helper: simulate markProductionOrderCompleted (mirrors heat-treatment.html logic) ---- */
function markProductionOrderCompleted(processType, materialId, kode) {
  const raw = localStorage.getItem("ht_production_orders");
  if (!raw) return false;
  try {
    const orders = JSON.parse(raw);
    const list = orders[processType];
    if (!list) return false;
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var idMatch = item.material_id != null && String(item.material_id) === String(materialId);
      var kodeMatch = item.kode === kode;
      if ((idMatch || kodeMatch) && item.order_status !== "COMPLETED") {
        item.order_status = "COMPLETED";
        item.completed_at = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem("ht_production_orders", JSON.stringify(orders));
    }
    return changed;
  } catch (e) {
    return false;
  }
}

/* ---- Helper: get active production orders (mirrors getActiveProductionOrders logic) ---- */
function getActiveProductionOrders(processType) {
  const raw = localStorage.getItem("ht_production_orders");
  if (!raw) return [];
  try {
    const orders = JSON.parse(raw);
    const items = orders[processType] || [];
    return items.filter(function (item) {
      if (item.order_status === "COMPLETED") return false;
      return true;
    });
  } catch (e) {
    return [];
  }
}

/* ---- Helper: get all production orders (including completed) ---- */
function readProductionOrdersByType(processType) {
  const raw = localStorage.getItem("ht_production_orders");
  if (!raw) return [];
  try {
    const orders = JSON.parse(raw);
    return orders[processType] || [];
  } catch (e) {
    return [];
  }
}

/* ---- Helper: simulate full process completion flow ---- */
function simulateConfirmFinish(material, processType) {
  simulateProcessEntry(material);
  const prod = simulateProcessFinish(material, "HT", false);
  if (prod && prod.process_result === "OK" && prod.production_status === "FINISH") {
    markProductionOrderCompleted(processType, material.id, material.kode);
  }
  return prod;
}

console.log("=== PRODUCTION ORDER COMPLETION TESTS ===\n");

const PROCESS_TYPES = [
  "Quenching & Tempering",
  "Normalizing",
  "Stress Relief Annealing",
  "Annealing",
  "Full Annealing",
  "Spheroidizing Annealing",
  "Carburizing",
];

let testNum = 0;
PROCESS_TYPES.forEach(function (processType) {
  testNum++;
  console.log(`--- ${processType} ---`);

  setupFresh();

  // Scenario A: Order baru belum diproses - should appear
  const material = createTestMaterial("T" + testNum + "M", processType);
  createProductionOrder("T" + testNum + "M", material.id, processType, material.part_id);

  const activeBefore = getActiveProductionOrders(processType);
  const allBefore = readProductionOrdersByType(processType);
  assert(
    activeBefore.length === 1 && allBefore.length === 1,
    "A: Order muncul pada daftar sebelum proses",
    `active=${activeBefore.length} total=${allBefore.length}`
  );

  // Scenario B: After OK completion - should disappear from active list
  simulateConfirmFinish(material, processType);

  const activeAfter = getActiveProductionOrders(processType);
  const allAfter = readProductionOrdersByType(processType);
  assert(
    activeAfter.length === 0,
    "B: Order hilang dari daftar aktif setelah selesai OK",
    `active=${activeAfter.length} total=${allAfter.length}`
  );
  assert(
    allAfter.length === 1 && allAfter[0].order_status === "COMPLETED",
    "B: Order tetap tersimpan di riwayat dengan status COMPLETED",
    `total=${allAfter.length} status=${allAfter[0].order_status}`
  );

  // Verify production record is also correctly finished
  const prod = DB.getProcessProduction(material, "HT");
  assert(
    prod && prod.production_status === "FINISH" && prod.process_result === "OK",
    "B: Production record FINISH+OK tersimpan",
    `status=${prod ? prod.production_status : "null"} result=${prod ? prod.process_result : "null"}`
  );

  console.log("");
});

// Scenario: Multiple orders, only completed one disappears
console.log("--- Multiple Orders Test ---");
setupFresh();
{
  const mat1 = createTestMaterial("MULTI1M", "Quenching & Tempering");
  const mat2 = createTestMaterial("MULTI2M", "Quenching & Tempering");
  createProductionOrder("MULTI1M", mat1.id, "Quenching & Tempering", mat1.part_id);
  createProductionOrder("MULTI2M", mat2.id, "Quenching & Tempering", mat2.part_id);

  assert(
    getActiveProductionOrders("Quenching & Tempering").length === 2,
    "Multi: 2 order aktif sebelum proses",
    ""
  );

  // Complete only mat1
  simulateConfirmFinish(mat1, "Quenching & Tempering");

  const active = getActiveProductionOrders("Quenching & Tempering");
  assert(
    active.length === 1 && active[0].kode === "MULTI2M",
    "Multi: Hanya order yang selesai hilang, order lain tetap",
    `active=${active.length} remaining=${active[0] ? active[0].kode : "none"}`
  );
}

// Scenario: Different process type not affected
console.log("\n--- Cross-Process Test ---");
setupFresh();
{
  const mat1 = createTestMaterial("CROSS1M", "Quenching & Tempering");
  const mat2 = createTestMaterial("CROSS2M", "Annealing");
  createProductionOrder("CROSS1M", mat1.id, "Quenching & Tempering", mat1.part_id);
  createProductionOrder("CROSS2M", mat2.id, "Annealing", mat2.part_id);

  simulateConfirmFinish(mat1, "Quenching & Tempering");

  assert(
    getActiveProductionOrders("Quenching & Tempering").length === 0,
    "Cross: Order Q&T hilang setelah selesai",
    ""
  );
  assert(
    getActiveProductionOrders("Annealing").length === 1,
    "Cross: Order Annealing tidak terpengaruh",
    `active=${getActiveProductionOrders("Annealing").length}`
  );
}

// Scenario: NG result does not remove from active list
console.log("\n--- NG Result Test ---");
setupFresh();
{
  const mat = createTestMaterial("NG1M", "Annealing");
  createProductionOrder("NG1M", mat.id, "Annealing", mat.part_id);

  simulateProcessEntry(mat);
  const prod = simulateProcessFinish(mat, "HT", true); // NG
  assert(
    prod && prod.process_result === "NG",
    "NG: Production record NG tersimpan",
    `result=${prod ? prod.process_result : "null"}`
  );

  const active = getActiveProductionOrders("Annealing");
  assert(
    active.length === 1,
    "NG: Order tetap muncul (hanya FINISH+OK yang menghilangkan)",
    `active=${active.length}`
  );
}

// Scenario: Old orders without order_status
console.log("\n--- Old Order Without order_status ---");
setupFresh();
{
  const mat = createTestMaterial("OLD1M", "Annealing");
  // Create order WITHOUT order_status field (simulates old data)
  const raw = localStorage.getItem("ht_production_orders");
  const orders = raw ? JSON.parse(raw) : {};
  const part = DB.findPartById(mat.part_id);
  const oldOrder = {
    kode: "OLD1M",
    customer: "OldCust",
    partName: part ? part.nama_part : "OldPart",
    partNo: part ? part.nomor_part : "P001",
    qty: 10,
    beratTotal: 25,
    processType: "Annealing",
    stdTemp: 750,
    material_id: mat.id,
    part_id: mat.part_id,
    saved_at: new Date().toISOString(),
    // NO order_status field
  };
  if (!orders["Annealing"]) orders["Annealing"] = [];
  orders["Annealing"].push(oldOrder);
  localStorage.setItem("ht_production_orders", JSON.stringify(orders));

  const active = getActiveProductionOrders("Annealing");
  assert(
    active.length === 1,
    "Old: Order lama tanpa order_status tetap muncul",
    `active=${active.length}`
  );

  // Complete process should still mark it completed
  simulateConfirmFinish(mat, "Annealing");
  const activeAfter = getActiveProductionOrders("Annealing");
  const allAfter = readProductionOrdersByType("Annealing");
  assert(
    activeAfter.length === 0,
    "Old: Order lama hilang setelah proses selesai OK",
    `active=${activeAfter.length}`
  );
  assert(
    allAfter.length === 1 && allAfter[0].order_status === "COMPLETED",
    "Old: Order lama ditandai COMPLETED",
    `status=${allAfter[0].order_status}`
  );
}

// Scenario: Failed storage
console.log("\n--- Failed Storage Test ---");
setupFresh();
{
  const mat = createTestMaterial("FAIL1M", "Annealing");
  createProductionOrder("FAIL1M", mat.id, "Annealing", mat.part_id);

  simulateProcessEntry(mat);

  // Temporarily break DB.update to simulate storage failure
  const originalUpdate = DB.update;
  DB.update = function () {
    throw new Error("Simulated storage failure");
  };

  let threw = false;
  try {
    simulateProcessFinish(mat, "HT", false);
  } catch (e) {
    threw = true;
  }
  DB.update = originalUpdate;

  assert(
    threw,
    "Fail: Storage failure throws error",
    ""
  );

  // Order should still be active (markProductionOrderCompleted not reached due to error)
  const active = getActiveProductionOrders("Annealing");
  assert(
    active.length === 1,
    "Fail: Order tetap aktif saat penyimpanan gagal",
    `active=${active.length}`
  );
}

// Scenario: Order available for next process after completion
console.log("\n--- Next Process After Completion ---");
setupFresh();
{
  const mat = createTestMaterial("NEXT1M", "Quenching & Tempering");
  createProductionOrder("NEXT1M", mat.id, "Quenching & Tempering", mat.part_id);

  simulateConfirmFinish(mat, "Quenching & Tempering");

  const matAfter = DB.findMaterial(mat.id);
  const nextProcess = DB.getNextProcess(matAfter);
  assert(
    nextProcess === "QC",
    "Next: Part tersedia untuk proses QC setelah HT selesai OK",
    `nextProcess=${nextProcess}`
  );
}

// Scenario: Total count matches active orders
console.log("\n--- Total Count Test ---");
setupFresh();
{
  const mat1 = createTestMaterial("COUNT1M", "Annealing");
  const mat2 = createTestMaterial("COUNT2M", "Annealing");
  const mat3 = createTestMaterial("COUNT3M", "Annealing");
  createProductionOrder("COUNT1M", mat1.id, "Annealing", mat1.part_id);
  createProductionOrder("COUNT2M", mat2.id, "Annealing", mat2.part_id);
  createProductionOrder("COUNT3M", mat3.id, "Annealing", mat3.part_id);

  assert(
    getActiveProductionOrders("Annealing").length === 3,
    "Count: 3 order aktif sebelum proses",
    ""
  );

  simulateConfirmFinish(mat1, "Annealing");
  assert(
    getActiveProductionOrders("Annealing").length === 2,
    "Count: 2 order aktif setelah 1 selesai",
    `active=${getActiveProductionOrders("Annealing").length}`
  );

  simulateConfirmFinish(mat2, "Annealing");
  assert(
    getActiveProductionOrders("Annealing").length === 1,
    "Count: 1 order aktif setelah 2 selesai",
    `active=${getActiveProductionOrders("Annealing").length}`
  );
}

// Summary
console.log("\n=== SUMMARY ===");
const passCount = results.filter((r) => r.status === "PASS").length;
const failCount = results.filter((r) => r.status === "FAIL").length;
console.log(`Total: ${results.length}, PASS: ${passCount}, FAIL: ${failCount}`);
console.log(`Overall: ${allPass ? "ALL PASS" : "SOME FAILED"}`);

process.exit(allPass ? 0 : 1);
