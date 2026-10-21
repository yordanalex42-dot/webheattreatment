const fs = require("fs");
const h = fs.readFileSync("index.html", "utf8");
const lines = h.split(/\r?\n/);
console.log("index.html lines:", lines.length);
const kw = ["target","total","input","output","kpi","berat","month","filter","calendar","progress","stat","bulan","refresh","export"];
let hits = [];
lines.forEach((l, i) => {
  const low = l.toLowerCase();
  // match class="..." or id="..." containing a keyword
  const classMatch = l.match(/class="([^"]*)"/);
  const idMatch = l.match(/id="([^"]*)"/);
  for (const m of [classMatch, idMatch]) {
    if (m) {
      const val = m[1];
      for (const k of kw) {
        if (val.toLowerCase().includes(k)) { hits.push((i+1) + ": " + l.trim().slice(0, 140)); break; }
      }
    }
  }
});
// dedupe preserve order
const seen = new Set();
const uniq = [];
for (const h of hits) { if (!seen.has(h)) { seen.add(h); uniq.push(h); } }
console.log("=== KPI-related lines (" + uniq.length + ") ===");
uniq.forEach(s => console.log("  " + s));
