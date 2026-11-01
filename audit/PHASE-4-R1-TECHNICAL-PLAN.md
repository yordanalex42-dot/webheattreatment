# PHASE 4 — TECHNICAL IMPLEMENTATION PLANNING (R1)

**Date:** 2026-11-01 13:52:16  
**Status:** PLANNING ONLY - NO IMPLEMENTATION  
**Scope:** R1 Quick Wins Only  
**Architecture:** HTML + CSS + JavaScript + LocalStorage + GitHub Pages

---

## 1. Executive Summary

Berdasarkan roadmap PHASE-3, R1 terdiri dari 5 item quick wins yang dapat dilakukan dengan arsitektur saat ini tanpa backend. Namun perlu dicatat bahwa semua perbaikan auth/session bersifat **mitigasi client-side saja**, bukan solusi keamanan server-side.

## 2. Detailed Technical Plan per R1 Item

### R1.1: Tambah auth guard ke semua halaman protected
- **ID:** R1.1 | **Priority:** P1 | **Effort:** Low
- **Files Affected:** Semua HTML kecuali login.html (22 files)
- **Related Code:**
  - js/auth.js - Auth.isLoggedIn(), Auth.getSession()
  - login.html:153 - existing check pattern
- **Current State (from code review):**
  - Hanya login.html yang mengecek Auth.isLoggedIn() dan redirect jika sudah login
  - Tidak ada pengecekan di halaman lain - akses langsung dimungkinkan
  - Sidebar menampilkan user info dari session jika ada, tapi tidak memaksa login
- **Root Cause:** Tidak ada auth guard implementation di halaman protected
- **Risk if not fixed:** Akses tidak sah ke seluruh aplikasi (dapat dibypass via localStorage manipulation seperti P0-005)
- **Recommended Technical Solution:**
  - Tambahkan script block di akhir <body> sebelum closing tag atau setelah auth.js/ui.js
  - Check: if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; }
  - Tambahkan di semua halaman protected
  - **JANGAN** menghapus tampilan UI, hanya redirect
- **Impact on other pages/features:** Semua halaman akan redirect ke login jika tidak ada session
- **Regression Risk:** MEDIUM - Jika session hilang/expired tidak sengaja, user akan di-redirect. Perlu pastikan session logic benar
- **Testing Method:**
  1. Clear localStorage, akses index.html -> harus redirect ke login.html
  2. Login normal, akses semua halaman -> harus bisa diakses
  3. Logout, akses halaman -> harus redirect
  4. Manual set session invalid -> redirect
- **Success Criteria:** Setiap halaman protected redirect ke login jika tidak ada session valid
- **Note:** **MITIGASI SAJA** - bisa dibypass dengan disable JS atau localStorage manipulation

### R1.2: Standarisasi role checking
- **ID:** R1.2 | **Priority:** P1 | **Effort:** Low
- **Files Affected:** HTML files yang menggunakan Auth + JS files dengan role logic
- **Related Code:** js/auth.js:184-197 (hasRole, requireRole)
- **Current State:**
  - Auth.hasRole() dan requireRole() sudah ada
  - Beberapa halaman menggunakan Auth., beberapa mungkin tidak konsisten
  - Perlu audit penggunaan
- **Root Cause:** Tidak ada standar penggunaan
- **Risk if not fixed:** Role check tidak konsisten, kesulitan maintenance
- **Recommended Technical Solution:**
  - Standardisasi penggunaan Auth.hasRole() 
  - Pastikan konsisten di semua tempat yang perlu
  - Dokumentasikan penggunaan
- **Impact:** Minimal, hanya standardisasi
- **Regression Risk:** LOW
- **Testing Method:** Cek role-based UI per role
- **Success Criteria:** Penggunaan role check konsisten
- **Note:** Tetap client-side, bisa dibypass

### R1.3: Perbaiki XSS - ganti innerHTML berisiko
- **ID:** R1.3 | **Priority:** P1 | **Effort:** Medium
- **Files Affected:** js/dashboard.js, js/planning-classification.js, js/report-center.js, dan lainnya (39 occurrences total)
- **Related Code:** Lihat audit - banyak innerHTML untuk render data
- **Current State:** 39 occurrences teridentifikasi
- **Root Cause:** Penggunaan innerHTML untuk dynamic content
- **Risk if not fixed:** Potensi XSS jika ada data tidak terpercaya
- **Recommended Technical Solution:**
  - Prioritaskan yang render data dari form/user atau localStorage yang bisa dimanipulasi
  - Ganti dengan 	extContent, createElement, ppendChild
  - Untuk HTML yang memang perlu, pastikan data disanitasi atau dari sumber terpercaya
  - **Fokus pada quick wins** - tidak perlu fix semua 39 sekaligus jika berisiko
- **Impact:** Dapat mempengaruhi rendering UI
- **Regression Risk:** MEDIUM - Perlu hati-hati agar tampilan tetap sama
- **Testing Method:**
  1. Test rendering tabel, card, dropdown
  2. Pastikan tidak ada broken layout
  3. Test dengan data normal
