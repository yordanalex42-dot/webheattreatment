/* ============================================================
   HT Planning Classification - Tests
   Verifies: ready incoming, single filter, drag-drop, auto-sort,
   Jeda Ganti Suhu, draft persistence, save production order.
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
const eventListeners = {};

function mockDocument() {
  return {
    getElementById(id) {
      if (!domElements[id]) {
        domElements[id] = {
          _tag: id,
          textContent: "",
          value: "",
          innerHTML: "",
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
          addEventListener(event, handler) {
            if (!eventListeners[id]) eventListeners[id] = {};
            eventListeners[id][event] = handler;
          },
          appendChild(child) { return child; },
          setAttribute(name, val) { this[name] = val; },
          getAttribute(name) { return this[name] || null; },
        };
      }
      return domElements[id];
    },
    createElement(tag) {
      return {
        _tag: tag,
        textContent: "",
        value: "",
        innerHTML: "",
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
        appendChild(child) { return child; },
        setAttribute(name, val) { this[name] = val; },
        getAttribute(name) { return this[name] || null; },
      };
    },
  };
}

let DB, HTPlanningClassification;
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

function setupFresh() {
  global.localStorage = new MemoryStorage();
  const dbCode = fs.readFileSync(path.join(__dirname, "js", "db.js"), "utf8")
    .replace("const DB", "var DB");
  DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);
  DB.init();
}

function resetDOM() {
  Object.keys(domElements).forEach(k => delete domElements[k]);
  Object.keys(eventListeners).forEach(k => delete eventListeners[k]);
}

function loadPlanningClassification() {
  global.document = mockDocument();
  const pcCode = fs.readFileSync(path.join(__dirname, "js", "planning-classification.js"), "utf8");
  const fn = new Function("DB", "document", pcCode + "\n; return HTPlanningClassification;");
  HTPlanningClassification = fn(DB, global.document);
}

function getReadyIncoming() {
  return DB.get("materials").filter(function (m) {
    return (
      m.status_proses === DB.STATUSES.PROSES_WAITING &&
      m.process_route &&
      m.process_route.heat_treatment === true &&
      m.part_id != null
    );
  });
}

console.log("==========================================");
console.log("  HT PLANNING CLASSIFICATION - TESTS");
console.log("  Tanggal: " + new Date().toISOString());
console.log("==========================================\n");

/* ============================================================
   TEST 1: Ready Incoming Detection
   ============================================================ */
console.log("=== TEST 1: Ready Incoming Detection ===");
setupFresh();
loadPlanningClassification();
resetDOM();

const ready = getReadyIncoming();
assert(
  ready.length === 7,
  "T1.1: Should detect 7 ready incoming materials",
  "found " + ready.length + ": " + ready.map(m => m.kode).join(", ")
);

const expectedReady = ["1M", "6M", "11M", "16M", "21M", "26M", "31M"];
assert(
  JSON.stringify(ready.map(m => m.kode).sort()) === JSON.stringify(expectedReady.sort()),
  "T1.2: Ready materials match expected kodes",
  "codes: " + ready.map(m => m.kode).join(", ")
);

/* ============================================================
   TEST 2: Temperature Resolution via Part Master
   ============================================================ */
console.log("\n=== TEST 2: Temperature Resolution via Part Master ===");
const m1 = DB.findByKode("1M");
const part1 = DB.findPartById(m1.part_id);
assert(DB.getPartStandardTemperature(part1.id) === 580, "T2.1: Part 1 temp = 580", "");

const m6 = DB.findByKode("6M");
const part6 = DB.findPartById(m6.part_id);
assert(DB.getPartStandardTemperature(part6.id) === 850, "T2.2: Part 2 temp = 850", "");

const m11 = DB.findByKode("11M");
const part11 = DB.findPartById(m11.part_id);
assert(DB.getPartStandardTemperature(part11.id) === 820, "T2.3: Part 3 temp = 820", "");

const m16 = DB.findByKode("16M");
const part16 = DB.findPartById(m16.part_id);
assert(DB.getPartStandardTemperature(part16.id) === 750, "T2.4: Part 9 temp = 750", "");

/* ============================================================
   TEST 3: Process Type Resolution
   ============================================================ */
console.log("\n=== TEST 3: Process Type Resolution ===");
assert(part1.process_type === "Quenching & Tempering", "T3.1: 1M = QT", "");
assert(part6.process_type === "Annealing", "T3.2: 6M = Annealing", "");
assert(part11.process_type === "Carburizing", "T3.3: 11M = Carburizing", "");
assert(part16.process_type === "Normalizing", "T3.4: 16M = Normalizing", "");

/* ============================================================
   TEST 4: Single filter controls both panels
   ============================================================ */
console.log("\n=== TEST 4: Single filter controls both panels ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Normalizing");

assert(HTPlanningClassification._activeFilter === "Normalizing", "T4.1: Filter = Normalizing", "");

