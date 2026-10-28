/* Verification harness for inspection report layout.
   Loads the REAL report-center.js logic against a seeded DB and renders
   the document HTML + inline CSS, then asserts landscape/portrait
   invariants. Writes a snapshot HTML for print-preview inspection. */
const fs = require("fs");
const path = require("path");

class MemoryStorage {
  constructor() { this.s = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.s, k) ? this.s[k] : null; }
  setItem(k, v) { this.s[k] = String(v); }
  removeItem(k) { delete this.s[k]; }
  keys() { return Object.keys(this.s); }
}
global.localStorage = new MemoryStorage();

// Load DB
const dbCode = fs.readFileSync(path.join(__dirname, "..", "js", "db.js"), "utf8");
const DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);
DB.init();

// Load date-format globals (function declarations are scoped to the eval, capture & expose)
const dfCode = fs.readFileSync(path.join(__dirname, "..", "js", "date-format.js"), "utf8");
const df = new Function(dfCode + "\n; return { formatDateLong: formatDateLong, formatDateLongWithTime: formatDateLongWithTime, HTDateFormat: HTDateFormat };")();
global.formatDateLong = df.formatDateLong;
global.formatDateLongWithTime = df.formatDateLongWithTime;
global.HTDateFormat = df.HTDateFormat;

// Stubs for runtime deps not needed by generateDocumentHtml
global.HTUI = { requireAuth: () => true, createScanner: ()=>null, startScanner:()=>{}, openModal:()=>{}, closeModal:()=>{}, toast:()=>{} };
global.QRCode = function(){};
global.window = { location: { protocol:"http:", host:"localhost", pathname:"/inspection-report.html" } };
global.HTDateFormat = global.HTDateFormat;
global.document = { getElementById:function(){return null;}, addEventListener:function(){} };

// Load RCF from report-center.js (references DB, formatDateLong, HTDateFormat, HTUI, QRCode as globals)
const rcCode = fs.readFileSync(path.join(__dirname, "..", "js", "report-center.js"), "utf8");
const deps = ["DB","formatDateLong","HTDateFormat","HTUI","QRCode","window","document"];
const factory = new Function(...deps, rcCode + "\n; return RCF;");
const RCF = factory(DB, global.formatDateLong, global.HTDateFormat, global.HTUI, global.QRCode, global.window, global.document);

function findReportable() {
  // find a material with QC OK + approvals + a before record (inject if none)
  const mats = DB.get("materials");
  for (const m of mats) {
    const qc = DB._getAfterQc(m);
    if (qc && qc.hasil === "OK") return m;
  }
  return mats.find(m => m) || null;
}

let material = findReportable();
if (!material) { console.log("NO MATERIAL"); process.exit(1); }

// Inject a rich QC record with before/after values, signatures, so the
// table + signatures render with real content. Use a dedicated kode.
function makeQC(mat, stage, sv, cv, sig) {
  return {
    id: 999000 + (stage==="before"?1:2),
    production_id: null, material_id: mat.id,
    hardness: "", satuan_hardness: "HRC", hasil: "OK",
    microstructure: "Fine pearlite + ferrite", remarks: "",
    inspector: stage==="before" ? "" : "Inspector QC 01",
    tanggal_inspector: stage==="after" ? "2026-09-15" : "",
    catatan: "", user_id: 1, created_at:"2026-09-15T00:00:00Z", updated_at:"2026-09-15T00:00:00Z",
    leader_judgement: stage==="after"?"OK":null, leader_name: stage==="after"?"Leader QC 01":null,
    leader_date: stage==="after"?"2026-09-16":"", leader_signature: stage==="after"?sig:null,
    supervisor_judgement: stage==="after"?"OK":null, supervisor_name: stage==="after"?"Supervisor QC 01":null,
    supervisor_date: stage==="after"?"2026-09-17":"", supervisor_signature: stage==="after"?sig:null,
    supervisor_notes: "Approved",
    remarks: JSON.stringify({ stage: stage, surface_values: sv, core_values: cv, signature: stage==="after"?sig:null, surface_result:"OK", core_result:"OK" })
  };
}
const sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
const sv = [60,61,62,60,61,60,62,61,60,61,62,60];
const cv = [58,59,60,58,59,58,60,59,58,59,60,58];
const asv = [61,62,63,61,62,61,63,62,61,62,63,61];
const acv = [59,60,61,59,60,59,61,60,59,60,61,59];
const beforeQc = makeQC(material,"before",sv,cv,sig);
const afterQc = makeQC(material,"after",asv,acv,sig);
const qcs = DB.get("qcs");
qcs.push(beforeQc, afterQc);
DB.get = (function(orig){ return function(t){ if(t==="qcs") return qcs; return orig(t); }; })(DB.get.bind(DB));
// ensure _getAfterQc/_getBeforeQc use the augmented array: they call DB.get("qcs")
DB._qcsOverride = qcs;