- **Success Criteria:** innerHTML berisiko diganti dengan metode aman
- **Note:** Beberapa innerHTML mungkin aman (static HTML) - perlu evaluasi case by case

### R1.4: Hapus/default kredensial - pertimbangkan hapus auto-init atau warning
- **ID:** R1.4 | **Priority:** P1 | **Effort:** Low
- **Files Affected:** js/auth.js:73-140
- **Related Code:** Auth.initDefaultUser()
- **Current State:** Default users auto-created dengan kredensial hardcoded
- **Root Cause:** Kemudahan development
- **Risk if not fixed:** Kredensial default diketahui publik
- **Recommended Technical Solution:**
  - **OPSIONAL dan HATI-HATI**: Bisa hapus auto-init default users
  - ATAU tambahkan warning
  - **TIDAK BOLEH** mengubah password existing user
  - **TIDAK BOLEH** menghapus user yang sudah ada di localStorage
  - Pertimbangkan: hanya buat default jika ht_users benar-benar kosong DAN tidak ada data lain
- **Impact:** User baru tanpa data akan tidak bisa login jika dihapus
- **Regression Risk:** MEDIUM-HIGH - Bisa lock out jika salah implementasi
- **Testing Method:**
  1. Test dengan localStorage bersih
  2. Test dengan ht_users sudah ada
  3. Pastikan existing users tetap bisa login
- **Success Criteria:** Mengurangi exposur kredensial tanpa lock out existing
- **Note:** **SANGAT HATI-HATI** - Ini sensitif

### R1.5: Tambah validasi input dasar
- **ID:** R1.5 | **Priority:** P1 | **Effort:** Low
- **Files Affected:** Form pages (customer.html, part.html, incoming.html, dll)
- **Related Code:** Form handlers di masing-masing page JS
- **Current State:** Validasi mungkin ada sebagian, perlu dicek
- **Root Cause:** Kurang validasi konsisten
- **Risk if not fixed:** Data tidak valid masuk localStorage
- **Recommended Technical Solution:**
  - Tambah required validation
  - Tambah tipe validasi (number, etc)
  - Tambah basic format validation
  - **JANGAN** mengubah business logic
  - Fokus pada prevent invalid data
- **Impact:** Bisa menolak input yang sebelumnya diterima (tapi invalid)
- **Regression Risk:** LOW-MEDIUM
- **Testing Method:** Test form submission dengan valid/invalid data
- **Success Criteria:** Validasi mencegah data tidak valid masuk
- **Note:** Harus kompatibel dengan data existing


## 3. Urutan Implementasi Berdasarkan Dependensi

`
R1.1 (Auth Guards) 
  ↓
R1.2 (Role Standardization) - bisa paralel setelah R1.1
  ↓
R1.4 (Default Credentials) - HATI-HATI, bisa setelah auth stable
  ↓
R1.3 (XSS fixes) - bisa paralel
  ↓
R1.5 (Input Validation) - bisa paralel
`

**Rekomendasi Urutan:** R1.1 → R1.2 → R1.4 (dengan extra caution) → R1.3, R1.5 secara paralel jika memungkinkan

## 4. Daftar File yang Akan Terdampak

| Item | Files |
|---|---|
| R1.1 | 22 HTML files (semua kecuali login.html) |
| R1.2 | HTML files dengan role checks + js/auth.js (review) |
| R1.3 | js/dashboard.js, js/planning-classification.js, js/report-center.js + lainnya |
| R1.4 | js/auth.js |
| R1.5 | customer.html, part.html, incoming.html, planning-produksi.html, dll dengan form |

## 5. Risiko Terhadap Fitur yang Sudah Berjalan

| Item | Risiko | Mitigasi |
|---|---|---|
| R1.1 | User tanpa session ter-redirect (expected) tapi bisa ganggu jika ada flow khusus | Test semua alur |
| R1.2 | Role check salah bisa hide/show fitur salah | Test per role |
| R1.3 | Layout broken jika salah ganti innerHTML | Test rendering semua halaman |
| R1.4 | **LOCK OUT** jika salah hapus default users | **CRITICAL** - Backup localStorage, test dengan bersih dan dengan data ada |
| R1.5 | Form tidak bisa submit jika validasi terlalu ketat | Sesuai kebutuhan minimal, jangan over-validate |

## 6. Skenario Pengujian

### Smoke Tests
- [ ] Login page berfungsi
- [ ] Dashboard load normal
- [ ] Semua menu navigasi berfungsi
- [ ] Logout berfungsi

### Auth Tests
- [ ] Tanpa session -> redirect ke login (R1.1)
- [ ] Dengan session -> bisa akses (R1.1)
- [ ] Role check konsisten (R1.2)
- [ ] Logout clear session

### Security Tests (Client-side)
- [ ] Coba akses langsung tanpa login -> redirect
- [ ] Manipulasi session di console -> behavior sesuai (catat hasil)
- [ ] XSS test sederhana pada form (jika memungkinkan)

