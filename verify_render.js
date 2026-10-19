const fs = require("fs");
const path = require("path");
class MemoryStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
  keys() { return Object.keys(this.store); }
}
const domElements = {};
function mockDocument() {
  return { getElementById(id) { if (!domElements[id]) domElements[id] = { _tag:id,innerHTML:"",textContent:"",classList:{_c:new Set(),add(c){this._c.add(c);},remove(c){this._c.delete(c);},contains(c){return this._c.has(c);},toggle(c,f){if(f===true)this._c.add(c);else if(f===false)this._c.delete(c);else{this._c.has(c)?this._c.delete(c):this._c.add(c);}},},appendChild(c){return c;},setAttribute(n,v){this[n]=v;},getAttribute(n){return this[n]||null;} }; return domElements[id]; }, createElement(t){return mockDocument().getElementById("_"+t);} };
}
global.localStorage = new MemoryStorage();
const dbCode = fs.readFileSync(path.join(__dirname,"js","db.js"),"utf8").replace("const DB","var DB");
const DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);
DB.init();
global.document = mockDocument();
global.Auth = { getSession: () => ({name:"user"}) };
const df = fs.readFileSync(path.join(__dirname,"js","date-format.js"),"utf8");
const html = fs.readFileSync(path.join(__dirname,"tracking.html"),"utf8");
const inline = (html.match(/<script>([\s\S]*?)<\/script>/)||[])[1]||"";
const code = df + "\n" + inline + "\n";
const HTUI = { requireAuth: () => true };
const fn = new Function("DB","document","HTUI","window", code + "\n; return { buildTimeline: buildTimeline, renderTimeline: renderTimeline };");
const api = fn(DB, global.document, HTUI, { addEventListener(){} });

const m = DB.findByKode("20260002I"); // no anti-rust
const part = DB.findPartById(m.part_id);
const customer = DB.findCustomerById(m.customer_id);
const qcs = DB.get("qcs").filter(q => String(q.material_id) === String(m.id));
const delivery = DB.get("deliveries").find(d => String(d.material_id) === String(m.id)) || null;
const steps = api.buildTimeline(m, qcs, delivery, part, customer);
api.renderTimeline(steps);
const out = domElements["timelineContainer"].innerHTML;
// Print a compact view: for each stepcol/card pair, show a trimmed snippet
const cleaned = out
  .replace(/<img[^>]*>/g, "<IMG>")
  .replace(/<span class="ht-meta-label">Mulai<\/span><span class="ht-meta-value">[^<]*<\/span>/g, "<META Mulai>")
  .replace(/<span class="ht-info-label">([^<]*)<\/span><span class="ht-info-value[^"]*"[^>]*>[^<]*<\/span>/g, "<ROW $1>")
  .replace(/\s+/g, " ");
console.log("STEP/CARD count:", (out.match(/ht-timeline-stepcol/g)||[]).length, steps, (out.match(/ht-timeline-card/g)||[]).length);
// Print the Anti-Rust card region
const ar = cleaned.indexOf("Antirust"); // wait label is "Anti-Rust"
const idx = cleaned.indexOf("Anti-Rust");
console.log("\n--- Anti-Rust region ---");
console.log(cleaned.slice(idx-60, idx+260));
