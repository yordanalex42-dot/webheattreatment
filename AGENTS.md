# Project Guidelines

## Inspection Report – Landscape Redesign
The "Inspection Report – Hardness Test" (`js/report-center.js` → `_getInlineCss()` + `generateDocumentHtml()`,
rendered into an `about:blank` print window via `inspection-report.html`) is A4 **landscape**
(`@page { size: A4 landscape }`, page box `297mm × 210mm`).

- Tolerance display (`Toleransi`) is **derived** from `part.target_hardness` (e.g. `60 ± 2 HRC`).
- Method display (`Metode Pengujian`) is **derived** from `qc.satuan_hardness` (e.g. `Rockwell C Hardness (HRC)`).
- No hard-coded ASME/ASTM standard strings or generic "Rockwell / Vickers" text.

## Validation / Verification
This project has no `package.json`, ESLint, or test framework (plain browser JS). The available checks:

```bash
# Syntax check modified JS
node --check js/report-center.js
node --check js/db.js

# Layout + data invariants (landscape, sections, derived standards, table shape)
node verify_report_landscape.js
```

`verify_report_landscape.js` seeds an in-memory DB, renders the document, writes a print-preview snapshot
(`out_snapshot.html`), and asserts: A4 landscape, 297×210mm page box, all report sections present, 7-column
table with 12 Test Pieces + 1 Average row, derived Toleransi/Metode, 3 approval cards, 6 note lines.

## Notes
- `js/inspection-report.js` is **dead code** (not referenced by `inspection-report.html`); do not revive it.
- `css/report-center.css` is the on-screen preview style loaded by `inspection-report.html`; the printed
  report uses the inline CSS returned by `RCF._getInlineCss()`. Keep both landscape and consistent.
