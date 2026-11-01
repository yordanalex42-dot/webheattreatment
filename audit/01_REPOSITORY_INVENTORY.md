# REPOSITORY INVENTORY

## HTML Pages (23 files)
1. index.html - Dashboard
2. login.html - Login page
3. customer.html - Master Data Customer
4. part.html - Master Data Part
5. incoming.html - Incoming Part (PPIC)
6. planning-produksi.html - Planning Produksi (PPIC)
7. delivery.html - Delivery (PPIC)
8. heat-treatment.html - Heat Treatment processes
9. proses.html - Production processes
10. produksi-masuk.html - Production entry
11. produksi-akhir.html - Production completion
12. shotblast.html - Shotblast
13. anti-rust.html - Anti Rust
14. qc.html - Quality Control
15. leader-qc.html - Leader QC
16. supervisor-qc.html - Supervisor QC
17. inspection-report.html - Inspection Report (EXISTS but menu removed per AGENTS.md)
18. tracking.html - Tracking
19. out_snapshot.html - Snapshot/Export view

## JavaScript Files (8 files in js/)
1. auth.js (2.8KB) - Authentication/authorization
2. dashboard.js (49KB) - Dashboard logic
3. date-format.js (1.9KB) - Date formatting utilities
4. db.js (79KB) - Data layer/LocalStorage management
5. inspection-report.js (40KB) - Inspection report logic (dead code per AGENTS.md)
6. planning-classification.js (33.5KB) - Planning classification
7. report-center.js (57KB) - Report center (not loaded by production pages per AGENTS.md)
8. ui.js (7KB) - UI utilities

## CSS Files (14 files in css/)
1. components.css (62KB)
2. dashboard.css (44KB)
3. forms.css (7.9KB)
4. global.css (18.8KB)
5. icons.css (27.6KB)
6. incoming.css (4.1KB)
7. inspection-report.css (5.7KB)
8. layout.css (4.8KB)
9. login.css (14.2KB)
10. qc-inspection.css (5.2KB)
11. sidebar.css (9.3KB)
12. tables.css (10.8KB)
13. tracking.css (7.6KB)

## External Dependencies (CDN)
- Chart.js
- xlsx@0.18.5
- html5-qrcode@2.3.8
- qrcodejs/1.0.0

## Data Storage
- Browser LocalStorage (client-side only, no backend)

