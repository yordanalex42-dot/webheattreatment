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
      if (!domElements[id]) domElements[id] = { _tag: id, textContent: "", value: "", innerHTML: "", classList: { _c: new Set(), add(c){this._c.add(c);}, remove(c){this._c.delete(c);}, contains(c){return this._c.has(c);}, toggle(c,f){if(f===true)this._c.add(c);else if(f===false)this._c.delete(c);else{this._c.has(c)?this._c.delete(c):this._c.add(c);}}, }, appendChild(c){return c;}, setAttribute(n,v){this[n]=v;}, getAttribute(n){return this[n]||null;} };
      return domElements[id];
    },
    createElement(tag) { return mockDocument().getElementById("_" + tag); },
  };
}

// 1. Load DB
global.localStorage = new MemoryStorage();
const dbCode = fs.readFileSync(path.join(__dirname, "js", "db.js"), "utf8").replace("const DB", "var DB");
const DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);
DB.init();

// 2. Mock DOM + stubs
global.document = mockDocument();
global.Auth = { getSession: () => ({ name: "user" }) };

// 3. date-format.js + inline tracking script
const df = fs.readFileSync(path.join(__dirname, "js", "date-format.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "tracking.html"), "utf8");
const inline = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || "";
const code = df + "\n" + inline + "\n";

const HTUI = { requireAuth: () => true };
const ctx = { DB, document: global.document, HTUI, window: { addEventListener(){} } };
const fn = new Function("DB", "document", "HTUI", "window", code + "\n; return { buildTimeline: buildTimeline, renderTimeline: renderTimeline, STEP_LABELS: STEP_LABELS, STEP_ICONS: STEP_ICONS, PROCESS_CARD_LABELS: PROCESS_CARD_LABELS };");
const api = fn(ctx.DB, ctx.document, ctx.HTUI, ctx.window);

function run(kode) {
  const m = DB.findByKode(kode);
  if (!m) { console.log(kode, "NOT FOUND"); return; }
  const part = DB.findPartById(m.part_id);
  const customer = DB.findCustomerById(m.customer_id);
  const qcs = DB.get("qcs").filter(q => String(q.material_id) === String(m.id));
  const delivery = DB.get("deliveries").find(d => String(d.material_id) === String(m.id)) || null;
  const steps = api.buildTimeline(m, qcs, delivery, part, customer);
  console.log("\n=== " + kode + " (kode=" + m.kode + ", part=" + (part ? part.nama_part : "-") + ") ===");
  console.log("steps (" + steps.length + "):");
  steps.forEach(s => console.log("  - " + s.label.padEnd(18) + " state=" + s.state.padEnd(9) + " badge=" + s.badge.label + (s.card.notice ? "  NOTICE: " + s.card.notice : "")));
  // render
  api.renderTimeline(steps);
  const el = domElements["timelineContainer"];
  const htmlOut = el ? el.innerHTML : "(no timelineContainer)";
  const leaks = (htmlOut.match(/undefined|NaN/g) || []);
  console.log("rendered chars=" + htmlOut.length + ", undefined/NaN leaks=" + leaks.length);
  if (leaks.length) console.log("  LEAKS:", leaks);
  if (kode === "20260002I") console.log("  anti-rust placeholder present:", htmlOut.indexOf("Tidak ada proses Anti-Rust") !== -1);
  if (kode === "20260001I") console.log("  full route anti-rust data present:", htmlOut.indexOf("Suhu Aktual") !== -1);
}

run("20260001I"); // full route: HT + QC + Shotblast + Anti-Rust
run("20260002I"); // no anti-rust, no shotblast
run("20260003I"); // HT + QC + Anti-Rust (no shotblast)
run("1M");        // trial/special route