### Data Integrity Tests
- [ ] Existing data tetap ada
- [ ] CRUD operations berfungsi
- [ ] LocalStorage keys tidak berubah
- [ ] Tidak ada data loss

## 7. Residual Security Risks (Tidak Bisa Diperbaiki di R1)

| Risk | Status | Explanation |
|---|---|---|
| LocalStorage manipulation | **RESIDUAL - HIGH** | User bisa edit ht_session, ht_users, semua data via DevTools |
| Role escalation | **RESIDUAL - HIGH** | Set session role ke Administrator |
| Client-side auth bypass | **RESIDUAL - HIGH** | Disable JS atau manipulasi localStorage |
| Plaintext passwords | **RESIDUAL - HIGH** | Tetap di ht_users localStorage |
| No server validation | **RESIDUAL - HIGH** | Semua operasi bisa dimanipulasi |
| No audit log terpercaya | **RESIDUAL - HIGH** | Bisa dimanipulasi |
| Data tampering | **RESIDUAL - HIGH** | Semua data bisa diedit |

**Kesimpulan:** R1 hanya menambah lapisan mitigasi. **Keamanan fundamental tetap lemah tanpa backend**.

## 8. Ditunda ke R2 atau R3

| Item | Ditunda ke | Alasan |
|---|---|---|
| Backup/Restore mechanism | R2 | Lebih kompleks, perlu UI terpisah |
| Data validation schema | R2 | Perlu perencanaan struktur lebih detail |
| Safe update (merge) | R2 | Perlu analisis db.js mendalam |
| Duplicate prevention | R2 | Perlu mapping field unik per tabel |
| Error handling komprehensif | R2 | Perlu review semua fungsi |
| Self-host CDN | R3 | Kurang prioritas dibanding auth/data integrity |
| Dead code cleanup | R3 | Perlu verifikasi menyeluruh |

## 9. Rekomendasi Final

**SIAP UNTUK REVIEW:** Dokumen ini berisi perencanaan teknis lengkap untuk R1. 

**Peringatan Kritis:**
- R1.4 (default credentials) memerlukan kehati-hatian ekstra - jangan menghapus user existing
- R1.1 hanya mitigasi - jangan claim aman
- Semua perubahan harus kompatibel dengan data existing
- Jangan implementasi sampai disetujui

**Status:** Menunggu persetujuan untuk melanjutkan ke implementasi.

# PHASE 4 REVISION — R1 TECHNICAL PLAN (UPDATED)

**Date:** 2026-11-01 14:03:54  
**Status:** PLANNING ONLY - NO IMPLEMENTATION  
**Revision:** Based on review feedback  
**Scope:** R1 Quick Wins - Revised

---

## 1. R1.1 — AUTH GUARDS (REVISED)

### Current Auth Implementation Analysis (js/auth.js)
- getSession(): const s = localStorage.getItem(this.sessionKey); return s ? JSON.parse(s) : null; 
  - **Issue:** JSON.parse tanpa try-catch - bisa throw error jika data corrupt
- isLoggedIn(): eturn !!this.getSession(); - bergantung pada getSession
- Session structure: { username, name, role } (dari login)
- Tidak ada validasi field username/role
- Tidak ada expiry

### Recommended Safe Auth Guard Pattern
`javascript
(function() {
  try {
    const raw = localStorage.getItem('ht_session');
    if (!raw) {
      if (window.location.pathname.split('/').pop() !== 'login.html') {
        window.location.href = 'login.html';
      }
      return;
    }
    const session = JSON.parse(raw);
    if (!session || !session.username || !session.role) {
      localStorage.removeItem('ht_session');
      if (window.location.pathname.split('/').pop() !== 'login.html') {
        window.location.href = 'login.html';
      }
      return;
    }
    // valid session
  } catch(e) {
    localStorage.removeItem('ht_session');
    if (window.location.pathname.split('/').pop() !== 'login.html') {
      window.location.href = 'login.html';
    }
  }
})();
`

### Protected Pages List (18 pages, excluding login.html)
Dari audit: semua HTML kecuali login.html memerlukan perlindungan

List: anti-rust.html, customer.html, delivery.html, heat-treatment.html, incoming.html, index.html (dashboard), inspection-report.html, leader-qc.html, out_snapshot.html, part.html, planning-produksi.html, proses.html, produksi-akhir.html, produksi-masuk.html, qc.html, shotblast.html, supervisor-qc.html, tracking.html

**Note:** inspection-report.html masih ada file-nya meski menu dihapus per AGENTS.md

### Requirements
- Validasi struktur session
- Handle JSON.parse errors
- Validasi username dan role ada
- Handle session tidak valid
- Konsisten redirect ke login.html
- **CEGAH redirect loop** - cek nama file saat ini
- Kompatibel semua halaman
- **HANYA MITIGASI CLIENT-SIDE** - tidak menggantikan server auth


## 2. R1.2 — ROLE STANDARDIZATION & ACCESS MATRIX

