# Project Guidelines

## Inspection Report — Halaman Dihapus

Halaman `inspection-report.html` beserta asset terkait (`css/inspection-report.css`, `css/report-center.css`) telah dihapus dari aplikasi.

- Menu "Inspection Report" telah dihapus dari seluruh sidebar navigasi (15 file HTML).
- `js/report-center.js` masih ada tetapi tidak dimuat oleh halaman produksi apa pun (hanya digunakan oleh tes).
- Referensi URL QR ke `inspection-report.html` pada `js/report-center.js` telah dikosongkan.
- Tidak ada tautan aktif menuju `inspection-report.html`.

Jangan merestore halaman ini tanpa persetujuan.
Jangan mengubah Input Data, Delivery, QC, Tracking, Dashboard, Planning Produksi, Heat Treatment, atau seluruh proses produksi.
Jangan melakukan reset database atau localStorage.

## Verifikasi Tersisa

```bash
# Syntax check modified JS
node --check js/report-center.js
node --check js/db.js
```

`js/inspection-report.js` adalah **dead code** (tidak direferensikan oleh halaman apa pun); jangan direvive.
