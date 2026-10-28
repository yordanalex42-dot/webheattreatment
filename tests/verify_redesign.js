// Final structural verification of the redesign.
const fs = require("fs");
const path = require("path");
const h = fs.readFileSync(path.join(__dirname, "..", "tracking.html"), "utf8");
const m = h.match(/<script>([\s\S]*?)<\/script>/);
const inline = m[1];
let ob = 0, cb = 0;
for (const ch of inline) { if (ch === "{") ob++; if (ch === "}") cb++; }
console.log("inline braces {=", ob, "}=", cb, "balanced=", ob === cb);

const css = fs.readFileSync(path.join(__dirname, "..", "css", "components.css"), "utf8");
let o2 = 0, c2 = 0;
for (const ch of css) { if (ch === "{") o2++; if (ch === "}") c2++; }
console.log("css braces {=", o2, "}=", c2, "balanced=", o2 === c2);

// Key class presence
const checks = [
  [".ht-timeline grid col", css.indexOf("grid-template-columns: 180px 1fr;") > -1],
  [".ht-timeline::before trunk", css.indexOf(".ht-timeline::before") > -1],
  [".ht-timeline-stepcol", css.indexOf(".ht-timeline-stepcol") > -1],
  [".ht-timeline-card", css.indexOf(".ht-timeline-card {") > -1],
  [".ht-timeline-card.notice", css.indexOf(".ht-timeline-card-notice") > -1],
  [".ht-timeline-node.na", css.indexOf(".ht-timeline-node.na") > -1],
  [".ht-file-protocol", css.indexOf(".ht-file-protocol") > -1],
  ["renderTimeline writes timelineContainer", inline.indexOf('getElementById("timelineContainer").innerHTML') > -1],
  ["buildTimeline signature", inline.indexOf("function buildTimeline(material, qcs, delivery, part, customer)") > -1],
  ["processOrder", inline.indexOf('["HT", "SHOTBLAST", "ANTI_RUST"]') > -1],
  ["no dead renderProcessResults", inline.indexOf("function renderProcessResults") === -1],
  ["no dead renderQC", inline.indexOf("function renderQC(qcs)") === -1],
  ["no dead renderDelivery", inline.indexOf("function renderDelivery(material, delivery)") === -1],
  [".ht-material-main present", h.indexOf("ht-material-main") > -1],
  [".ht-material-grid present", h.indexOf("ht-material-grid") > -1],
  ["Control Number label", h.indexOf("Control Number") > -1],
  ["Status Part label", h.indexOf("Status Part") > -1],
  ["Data Material title", h.indexOf("Data Material") > -1],
  ["Timeline Status Produksi title", h.indexOf("Timeline Status Produksi") > -1],
];
console.log("\n--- checks ---");
checks.forEach(([k, v]) => console.log((v ? "OK  " : "FAIL") + " " + k));