### Roles (dari auth.js)
1. Administrator
2. Inspector QC
3. Leader QC
4. Supervisor QC
5. Operator Shotblast
6. Operator Anti Rust
7. Operator Delivery

### Access Matrix (Based on navigation observation)
| Halaman | Administrator | Inspector QC | Leader QC | Supervisor QC | Operator Shotblast | Operator Anti Rust | Operator Delivery | Notes |
|---|---|---|---|---|---|---|---|---|
| index.html (Dashboard) | ✓ | ? | ? | ? | ? | ? | ? | Perlu verifikasi |
| customer.html | ✓ | ? | ? | ? | ? | ? | ? | Master Data |
| part.html | ✓ | ? | ? | ? | ? | ? | ? | Master Data |
| incoming.html | ✓ | ? | ? | ? | ? | ? | ? | PPIC |
| planning-produksi.html | ✓ | ? | ? | ? | ? | ? | ? | PPIC |
| delivery.html | ✓ | ? | ? | ? | ? | ? | ? | PPIC/Delivery |
| heat-treatment.html | ✓ | ? | ? | ? | ? | ? | ? | Production |
| proses.html | ✓ | ? | ? | ? | ? | ? | ? | Production |
| produksi-masuk.html | ✓ | ? | ? | ? | ? | ? | ? | Production |
| produksi-akhir.html | ✓ | ? | ? | ? | ? | ? | ? | Production |
| shotblast.html | ✓ | ? | ? | ? | ✓ (likely) | ? | ? | Operator specific |
| anti-rust.html | ✓ | ? | ? | ? | ? | ✓ (likely) | ? | Operator specific |
| qc.html | ✓ | ✓ (likely) | ? | ? | ? | ? | ? | QC |
| leader-qc.html | ✓ | ? | ✓ (likely) | ? | ? | ? | ? | QC |
| supervisor-qc.html | ✓ | ? | ? | ✓ (likely) | ? | ? | ? | QC |
| inspection-report.html | ✓ | ? | ? | ? | ? | ? | ? | Menu removed per AGENTS.md |
| tracking.html | ✓ | ? | ? | ? | ? | ? | ? | Tracking |

**STATUS:** Matriks ini **BELUM TERVERIFIKASI PENUH** - perlu dicek implementasi role check di setiap halaman. Jangan mengubah hak akses berdasarkan asumsi.

### Findings Needed:
- [ ] Cari Auth.hasRole/requireRole usage per halaman
- [ ] Identifikasi role checks yang sudah ada
- [ ] Identifikasi yang belum konsisten
- [ ] Cek konflik dengan navigasi
- [ ] **JANGAN UBAH HAK AKSES** - hanya standardisasi cara pengecekan


## 3. R1.3 — XSS FIXES (INVENTARISASI 39 INNERHTML)

Lihat file udit/innerhtml_inventory.txt untuk detail lengkap.

**Kategorisasi Awal (Perlu Verifikasi Per Kasus):**

### File dengan innerHTML terbanyak
- js/dashboard.js - banyak (perlu review)
- js/planning-classification.js
- js/report-center.js

**Kriteria Kategorisasi:**
- **AMAN**: Hanya HTML statis/hardcoded tanpa variabel user
- **PERLU PEMERIKSAAN**: Campuran static + dynamic
- **BERISIKO**: Memasukkan data dari LocalStorage/form/user yang bisa dimanipulasi

**Pendekatan:**
1. Baca setiap baris di inventory
2. Lihat konteks kode sekitar
3. Tentukan sumber data
4. Kategorikan risiko
5. Rekomendasikan perbaikan HANYA untuk yang berisiko
6. **JANGAN** ganti semua otomatis
7. Pertahankan tampilan dan struktur

**Status:** Inventarisasi ada di udit/innerhtml_inventory.txt (39 entries). Perlu analisis lebih detail per kasus - **BELUM SELESAI** untuk kategorisasi lengkap.


## 4. R1.4 — DEFAULT CREDENTIALS (DEFERRED)

**STATUS: DEFERRED - TIDAK AKAN DIIMPLEMENTASIKAN DI R1**

### Alasan Penundaan:
- Sangat sensitif terhadap akses aplikasi
- Bisa menyebabkan lock-out jika salah implementasi
- Perlu desain solusi onboarding yang tepat
- Butuh analisis dampak terhadap user yang sudah ada

### Yang TIDAK Akan Dilakukan:
- Menghapus akun default
- Menghapus Auth.initDefaultUser()
- Mengubah password
- Menghapus akun yang sudah tersimpan di ht_users
- Mengubah isi ht_users
- Mengubah mekanisme login

### Yang Akan Didokumentasikan:
- Risiko kredensial bawaan (admin/admin123, dll) sebagai residual risk
- Rekomendasi untuk merancang sistem onboarding akun di fase lanjutan
- Perlu backend untuk manajemen user yang aman

**Residual Risk:** B-004 tetap terbuka - kredensial default dan plaintext password di localStorage


## 5. R1.5 — INPUT VALIDATION (INVENTARISASI FORM)

