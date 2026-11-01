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