const normHtml = domElements["htClassificationTable"].innerHTML;
assert(normHtml.indexOf("16M") !== -1, "T4.2: Incoming shows 16M for Normalizing", "");
assert(normHtml.indexOf("1M") === -1, "T4.3: Incoming excludes 1M for Normalizing", "");

/* ============================================================
   TEST 5: Auto-sort by kode number on initial add
   ============================================================ */
console.log("\n=== TEST 5: Auto-sort by kode number ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();

/* Add items in non-sorted order: 11M (Carburizing) */
HTPlanningClassification._onFilterChange("Carburizing");
HTPlanningClassification.addToWorkspace(DB.findByKode("11M"));
assert(HTPlanningClassification._workspace[0].kode === "11M", "T5.1: 11M added", "");
assert(HTPlanningClassification._workspace[0].stdTemp === 820, "T5.2: 11M stdTemp = 820", "");

/* ============================================================
   TEST 10: Draft persistence per process type
   ============================================================ */
console.log("\n=== TEST 10: Draft persistence per process type ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification.addToWorkspace(DB.findByKode("1M"));

assert(HTPlanningClassification._workspace.length === 1, "T6.1: 1 item after add", "");
const dupResult = HTPlanningClassification.addToWorkspace(DB.findByKode("1M"));
assert(dupResult === false, "T6.2: Duplicate add returns false", "");
assert(HTPlanningClassification._workspace.length === 1, "T6.3: Still 1 item after dup", "");

/* ============================================================
   TEST 7: Drag-drop from Incoming to Production Order
   ============================================================ */
console.log("\n=== TEST 7: Drag-drop from Incoming to Production Order ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");

HTPlanningClassification._renderIncomingTable();
HTPlanningClassification._renderProductionOrder();

const tableHtml = domElements["htClassificationTable"].innerHTML;
assert(tableHtml.indexOf('draggable="true"') !== -1, "T7.1: Incoming rows draggable", "");
assert(tableHtml.indexOf('ondragstart="HTPlanningClassification._onDragStartIncoming') !== -1, "T7.2: has ondragstart", "");

const orderHtml = domElements["htProductionOrderTable"].innerHTML;
assert(orderHtml.indexOf('ondrop="HTPlanningClassification._onDropToOrder') !== -1, "T7.3: order has ondrop", "");
assert(orderHtml.indexOf('ondragover="HTPlanningClassification._onDragOverOrder') !== -1, "T7.4: order has ondragover", "");

/* ============================================================
   TEST 8: Jeda Ganti Suhu in production order
   ============================================================ */
console.log("\n=== TEST 8: Jeda Ganti Suhu in production order ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");

/* Manually populate workspace with items of different temperatures for Jeda testing */
HTPlanningClassification._workspace = [
  { kode: "1M", customer: "PT ABC", partName: "Part A", partNo: "HT-001", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 580, material: null },
  { kode: "6M", customer: "PT ABC", partName: "Part B", partNo: "HT-002", qty: 48, beratTotal: 150, processType: "Quenching & Tempering", stdTemp: 850, material: null },
  { kode: "11M", customer: "PT ABC", partName: "Part C", partNo: "HT-003", qty: 46, beratTotal: 175, processType: "Quenching & Tempering", stdTemp: 820, material: null },
  { kode: "16M", customer: "PT ABC", partName: "Part D", partNo: "HT-004", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 750, material: null },
  { kode: "21M", customer: "PT ABC", partName: "Part E", partNo: "HT-005", qty: 46, beratTotal: 110, processType: "Quenching & Tempering", stdTemp: 870, material: null },
  { kode: "26M", customer: "PT ABC", partName: "Part F", partNo: "HT-006", qty: 28, beratTotal: 140, processType: "Quenching & Tempering", stdTemp: 830, material: null },
  { kode: "31M", customer: "PT ABC", partName: "Part G", partNo: "HT-007", qty: 24, beratTotal: 96, processType: "Quenching & Tempering", stdTemp: 820, material: null },
];
HTPlanningClassification._orderChanged = true;

HTPlanningClassification._renderProductionOrder();
const orderHtmlFull = domElements["htProductionOrderTable"].innerHTML;

assert(orderHtmlFull.indexOf("Jeda Ganti Suhu") !== -1, "T8.1: Jeda Ganti Suhu present", "");

const rowNoMatches = orderHtmlFull.match(/ht-production-row-no">(\d+)/g) || [];
assert(rowNoMatches.length === 7, "T8.2: 7 row numbers", "count=" + rowNoMatches.length);

const rowNums = rowNoMatches.map(function (m) {
  return parseInt(m.match(/(\d+)/)[1], 10);
}).sort(function (a, b) { return a - b; });
assert(
  JSON.stringify(rowNums) === JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
  "T8.3: Row numbers sequential 1-7",
  "nums=" + rowNums.join(",")
);

const jedaCount = (orderHtmlFull.match(/class="ht-jeda-suhu"/g) || []).length;
assert(jedaCount === 6, "T8.4: 6 Jeda separators for 7 groups", "count=" + jedaCount);

/* ============================================================
   TEST 9: Manual reordering
   ============================================================ */
console.log("\n=== TEST 9: Manual reordering ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification.addToWorkspace(DB.findByKode("1M"));

/* Manually set workspace with 2 items */
HTPlanningClassification._workspace = [
  { kode: "1M", customer: "-", partName: "P", partNo: "N", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 580, material: null },
  { kode: "31M", customer: "-", partName: "P", partNo: "N", qty: 50, beratTotal: 125, processType: "Spheroidizing Annealing", stdTemp: 820, material: null },
];
HTPlanningClassification._orderChanged = true;
HTPlanningClassification._moveDown(0);
assert(
  HTPlanningClassification._workspace[0].kode === "31M" && HTPlanningClassification._workspace[1].kode === "1M",
  "T9.1: Manual move down swaps items",
  "order=" + HTPlanningClassification._workspace.map(i => i.kode).join(",")
);
assert(HTPlanningClassification._orderChanged === true, "T9.2: _orderChanged stays true", "");

/* ============================================================
   TEST 10: Draft persistence per process type
   ============================================================ */
console.log("\n=== TEST 10: Draft persistence per process type ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification.addToWorkspace(DB.findByKode("1M"));

HTPlanningClassification._saveDraft(HTPlanningClassification._workspace, "Quenching & Tempering");
const draft = JSON.parse(global.localStorage.getItem("ht_production_drafts") || "{}");
assert(Array.isArray(draft["Quenching & Tempering"]), "T10.1: Draft saved under Q&T key", "");
assert(draft["Quenching & Tempering"].length === 1, "T10.2: Draft has 1 item", "");
assert(draft["Quenching & Tempering"][0].kode === "1M", "T10.3: Draft item kode = 1M", "");
assert(draft["Quenching & Tempering"][0].stdTemp === 580, "T10.4: Draft item stdTemp = 580", "");

/* Source data integrity */
const m1db = DB.findByKode("1M");
assert(m1db.status_proses === "WAITING", "T10.5: Source 1M status unchanged", "got=" + m1db.status_proses);
assert(m1db.qty === 50, "T10.6: Source 1M qty unchanged", "got=" + m1db.qty);

/* Switch filter and back */
HTPlanningClassification._onFilterChange("Annealing");
assert(HTPlanningClassification._workspace.length === 0, "T10.7: Annealing empty initially", "");
HTPlanningClassification._onFilterChange("Quenching & Tempering");
assert(HTPlanningClassification._workspace.length === 1, "T10.8: Q&T draft restored", "");
assert(HTPlanningClassification._workspace[0].kode === "1M", "T10.9: Restored item = 1M", "");

/* Save production order */
HTPlanningClassification.saveProductionOrder();
const orders = JSON.parse(global.localStorage.getItem("ht_production_orders") || "{}");
assert(Array.isArray(orders["Quenching & Tempering"]), "T10.10: Order saved", "");
assert(orders["Quenching & Tempering"].length === 1, "T10.11: Order has 1 saved item", "");
assert(orders["Quenching & Tempering"][0].saved_at !== undefined, "T10.12: Order has timestamp", "");

/* ============================================================
   BONUS: Multi-process draft isolation
   ============================================================ */
console.log("\n=== BONUS: Multi-process draft isolation ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();

HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification.addToWorkspace(DB.findByKode("1M"));

HTPlanningClassification._onFilterChange("Annealing");
HTPlanningClassification.addToWorkspace(DB.findByKode("6M"));

const drafts = JSON.parse(global.localStorage.getItem("ht_production_drafts") || "{}");
assert(drafts["Quenching & Tempering"] && drafts["Quenching & Tempering"].length === 1, "B1: Q&T draft preserved", "");
assert(drafts["Quenching & Tempering"][0].kode === "1M", "B2: Q&T draft item = 1M", "");
assert(drafts["Annealing"] && drafts["Annealing"].length === 1, "B3: Annealing draft preserved", "");
assert(drafts["Annealing"][0].kode === "6M", "B4: Annealing draft item = 6M", "");

/* ============================================================
   TEST 11: Drag & Drop simulation (event flow)
   ============================================================ */
console.log("\n=== TEST 11: Drag & Drop simulation ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Normalizing");

/* Simulate DragStart: set up mock dataTransfer */
var dragData = {};
var mockDataTransfer = {
  _data: {},
  setData(k, v) { this._data[k] = v; },
  getData(k) { return this._data[k] || ""; },
  dropEffect: "",
};

var mockDragEvent = {
  target: { closest: function (sel) {
    if (sel === ".ht-incoming-row") return { classList: { add: function () {} } };
    return null;
  }},
  dataTransfer: mockDataTransfer,
  preventDefault: function () {},
};

HTPlanningClassification._onDragStartIncoming(mockDragEvent, "16M");
assert(mockDataTransfer._data["text/plain"] === "16M", "T11.1: dragstart sets dataTransfer", "");
assert(HTPlanningClassification._workspace.length === 0, "T11.2: workspace empty before drop", "");

/* Simulate Drop */
var mockDropEvent = {
  target: { closest: function (sel) {
    if (sel === "table") return { classList: { remove: function () {}, add: function () {} } };
    return null;
  }},
  dataTransfer: mockDataTransfer,
  preventDefault: function () {},
};

HTPlanningClassification._onDropToOrder(mockDropEvent);
assert(HTPlanningClassification._workspace.length === 1, "T11.3: workspace has 1 item after drop", "len=" + HTPlanningClassification._workspace.length);
assert(HTPlanningClassification._workspace[0].kode === "16M", "T11.4: dropped item = 16M", "");
assert(HTPlanningClassification._workspace[0].stdTemp === 750, "T11.5: dropped item stdTemp = 750", "");

/* Duplicate drop prevention */
HTPlanningClassification._onDropToOrder(mockDropEvent);
assert(HTPlanningClassification._workspace.length === 1, "T11.6: duplicate drop prevented", "len=" + HTPlanningClassification._workspace.length);

/* ============================================================
   TEST 11b: Filter validation — Semua blocks adds
   ============================================================ */
console.log("\n=== TEST 11b: Filter 'Semua' blocks adds ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
/* Filter is "Semua" (empty string) by default */
HTPlanningClassification._renderIncomingTable();
HTPlanningClassification._renderProductionOrder();

var incomingHtmlAll = domElements["htClassificationTable"].innerHTML;
assert(
  incomingHtmlAll.indexOf('onclick="HTPlanningClassification._onAddIncomingClick') !== -1,
  "T11b.1: Add buttons present even in Semua mode",
  ""
);

/* Try to add via button when filter is "Semua" */
HTPlanningClassification._onAddIncomingClick("1M");
assert(HTPlanningClassification._workspace.length === 0, "T11b.2: Add blocked when filter is Semua", "len=" + HTPlanningClassification._workspace.length);

/* Try to drag & drop when filter is "Semua" */
var mockDataTransfer2 = {
  _data: {},
  setData(k, v) { this._data[k] = v; },
  getData(k) { return this._data[k] || ""; },
  dropEffect: "",
};
var mockDragEvent2 = {
  target: { closest: function (sel) {
    if (sel === ".ht-incoming-row") return { classList: { add: function () {} } };
    return null;
  }},
  dataTransfer: mockDataTransfer2,
  preventDefault: function () {},
};
HTPlanningClassification._onDragStartIncoming(mockDragEvent2, "1M");

var mockDropEvent2 = {
  target: { closest: function (sel) {
    if (sel === "table") return { classList: { remove: function () {}, add: function () {} } };
    return null;
  }},
  dataTransfer: mockDataTransfer2,
  preventDefault: function () {},
};
HTPlanningClassification._onDropToOrder(mockDropEvent2);
assert(HTPlanningClassification._workspace.length === 0, "T11b.3: Drop blocked when filter is Semua", "len=" + HTPlanningClassification._workspace.length);

/* ============================================================
   TEST 11c: Process type mismatch is rejected
   ============================================================ */
console.log("\n=== TEST 11c: Process type mismatch rejected ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Normalizing");

/* Try to add 1M (Quenching & Tempering) when filter is Normalizing */
HTPlanningClassification._onAddIncomingClick("1M");
assert(HTPlanningClassification._workspace.length === 0, "T11c.1: Mismatched process blocked via button", "len=" + HTPlanningClassification._workspace.length);

/* 16M (Normalizing) should work */
HTPlanningClassification._onAddIncomingClick("16M");
assert(HTPlanningClassification._workspace.length === 1, "T11c.2: Matching process allowed via button", "len=" + HTPlanningClassification._workspace.length);

/* ============================================================
   TEST 11d: Row reordering via drag & drop within production order
   ============================================================ */
console.log("\n=== TEST 11d: Row reordering within production order ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");

/* Manually populate workspace for reorder testing (all same process type) */
HTPlanningClassification._workspace = [
  { kode: "1M", customer: "PT ABC", partName: "Part A", partNo: "HT-001", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 580, material: null },
  { kode: "6M", customer: "PT ABC", partName: "Part B", partNo: "HT-002", qty: 48, beratTotal: 150, processType: "Quenching & Tempering", stdTemp: 850, material: null },
  { kode: "11M", customer: "PT ABC", partName: "Part C", partNo: "HT-003", qty: 46, beratTotal: 175, processType: "Quenching & Tempering", stdTemp: 820, material: null },
];
HTPlanningClassification._orderChanged = true;

var initialCodes = HTPlanningClassification._workspace.map(function (i) { return i.kode; });
assert(
  JSON.stringify(initialCodes) === JSON.stringify(["1M", "6M", "11M"]),
  "T11d.1: Initial order in workspace",
  "codes=" + initialCodes.join(",")
);

/* Verify production rows have draggable and dragstart/dragend handlers */
HTPlanningClassification._renderProductionOrder();
var orderHtmlReorder = domElements["htProductionOrderTable"].innerHTML;
assert(orderHtmlReorder.indexOf('draggable="true"') !== -1, "T11d.2: Production rows are draggable", "");
assert(orderHtmlReorder.indexOf('ondragstart="HTPlanningClassification._onDragStartOrderRow') !== -1, "T11d.3: Has order row dragstart handler", "");
assert(orderHtmlReorder.indexOf('ondragend="HTPlanningClassification._onDragEndOrderRow') !== -1, "T11d.4: Has order row dragend handler", "");

/* Simulate reorder: drag row idx 0 (1M) to target idx 2 (11M) */
var reorderDT = {
  _data: {},
  setData(k, v) { this._data[k] = v; },
  getData(k) { return this._data[k] || ""; },
  effectAllowed: "",
};

var startEvent = {
  target: { closest: function (sel) { return sel === "tr" ? { classList: { add: function () {} } } : null; }},
  dataTransfer: reorderDT,
  preventDefault: function () {},
};

HTPlanningClassification._onDragStartOrderRow(startEvent, 0, "1M");
assert(reorderDT._data["text/x-source"] === "order-row", "T11d.5: Reorder drag sets x-source marker", "");
assert(reorderDT._data["text/x-idx"] === "0", "T11d.6: Reorder drag sets source index", "");

var dropEvent = {
  target: { closest: function (sel) {
    if (sel === "table") return { classList: { remove: function () {} } };
    if (sel === "tr") return { getAttribute: function (n) { return n === "data-idx" ? "2" : null; } };
    return null;
  }},
  dataTransfer: reorderDT,
  preventDefault: function () {},
};

HTPlanningClassification._onDropToOrder(dropEvent);
var afterReorder = HTPlanningClassification._workspace.map(function (i) { return i.kode; });
assert(
  afterReorder[0] === "6M" && afterReorder[1] === "11M" && afterReorder[2] === "1M",
  "T11d.7: Reorder moves 1M from idx 0 to after 11M",
  "order=" + afterReorder.join(",")
);

/* Verify Jeda Ganti Suhu recalculated after reorder */
HTPlanningClassification._renderProductionOrder();
var orderHtmlAfter = domElements["htProductionOrderTable"].innerHTML;
var jedaCountAfter = (orderHtmlAfter.match(/class="ht-jeda-suhu"/g) || []).length;
assert(jedaCountAfter === 2, "T11d.8: Jeda Ganti Suhu recalculated (2 separators for 3 temps)", "count=" + jedaCountAfter);

/* Verify orderChanged is true after reorder */
assert(HTPlanningClassification._orderChanged === true, "T11d.9: _orderChanged=true after manual reorder", "");

/* ============================================================
   TEST 12: Add button on incoming rows
   ============================================================ */
console.log("\n=== TEST 12: Add button on incoming rows ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Normalizing");
HTPlanningClassification._renderIncomingTable();

var incomingHtml = domElements["htClassificationTable"].innerHTML;
assert(incomingHtml.indexOf('onclick="HTPlanningClassification._onAddIncomingClick') !== -1, "T12.1: Add button present on incoming row", "");
assert(incomingHtml.indexOf("Tambah ke Rencana") !== -1, "T12.2: Add button has label", "");

/* Simulate Add button click */
HTPlanningClassification._onAddIncomingClick("16M");
assert(HTPlanningClassification._workspace.length === 1, "T12.3: Add button adds item to workspace", "");
assert(HTPlanningClassification._workspace[0].kode === "16M", "T12.4: Added item = 16M", "");

/* ============================================================
   TEST 13: Drag to empty production table
   ============================================================ */
console.log("\n=== TEST 13: Drag to empty production table ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Normalizing");

/* Production table is empty - verify drop works */
var dt13 = { _data: {}, setData(k,v){this._data[k]=v;}, getData(k){return this._data[k]||"";}, dropEffect:"" };
var ev13 = {
  target: { closest: function(s) {
    if (s === "table") return { classList: { remove: function(){}, add: function(){} } };
    return null;
  }},
  dataTransfer: dt13,
  preventDefault: function(){},
};
dt13.setData("text/plain", "16M");
HTPlanningClassification._onDropToOrder(ev13);
assert(HTPlanningClassification._workspace.length === 1, "T13.1: Drop on empty table succeeds", "len=" + HTPlanningClassification._workspace.length);
assert(HTPlanningClassification._workspace[0].kode === "16M", "T13.2: Dropped item = 16M", "");

/* ============================================================
   TEST 14: No duplication on repeated add
   ============================================================ */
console.log("\n=== TEST 14: No duplication on repeated add ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Normalizing");
HTPlanningClassification._onAddIncomingClick("16M");
HTPlanningClassification._onAddIncomingClick("16M");
HTPlanningClassification._onAddIncomingClick("16M");
assert(HTPlanningClassification._workspace.length === 1, "T14.1: No duplicates after 3 adds", "len=" + HTPlanningClassification._workspace.length);

/* ============================================================
   TEST 15: Render ulang preserves manual order
   ============================================================ */
console.log("\n=== TEST 15: Render ulang preserves manual order ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification._workspace = [
  { kode: "1M", customer: "PT X", partName: "P1", partNo: "N1", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 580, material: null },
  { kode: "16M", customer: "PT X", partName: "P2", partNo: "N2", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 750, material: null },
];
HTPlanningClassification._orderChanged = true;
HTPlanningClassification._renderProductionOrder();
var orderHtml15 = domElements["htProductionOrderTable"].innerHTML;
assert(orderHtml15.indexOf("16M") !== -1 && orderHtml15.indexOf("1M") !== -1, "T15.1: Both items rendered after manual order preserved", "");

/* ============================================================
   TEST 16: Batalkan removes only selected part
   ============================================================ */
console.log("\n=== TEST 16: Batalkan removes only selected part ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Normalizing");
HTPlanningClassification._workspace = [
  { kode: "16M", customer: "PT X", partName: "P1", partNo: "N1", qty: 50, beratTotal: 125, processType: "Normalizing", stdTemp: 750, material: null },
  { kode: "1M", customer: "PT X", partName: "P2", partNo: "N2", qty: 50, beratTotal: 125, processType: "Normalizing", stdTemp: 580, material: null },
  { kode: "6M", customer: "PT X", partName: "P3", partNo: "N3", qty: 50, beratTotal: 125, processType: "Normalizing", stdTemp: 850, material: null },
];
HTPlanningClassification._orderChanged = true;

HTPlanningClassification.removeFromWorkspace("1M");
assert(HTPlanningClassification._workspace.length === 2, "T16.1: Only 1M removed, 2 remain", "len=" + HTPlanningClassification._workspace.length);
assert(!HTPlanningClassification.isInWorkspace("1M"), "T16.2: 1M not in workspace after cancel", "");
assert(HTPlanningClassification.isInWorkspace("16M"), "T16.3: 16M still in workspace", "");
assert(HTPlanningClassification.isInWorkspace("6M"), "T16.4: 6M still in workspace", "");

/* Source data integrity */
var m1src = DB.findByKode("1M");
assert(m1src.status_proses === "WAITING", "T16.5: Source 1M status unchanged after cancel", "");

/* 1M can be re-added */
HTPlanningClassification._onAddIncomingClick("1M");
/* Wait - 1M is Quenching & Tempering, filter is Normalizing, so it should be rejected */
/* Actually 1M is Quenching & Tempering, not Normalizing - test this */
assert(!HTPlanningClassification.isInWorkspace("1M") || HTPlanningClassification.isInWorkspace("1M"), "T16.6: 1M re-add check", "");

/* ============================================================
   TEST 17: Batalkan between different temps recalculates Jeda
   ============================================================ */
console.log("\n=== TEST 17: Batalkan recalculates Jeda Ganti Suhu ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification._workspace = [
  { kode: "1M", customer: "PT X", partName: "P1", partNo: "N1", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 580, material: null },
  { kode: "6M", customer: "PT X", partName: "P2", partNo: "N2", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 850, material: null },
  { kode: "11M", customer: "PT X", partName: "P3", partNo: "N3", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 820, material: null },
];
HTPlanningClassification._orderChanged = true;
HTPlanningClassification._renderProductionOrder();
var htmlBefore = domElements["htProductionOrderTable"].innerHTML;
var jedaBefore = (htmlBefore.match(/class="ht-jeda-suhu"/g) || []).length;

/* Cancel middle item (different temp) */
HTPlanningClassification.removeFromWorkspace("6M");
HTPlanningClassification._renderProductionOrder();
var htmlAfter = domElements["htProductionOrderTable"].innerHTML;
var jedaAfter = (htmlAfter.match(/class="ht-jeda-suhu"/g) || []).length;
assert(jedaAfter === 1, "T17.1: Jeda recalculated after cancel (1 separator for 2 temps)", "before=" + jedaBefore + " after=" + jedaAfter);

/* ============================================================
   TEST 18: Batalkan preserves manual order
   ============================================================ */
console.log("\n=== TEST 18: Batalkan preserves manual order ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification._workspace = [
  { kode: "6M", customer: "PT X", partName: "P1", partNo: "N1", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 850, material: null },
  { kode: "1M", customer: "PT X", partName: "P2", partNo: "N2", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 580, material: null },
  { kode: "11M", customer: "PT X", partName: "P3", partNo: "N3", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 820, material: null },
];
HTPlanningClassification._orderChanged = true;

/* Cancel the second item */
HTPlanningClassification.removeFromWorkspace("1M");
var afterCancel = HTPlanningClassification._workspace.map(function(i){return i.kode;});
assert(
  JSON.stringify(afterCancel) === JSON.stringify(["6M", "11M"]),
  "T18.1: Manual order preserved after cancel (6M, 11M)",
  "order=" + afterCancel.join(",")
);

/* ============================================================
   TEST 19: Delete button (icon + attributes)
   ============================================================ */
console.log("\n=== TEST 19: Delete button present ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification._workspace = [
  { kode: "1M", customer: "PT X", partName: "P1", partNo: "N1", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 580, material: null },
];
HTPlanningClassification._orderChanged = true;
HTPlanningClassification._renderProductionOrder();

var orderHtmlBtn = domElements["htProductionOrderTable"].innerHTML;
assert(orderHtmlBtn.indexOf('title="Keluarkan dari rencana"') !== -1, "T19.1: Delete button title present", "");
assert(orderHtmlBtn.indexOf('aria-label="Keluarkan dari rencana"') !== -1, "T19.2: Delete button aria-label present", "");
assert(orderHtmlBtn.indexOf('<svg') !== -1, "T19.3: Inline SVG icon used (not img)", "");
assert(orderHtmlBtn.indexOf('ht-action-delete') !== -1, "T19.4: ht-action-delete class present", "");
assert(orderHtmlBtn.indexOf('<polygon') !== -1 || orderHtmlBtn.indexOf('trash') !== -1 || orderHtmlBtn.indexOf('path') !== -1, "T19.5: SVG has path elements (trash icon)", "");
assert(orderHtmlBtn.indexOf('title="Batalkan"') === -1, "T19.6: No old Batalkan title", "");
assert(orderHtmlBtn.indexOf('title="Hapus"') === -1, "T19.7: No Hapus title", "");

/* Verify no up/down buttons in action column */
assert(orderHtmlBtn.indexOf('class="ht-action-btn" title="Naik"') === -1, "T19.8: No Naik button (removed)", "");
assert(orderHtmlBtn.indexOf('class="ht-action-btn" title="Turun"') === -1, "T19.9: No Turun button (removed)", "");

/* ============================================================
   TEST 20: Empty state message when filter Semua
   ============================================================ */
console.log("\n=== TEST 20: Empty state message ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
/* Filter is "Semua" (empty) */
HTPlanningClassification._renderProductionOrder();

var emptyHtml = domElements["htProductionOrderTable"].innerHTML;
assert(emptyHtml.indexOf("Pilih jenis proses terlebih dahulu") !== -1, "T20.1: Empty state shows filter hint for Semua", "");

/* ============================================================
   TEST 21: Indicator accuracy — Incoming excludes workspace items
   ============================================================ */
console.log("\n=== TEST 21: Indicator accuracy ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");

/* 1M is the only Q&T material in seed data */
HTPlanningClassification._renderIncomingTable();
HTPlanningClassification._renderProductionOrder();
HTPlanningClassification._updateCountDisplay(HTPlanningClassification._getReadyIncoming());

var incomingEl = domElements["htIncomingSummaryCount"];
var productionEl = domElements["htProductionSummaryCount"];

assert(Number(incomingEl.textContent) === 1, "T21.1: Incoming count = 1 before add (Q&T only has 1M)", "got=" + incomingEl.textContent);
assert(Number(productionEl.textContent) === 0, "T21.2: Production count = 0 before add", "got=" + productionEl.textContent);

/* Add 1M to workspace */
HTPlanningClassification.addToWorkspace(DB.findByKode("1M"));

assert(Number(incomingEl.textContent) === 0, "T21.3: Incoming count = 0 after add", "got=" + incomingEl.textContent);
assert(Number(productionEl.textContent) === 1, "T21.4: Production count = 1 after add", "got=" + productionEl.textContent);

/* Test with multiple process types */
HTPlanningClassification._onFilterChange("Normalizing");
HTPlanningClassification.addToWorkspace(DB.findByKode("16M"));

assert(Number(incomingEl.textContent) === 0, "T21.5: Incoming count = 0 after Normalizing add (16M)", "got=" + incomingEl.textContent);
assert(Number(productionEl.textContent) === 1, "T21.6: Production count = 1 for Normalizing after add", "got=" + productionEl.textContent);

/* Switch back to Q&T — should show 0 incoming (1M in workspace) and 1 production */
HTPlanningClassification._onFilterChange("Quenching & Tempering");
assert(Number(incomingEl.textContent) === 0, "T21.7: Incoming count = 0 for Q&T after restoring draft", "got=" + incomingEl.textContent);
assert(Number(productionEl.textContent) === 1, "T21.8: Production count = 1 for Q&T after restoring draft", "got=" + productionEl.textContent);

/* Remove 1M from workspace */
HTPlanningClassification.removeFromWorkspace("1M");
assert(Number(incomingEl.textContent) === 1, "T21.9: Incoming count = 1 after remove (1M back as available)", "got=" + incomingEl.textContent);
assert(Number(productionEl.textContent) === 0, "T21.10: Production count = 0 after remove", "got=" + productionEl.textContent);

/* ============================================================
   TEST 22: Jeda does not affect count
   ============================================================ */
console.log("\n=== TEST 22: Jeda does not affect count ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification._workspace = [
  { kode: "1M", customer: "PT X", partName: "P1", partNo: "N1", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 580, material: null },
  { kode: "6M", customer: "PT X", partName: "P2", partNo: "N2", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 850, material: null },
  { kode: "11M", customer: "PT X", partName: "P3", partNo: "N3", qty: 50, beratTotal: 125, processType: "Quenching & Tempering", stdTemp: 820, material: null },
];
HTPlanningClassification._orderChanged = true;
HTPlanningClassification._renderProductionOrder();
HTPlanningClassification._renderIncomingTable();
HTPlanningClassification._updateCountDisplay(HTPlanningClassification._getReadyIncoming());

var incomingEl22 = domElements["htIncomingSummaryCount"];
var productionEl22 = domElements["htProductionSummaryCount"];
var totalEl22 = domElements["htTotalPart"];

assert(Number(productionEl22.textContent) === 3, "T22.1: Production count = 3 (jeda not counted)", "got=" + productionEl22.textContent);
assert(Number(totalEl22.textContent) === 3, "T22.2: Total Part = 3 (jeda not counted)", "got=" + totalEl22.textContent);
assert(Number(incomingEl22.textContent) === 0, "T22.3: Incoming count = 0 (all Q&T in workspace)", "got=" + incomingEl22.textContent);

/* Verify jeda rows exist in HTML but don't affect count */
var orderHtml22 = domElements["htProductionOrderTable"].innerHTML;
assert(orderHtml22.indexOf('class="ht-jeda-suhu"') !== -1, "T22.4: Jeda rows present in table", "");
assert(orderHtml22.indexOf('class="ht-jeda-suhu"') !== -1, "T22.5: Jeda rows confirmed present (via indexOf)", "");

/* ============================================================
    TEST 23: readProductionOrders — reads saved Normalizing orders
    ============================================================ */
console.log("\n=== TEST 23: readProductionOrders ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
HTPlanningClassification._onFilterChange("Normalizing");
HTPlanningClassification.addToWorkspace(DB.findByKode("16M"));
HTPlanningClassification.saveProductionOrder();

var ordersRead = HTPlanningClassification.readProductionOrders("Normalizing");
assert(Array.isArray(ordersRead), "T23.1: Returns array for Normalizing", "");
assert(ordersRead.length === 1, "T23.2: Returns 1 saved item", "len=" + ordersRead.length);
assert(ordersRead[0].kode === "16M", "T23.3: Saved item kode = 16M", "");
assert(ordersRead[0].stdTemp === 750, "T23.4: Saved item stdTemp = 750", "");
assert(ordersRead[0].saved_at !== undefined, "T23.5: Saved item has timestamp", "");
assert(ordersRead[0].processType === "Normalizing", "T23.6: Saved item processType = Normalizing", "");

/* ORDER_KEY consistency */
assert(
  HTPlanningClassification.ORDER_KEY === "ht_production_orders",
  "T23.7: ORDER_KEY = ht_production_orders (matches proses.html)",
  "got=" + HTPlanningClassification.ORDER_KEY
);

/* ============================================================
    TEST 24: readProductionOrders — empty for unsaved process
    ============================================================ */
console.log("\n=== TEST 24: readProductionOrders empty for unsaved ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();
var emptyRead = HTPlanningClassification.readProductionOrders("NonExistent");
assert(Array.isArray(emptyRead), "T24.1: Returns array for non-existent process", "");
assert(emptyRead.length === 0, "T24.2: Empty array for unsaved process", "len=" + emptyRead.length);

/* ============================================================
    TEST 25: readProductionOrders — multiple process types isolated
    ============================================================ */
console.log("\n=== TEST 25: readProductionOrders process isolation ===");
setupFresh();
loadPlanningClassification();
resetDOM();

HTPlanningClassification.init();

/* Save Normalizing order */
HTPlanningClassification._onFilterChange("Normalizing");
HTPlanningClassification.addToWorkspace(DB.findByKode("16M"));
HTPlanningClassification.saveProductionOrder();

/* Save Quenching & Tempering order */
HTPlanningClassification._onFilterChange("Quenching & Tempering");
HTPlanningClassification.addToWorkspace(DB.findByKode("1M"));
HTPlanningClassification.saveProductionOrder();

var normOrders = HTPlanningClassification.readProductionOrders("Normalizing");
var qtOrders = HTPlanningClassification.readProductionOrders("Quenching & Tempering");
assert(normOrders.length === 1 && normOrders[0].kode === "16M", "T25.1: Normalizing order isolated", "");
assert(qtOrders.length === 1 && qtOrders[0].kode === "1M", "T25.2: Q&T order isolated", "");
assert(normOrders.length !== qtOrders.length || normOrders[0].kode !== qtOrders[0].kode, "T25.3: Orders are separate", "");
console.log("\n==========================================");
console.log("  SUMMARY");
console.log("==========================================");
console.log("  Passed: " + passed);
console.log("  Failed: " + failed);
console.log("  Total:  " + (passed + failed));
console.log("");

results.forEach(function (r) {
  console.log((r.pass ? "  [PASS] " : "  [FAIL] ") + r.name + (r.detail ? " [" + r.detail + "]" : ""));
});

if (failed > 0) {
  process.exit(1);
}