Berdasarkan halaman yang ada, perlu inventarisasi form:

| Halaman | Form Utama | Fields Kunci | Jenis | Wajib? | Validasi Diperlukan | Catatan Bisnis |
|---|---|---|---|---|---|---|
| customer.html | Customer Form | kode_customer, nama_customer, alamat, pic, phone, email | text/email | Perlu cek | Unik kode_customer? | Master Data |
| part.html | Part Form | nomor_part, nama_part, customer_id, berat_part, process_type | text/number/select | Perlu cek | Relasi customer | Master Data |
| incoming.html | Incoming Form | customer_id, part_id, nomor_surat_jalan, qty, tanggal_masuk | select/text/number/date | Perlu cek | **Incoming Part** - critical flow | PPIC |
| planning-produksi.html | Planning Form | material selection, qty, process | various | Perlu cek | **Planning Production** | PPIC |
| heat-treatment.html | Process Form | temperature, operator, machine, waktu | number/text | Perlu cek | **Heat Treatment** - suhu kritis | Production |
| qc.html/leader-qc.html/supervisor-qc.html | QC Form | hardness, hasil, judgement | number/select | Perlu cek | **QC Hardness** - approval chain | QC |
| shotblast.html | Shotblast Form | operator, waktu | text | Perlu cek | **Shotblast** | Production |
| anti-rust.html | Anti Rust Form | operator, waktu | text | Perlu cek | **Anti Rust** | Production |
| delivery.html | Delivery Form | customer, qty_kirim, tanggal_kirim | select/number/date | Perlu cek | **Delivery** | PPIC |
| tracking.html | View only? | - | - | - | - | Tracking |

**STATUS:** Inventarisasi awal. Perlu baca source code HTML/JS per halaman untuk detail field. **BELUM LENGKAP**.

**Prinsip:** Jangan mengubah business logic, jangan menolak data historis yang masih valid.


## 6. Revisi Dependensi Implementasi

Urutan baru berdasarkan review:

1. **R1.1** - Auth Guards (foundation) - **PRIORITAS TERTINGGI**
2. **R1.2** - Role Standardization (bergantung pada pemahaman role, bisa setelah R1.1)
3. **R1.3** - XSS Fixes (independen, bisa paralel setelah review inventarisasi lengkap)
4. **R1.5** - Input Validation (independen, perlu hati-hati jangan break business flow)
5. **R1.4** - **DEFERRED** ke fase lanjutan

## 7. Daftar Risiko Regresi (Updated)

| Item | Risiko | Severity | Mitigasi |
|---|---|---|---|
| R1.1 | Redirect loop | HIGH | Cek filename, test di semua halaman |
| R1.1 | User terkunci keluar | HIGH | Pastikan login page tidak kena guard, test flow login/logout |
| R1.1 | Session corrupt | MEDIUM | Handle JSON parse error dengan aman |
| R1.2 | Role salah bisa hide fitur penting | HIGH | **JANGAN UBAH HAK AKSES** - hanya standardisasi cara cek |
| R1.3 | UI broken | MEDIUM-HIGH | Test rendering, backup approach, ganti bertahap |
| R1.5 | Validasi terlalu ketat block data valid | HIGH | Test dengan data existing, jangan block historical data |
| R1.5 | Break business flow | HIGH | Fokus incoming/planning/HT/QC/delivery dengan sangat hati-hati |

## 8. Skenario Pengujian Terukur

### Pre-Implementation
- [ ] Backup localStorage (manual - user bisa export)
- [ ] Catat current state
- [ ] Test semua halaman saat ini

### Post R1.1
- [ ] Incognito: akses index.html -> redirect login
- [ ] Login valid -> akses semua halaman OK
- [ ] Logout -> akses halaman redirect
- [ ] Session dihapus manual -> redirect
- [ ] Session corrupt (invalid JSON) -> redirect aman, no crash

### Post R1.2
- [ ] Test per role navigasi
- [ ] Verifikasi role checks konsisten
- [ ] Tidak ada perubahan hak akses

### Post R1.3
- [ ] Visual check semua halaman dengan innerHTML
- [ ] Dashboard charts/tables render OK
- [ ] No console errors
- [ ] Tidak ada layout shift

### Post R1.5
- [ ] Test form valid/invalid
- [ ] Data existing tetap bisa diproses
- [ ] Tidak block alur bisnis kritis

## 9. Residual Risks (Updated)

| Risk ID | Risk | Status | Notes |
|---|---|---|---|
| RR-001 | Client auth bypass | RESIDUAL HIGH | Hanya mitigasi UI |
| RR-002 | LocalStorage manipulation | RESIDUAL HIGH | Tidak bisa dicegah |
| RR-003 | Role escalation | RESIDUAL HIGH | Via localStorage edit |
| RR-004 | Plaintext passwords | RESIDUAL HIGH | Tetap ada |
| RR-005 | No server validation | RESIDUAL HIGH | Semua bisa dimanipulasi |
| RR-006 | Default credentials exposed | RESIDUAL HIGH | R1.4 deferred |
| RR-007 | No trusted audit log | RESIDUAL HIGH | localStorage bisa dihapus/edit |