// Monkeypatch DB.get for "qcs" to return augmented array
const origGet = DB.get.bind(DB);
DB.get = function(t){ if(t==="qcs") return qcs; return origGet(t); };

RCF.state.reportNumber = "IR-TEST-001";
const html = RCF.generateDocumentHtml(material, afterQc, { hasInspector:true, inspectorHasil:"OK", leaderJudgement:"OK", leaderName:"Leader QC 01", leaderDate:"2026-09-16", leaderSignature:sig, supervisorJudgement:"OK", supervisorName:"Supervisor QC 01", supervisorDate:"2026-09-17", supervisorSignature:sig }, { signature:sig, stage:"after", surface_values:asv, core_values:acv, satuan_hardness:"HRC" }, DB.getProcessProduction(material,"HT")||{});
const css = RCF._getInlineCss();

// Build snapshot
const docHtml = '<!doctype html><html><head><meta charset="UTF-8"><title>Snapshot</title><style>' + css + '</style></head><body>' + html + '</body></html>';
fs.writeFileSync(path.join(__dirname, "..", "out_snapshot.html"), docHtml);
console.log("snapshot written:", path.join(__dirname,"..","out_snapshot.html"));

// Assertions
const isLandscape = /A4\s+landscape/i.test(css);
const isPortrait = /A4\s+portrait/i.test(css);
console.log("[@page] landscape:", isLandscape, "| portrait:", isPortrait);
console.log("["+ (isLandscape&&!isPortrait ? "OK  ":"FAIL") + "] @page size A4 landscape, not portrait");

const docW = (css.match(/\.ir-document[^}]*?width:297mm/) || []).length;
const docH = (css.match(/\.ir-document[^}]*?height:210mm/) || []).length;
console.log("["+ (docW && docH ? "OK  ":"FAIL") + "] .ir-document dimensions 297mm x 210mm (landscape)");

const printRule = (css.indexOf('.ir-document { padding:10mm; width:297mm; height:210mm') > -1 ||
                   css.indexOf('.ir-document { padding:10mm; width: 297mm; height: 210mm') > -1);
console.log("["+ (printRule ? "OK  " : "FAIL") + "] @media print .ir-document 297x210mm");

const portraitDim = /width:210mm/.test(css) || /height:297mm\s*;/s.test(css);
console.log("["+ (!portraitDim ? "OK  ":"FAIL") + "] no portrait dims (210mm width / 297mm height)");

// HTML section presence
function has(cls){ return html.indexOf(cls) > -1; }
const sections = ["ir-header","ir-logo","ir-report-title","ir-report-subtitle","HARDNESS TEST","ir-qr-code","ir-info-panel","INFORMASI PART","Control Number","Part Name","Part Number","Lot Number","Material Charge","Status Part","Customer","Jenis Proses","INSPECTION RESULT","STANDAR HARDNESS","ir-standards-section","Toleransi","Metode Pengujian","NILAI HARDNESS","ir-approval-section","Inspector QC","Leader QC","Supervisor QC","CATATAN","ir-notes-section","ir-footer"];
console.log("\n--- section presence in generated HTML ---");
sections.forEach(s=>{ console.log("["+ (has(s)?"OK  ":"FAIL") + "] " + s); });

// 12 Test Piece rows + summary rows
const tpRows = (html.match(/ir-cell-tp/g)||[]).length;
console.log("\n[table] Test Piece rows:", tpRows, "(expected 12)");
const avgOnce = (html.match(/ir-summary-label">Average</g)||[]).length;
console.log("[table] Average summary row:", avgOnce, "(expected 1)");

// Standards derive checks (actual data: target 58-62 HRC, satuan HRC)
function between(re){ var m = html.match(re); return m ? m[0] : "(not found)"; }
console.log("\n[standards] target value from data:", has("58-62 HRC"));
console.log("[standards] toleransi derived:", /Toleransi/.test(html), "->", between(/>\s*([0-9]+ ± [0-9]+ HRC)/));
console.log("[standards] metode derived:", /Metode Pengujian/.test(html), "->", between(/>Rockwell C Hardness \(HRC\)/));
console.log("[standards] no hard-coded ASME/ASTM:", !/ASME B18\.2\.1/.test(html), "| no 'Rockwell / Vickers':", !/Rockwell \/ Vickers Hardness Tester/.test(html));

// 3 signature areas
const threeCards = (html.match(/ir-approval-card/g)||[]).length;
console.log("\n[signatures] approval cards:", threeCards, "(expected 3)");
const roles = (html.match(/Inspector QC/g)||[]).length;
console.log("[signatures] 'Inspector QC' title+badge:", roles, "(expected 2)");
const notesLines = (html.match(/ir-note-line/g)||[]).length;
console.log("[notes] note lines:", notesLines, "(expected 6)");