## 10. Kesimpulan & Rekomendasi

**Perubahan dari versi sebelumnya:**
- R1.1 diperkuat dengan validasi session structure, JSON parse handling, prevent redirect loop
- R1.2 ditambahkan matriks akses role (belum lengkap - perlu verifikasi)
- R1.3 diperjelas: inventarisasi ada, kategorisasi perlu detail, jangan ganti semua
- R1.4 **DEFERRED** sepenuhnya
- R1.5 ditambahkan inventarisasi form awal
- Fokus pada kompatibilitas data existing

**Yang masih perlu diverifikasi:**
- Matriks akses role per halaman (perlu baca JS files)
- Kategorisasi lengkap 39 innerHTML
- Detail form fields per halaman
- Role checks yang sudah ada vs belum

**Status:** Plan direvisi, menunggu persetujuan. Tidak ada implementasi dilakukan.

# PHASE 4 FINAL VERIFICATION REPORT

**Date:** 2026-11-01 14:10:53  
**Status:** AUDIT & PLANNING ONLY - NO IMPLEMENTATION  
**Scope:** Complete verification before R1 implementation

---

## A. VERIFIKASI HALAMAN PROTECTED

### Inventarisasi HTML Files (19 files)
1. anti-rust.html
2. customer.html
3. delivery.html
4. heat-treatment.html
5. incoming.html
6. index.html
7. inspection-report.html
8. leader-qc.html
9. login.html
10. out_snapshot.html
11. part.html
12. planning-produksi.html
13. produksi-akhir.html
14. produksi-masuk.html
15. proses.html
16. qc.html
17. shotblast.html
18. supervisor-qc.html
19. tracking.html

### Kategorisasi Halaman
| Halaman | Kategori | Perlu Auth Guard? | Alasan |
|---|---|---|---|
| login.html | Login/Auth | **TIDAK** | Halaman publik untuk login. Sudah ada logic redirect jika sudah login |
| index.html | Dashboard | **YA** | Halaman utama aplikasi, mengakses data produksi |
| customer.html | Master Data | **YA** | Akses data master |
| part.html | Master Data | **YA** | Akses data master |
| incoming.html | PPIC | **YA** | Proses bisnis kritis |
| planning-produksi.html | PPIC | **YA** | Proses bisnis kritis |
| delivery.html | PPIC | **YA** | Proses bisnis kritis |
| heat-treatment.html | Production | **YA** | Proses produksi |
| proses.html | Production | **YA** | Proses produksi |
| produksi-masuk.html | Production | **YA** | Proses produksi |
| produksi-akhir.html | Production | **YA** | Proses produksi |
| shotblast.html | Production | **YA** | Proses produksi |
| anti-rust.html | Production | **YA** | Proses produksi |
| qc.html | QC | **YA** | Quality Control |
| leader-qc.html | QC | **YA** | Quality Control - memiliki role check |
| supervisor-qc.html | QC | **YA** | Quality Control - memiliki role check |
| inspection-report.html | Report | **YA** | Ada role check untuk Administrator, file masih ada meski menu dihapus |
| tracking.html | Tracking | **YA** | Akses tracking data |
| out_snapshot.html | Snapshot/Print | **TIDAK (KONDISIONAL)** | Halaman print/snapshot, biasanya dibuka untuk cetak. **TIDAK dimasukkan otomatis**. Perlu evaluasi lebih lanjut - bisa dibuka tanpa session untuk keperluan print? |

**Kesimpulan A:** 17 halaman memerlukan auth guard, login.html dikecualikan, out_snapshot.html TIDAK dimasukkan otomatis (perlu verifikasi penggunaan).


## B. ROLE ACCESS MATRIX (BASED ON ACTUAL CODE)

### Role Checks Found
| File | Line | Check | Roles |
|---|---|---|---|
| inspection-report.html | 423 | Auth.hasRole() | ADMINISTRATOR only |
| leader-qc.html | 365 | Auth.hasRole() | [LEADER_QC, ADMINISTRATOR] |
| supervisor-qc.html | 383 | Auth.hasRole() | [SUPERVISOR_QC, ADMINISTRATOR] |

**STATUS:** Hanya 3 halaman yang memiliki role check eksplisit. Sebagian besar halaman TIDAK memiliki role check.

### Access Matrix (VERIFIED vs UNVERIFIED)
| Halaman | Admin | Inspector QC | Leader QC | Supervisor QC | Op. Shotblast | Op. Anti Rust | Op. Delivery | Status |
|---|---|---|---|---|---|---|---|---|
| index.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| customer.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| part.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| incoming.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| planning-produksi.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| delivery.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| heat-treatment.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| proses.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| produksi-masuk.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| produksi-akhir.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| shotblast.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| anti-rust.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| qc.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |
| leader-qc.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | TERBUKTI (has role check) | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Ada role check |
| supervisor-qc.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | TERBUKTI (has role check) | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Ada role check |
| inspection-report.html | TERBUKTI (has role check) | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Ada role check |
| tracking.html | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | BELUM TERVERIFIKASI | Perlu cek |

**KESIMPULAN:** Hanya 3 halaman memiliki role check. **TIDAK AKAN DIUBAH** - R1.2 hanya standardisasi penggunaan Auth.hasRole() jika sudah ada, tanpa mengubah hak akses.


## C. XSS INVENTORY - 39 INNERHTML USAGE

File udit/innerhtml_inventory.txt berisi 39 entries. Kategorisasi perlu dilakukan per kasus.

### Kategorisasi Awal Berdasarkan File
| File | Count | Keterangan |
|---|---|---|
| dashboard.js | Banyak | Perlu review mendalam |
| planning-classification.js | Beberapa | Perlu review |
| report-center.js | Beberapa | Tidak dimuat by production pages per AGENTS.md tapi masih ada |
| Lainnya | Beberapa | Perlu review |

**Pendekatan Kategorisasi:**
- **AMAN**: Hanya string HTML statis tanpa variabel
- **PERLU PEMERIKSAAN**: Menggabungkan string + variabel, perlu cek sumber
- **BERISIKO**: Menggunakan data dari localStorage/form/user input

**Rekomendasi:** Untuk R1, fokus hanya pada yang **BERISIKO** dan mudah diperbaiki tanpa mengubah struktur besar. Jangan ganti semua 39. Detail lengkap ada di udit/innerhtml_inventory.txt.


## D. FORM INVENTORY - INITIAL

| Halaman | File Terkait | Status |
|---|---|---|
| customer.html | Perlu cek JS | BELUM TERVERIFIKASI |
| part.html | Perlu cek JS | BELUM TERVERIFIKASI |
| incoming.html | Perlu cek JS | BELUM TERVERIFIKASI |
| planning-produksi.html | Perlu cek JS | BELUM TERVERIFIKASI |
| heat-treatment.html | Perlu cek JS | BELUM TERVERIFIKASI |
| qc.html | Perlu cek JS | BELUM TERVERIFIKASI |
| leader-qc.html | Perlu cek JS | BELUM TERVERIFIKASI |
| supervisor-qc.html | Perlu cek JS | BELUM TERVERIFIKASI |
| shotblast.html | Perlu cek JS | BELUM TERVERIFIKASI |
| anti-rust.html | Perlu cek JS | BELUM TERVERIFIKASI |
| delivery.html | Perlu cek JS | BELUM TERVERIFIKASI |

**STATUS:** Inventarisasi detail form memerlukan pembacaan HTML dan JS per halaman - **BELUM LENGKAP** untuk R1 planning detail. Akan diperluas saat implementasi dengan tetap menjaga kompatibilitas data existing.

## E. FINAL SUMMARY - PHASE 4 VERIFICATION

### Sudah Terverifikasi
- ✅ Daftar file HTML (19 files)
- ✅ Klasifikasi halaman protected vs public (17 protected, login excluded, out_snapshot tidak otomatis)
- ✅ Role checks yang ada (3 halaman)
- ✅ Inventarisasi 39 innerHTML (ada di file)
- ✅ Auth.js implementation
- ✅ R1.4 = DEFERRED
- ✅ Data LocalStorage tetap dipertahankan
- ✅ Arsitektur tetap sama

### Belum Dapat Dibuktikan
- ⚠️ Matriks akses role lengkap per halaman (hanya 3 yang punya role check)
- ⚠️ Kategorisasi detail 39 innerHTML
- ⚠️ Inventarisasi form field lengkap per halaman
- ⚠️ Apakah ada role check lain selain 3 halaman
- ⚠️ Penggunaan Auth.hasRole di JS files (perlu grep lebih detail)

### Rekomendasi
1. Untuk R1.1: Terapkan auth guard ke 17 halaman (kecuali login.html) dengan validasi session ketat + JSON parse handling + prevent redirect loop
2. Untuk R1.2: Hanya standardisasi jika sudah ada pola, **TIDAK mengubah hak akses**
3. Untuk R1.3: Mulai dari yang paling berisiko setelah kategorisasi lebih detail
4. Untuk R1.4: Tetap DEFERRED
5. Untuk R1.5: Validasi minimal tanpa mengubah business logic

**TUNGGU PERSETUJUAN** sebelum mulai implementasi R1.

# R1.1 IMPLEMENTATION READINESS

**Date:** 2026-11-01 14:15:54  
**Status:** PLANNING ONLY - NO IMPLEMENTATION  
**Scope:** ONLY R1.1 - Auth Guards for 17 protected pages

---

## Daftar 17 Halaman Target

Berdasarkan final verification:

1. anti-rust.html
2. customer.html
3. delivery.html
4. heat-treatment.html
5. incoming.html
6. index.html
7. inspection-report.html
8. leader-qc.html
9. part.html
10. planning-produksi.html
11. proses.html
12. produksi-akhir.html
13. produksi-masuk.html
14. qc.html
15. shotblast.html
16. supervisor-qc.html
17. tracking.html

**Excluded:**
- login.html - tidak diberi auth guard (halaman publik)
- out_snapshot.html - tidak otomatis diberi auth guard (halaman print/snapshot, perlu evaluasi terpisah)

---

## Pola Auth Guard Final

### Requirements
- Menangani session kosong
- Menangani JSON.parse error (try-catch)
- Memeriksa struktur session (harus ada username dan role)
- Memeriksa role terhadap daftar role resmi dari Auth.ROLES
- Tidak menyebabkan redirect loop
- Hanya menghapus session yang terbukti rusak/tidak valid
- Tidak menghapus ht_users
- Tidak mengganggu proses login/logout
- Tidak mengubah data lain
- Penempatan script harus sebelum aplikasi berjalan

### Safe Implementation Pattern

`javascript
<script>
  (function() {
    try {
      const sessionKey = 'ht_session';
      const raw = localStorage.getItem(sessionKey);
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      
      // Jangan guard halaman login
      if (currentPage === 'login.html') return;
      
      if (!raw) {
        window.location.replace('login.html');
        return;
      }
      
      let session;
      try {
        session = JSON.parse(raw);
      } catch (e) {
        // Session corrupt - hapus hanya session ini
        localStorage.removeItem(sessionKey);
        window.location.replace('login.html');
        return;
      }
      
      // Validasi struktur
      if (!session || typeof session !== 'object') {
        localStorage.removeItem(sessionKey);
        window.location.replace('login.html');
        return;
      }
      
      if (!session.username || !session.role) {
        localStorage.removeItem(sessionKey);
        window.location.replace('login.html');
        return;
      }
      
      // Validasi role terhadap daftar resmi
      const validRoles = [
        'Administrator',
        'Inspector QC',
        'Leader QC',
        'Supervisor QC',
        'Operator Shotblast',
        'Operator Anti Rust',
        'Operator Delivery'
      ];
      
      if (validRoles.indexOf(session.role) === -1) {
        localStorage.removeItem(sessionKey);
        window.location.replace('login.html');
        return;
      }
      
      // Session valid - lanjut
    } catch (e) {
      // Fallback aman - redirect ke login jika ada masalah
      window.location.replace('login.html');
    }
  })();
</script>
`

**Notes:**
- Gunakan window.location.replace() untuk mencegah back button issue
- Hanya hapus ht_session jika terbukti tidak valid
- Jangan sentuh ht_users
- Path relatif login.html cocok untuk GitHub Pages
- Script inline di body atau head - harus eksekusi sebelum main content berproses

---

## File yang Akan Diubah
Hanya 17 HTML files di atas. Tidak ada file JS, CSS, atau lainnya.

---

## Risiko Regresi
| Risiko | Severity | Mitigasi |
|---|---|---|
| Redirect loop | HIGH | Cek currentPage !== 'login.html', test semua halaman |
| Lock out user valid | HIGH | Validasi struktur benar, test dengan session normal |
| Session corrupt handling | MEDIUM | Hanya hapus ht_session, jangan ht_users |
| Ganggu login flow | HIGH | login.html tidak di-guard |
| Script timing issue | MEDIUM | Pasang sebelum DOM ready heavy processing |
| GitHub Pages path issue | LOW | Gunakan relative path 'login.html' |

---

## Skenario Pengujian
### Pre-Implementation
- [ ] Backup localStorage state (catat)
- [ ] Test login/logout saat ini berfungsi
- [ ] Test akses semua halaman dengan session ada

### Post-Implementation
- [ ] **Tanpa session:** Akses index.html -> redirect ke login.html
- [ ] **Tanpa session:** Akses semua 17 halaman -> redirect ke login.html
- [ ] **login.html tanpa session:** Tetap bisa diakses
- [ ] **login.html dengan session valid:** Sudah ada logic redirect ke index.html (harus tetap berfungsi)
- [ ] **Session valid:** Bisa akses semua 17 halaman normal
- [ ] **Logout:** Tetap berfungsi, redirect ke login
- [ ] **Session corrupt (invalid JSON):** Hapus ht_session, redirect ke login, ht_users tetap ada
- [ ] **Session tanpa role/username:** Redirect ke login, ht_users tetap ada
- [ ] **Session dengan role invalid:** Redirect ke login
- [ ] **out_snapshot.html:** Bisa diakses tanpa guard (tidak dimasukkan)
- [ ] **No redirect loop:** Test semua skenario
- [ ] **Data existing:** Semua data LocalStorage lain tetap utuh

### Rollback Plan
Jika terjadi masalah:
1. Hapus script auth guard yang baru ditambahkan dari halaman bermasalah
2. Atau restore file HTML dari git (jika ada)
3. Pastikan tidak ada perubahan lain
4. Test login kembali

---

## Status
**READY FOR APPROVAL** - Menunggu persetujuan untuk implementasi R1.1 saja.
