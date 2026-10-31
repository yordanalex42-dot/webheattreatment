/* ============================================================
   Inspection Report — Modul laporan inspeksi untuk Admin
   Memeriksa material via Scan QR Code atau Control Number,
   lalu menampilkan laporan hardness dan judgement QC.
   ============================================================ */

const IR = {
  state: {
    currentMaterial: null,
    currentPart: null,
    currentCustomer: null,
    currentProduction: null,
    afterQc: null,
    beforeQc: null,
    html5QrCode: null,
    isScanning: false,
    cameraAutoStarted: false,
    cameraPermissionDenied: false,
    cameraNotAvailable: false,
  },

  /* ---- Inisialisasi halaman ---- */
  init() {
    this.bindEvents();
    /* Scanner diaktifkan otomatis saat halaman dibuka (Admin only). */
    this.startAutoCamera();
  },

  /* ---- Event binding ---- */
  bindEvents() {
    const self = this;

    const btnScanQR = document.getElementById("btnScanQR");
    if (btnScanQR) btnScanQR.addEventListener("click", function () { self.toggleScanner(); });

    const btnRetryCamera = document.getElementById("btnRetryCamera");
    if (btnRetryCamera) btnRetryCamera.addEventListener("click", function () { self.retryCamera(); });

    const btnSearch = document.getElementById("btnSearch");
    if (btnSearch) btnSearch.addEventListener("click", function () { self.searchMaterial(); });

    const btnClear = document.getElementById("btnClearSearch");
    if (btnClear) btnClear.addEventListener("click", function () { self.resetSearch(); });

    const input = document.getElementById("materialCodeInput");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); self.searchMaterial(); }
      });
    }

    const btnPrint = document.getElementById("btnPrint");
    if (btnPrint) btnPrint.addEventListener("click", function () { self.printReport(); });

    const btnPdf = document.getElementById("btnDownloadPdf");
    if (btnPdf) btnPdf.addEventListener("click", function () { self.downloadPdf(); });

    /* Hentikan kamera saat meninggalkan halaman */
    window.addEventListener("beforeunload", function () { self.stopScanner(); });
    window.addEventListener("pagehide", function () { self.stopScanner(); });

    /* Restart kamera saat halaman kembali aktif jika sebelumnya scanning */
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && self.state.isScanning && !self.state.html5QrCode) {
        self.startScanner();
      }
    });
  },

  /* ---- QR Scanner ---- */
  startAutoCamera() {
    if (this.state.cameraAutoStarted) return;
    this.state.cameraAutoStarted = true;

    const btnScan = document.getElementById("btnScanQR");
    const btnRetry = document.getElementById("btnRetryCamera");
    if (btnScan) btnScan.classList.add("hidden");
    if (btnRetry) btnRetry.classList.add("hidden");

    this.startScanner();
  },

  toggleScanner() {
    if (this.state.isScanning && this.state.html5QrCode) {
      this.stopScanner();
    } else {
      this.state.cameraPermissionDenied = false;
      this.state.cameraNotAvailable = false;
      const errEl = document.getElementById("qrError");
      if (errEl) { errEl.classList.add("hidden"); errEl.textContent = ""; }
      const btnRetry = document.getElementById("btnRetryCamera");
      if (btnRetry) btnRetry.classList.add("hidden");
      this.startScanner();
    }
  },

  startScanner() {
    if (this.state.isScanning) return;
    if (!window.Html5Qrcode) {
      this.state.cameraNotAvailable = true;
      const scannerContainer = document.getElementById("qr-reader");
      if (scannerContainer) {
        scannerContainer.innerHTML = '<div style="width:100%;height:200px;background:#000;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:#888;font-size:13px;">Kamera tidak tersedia di browser ini. Gunakan pencarian manual.</div>';
      }
      const errEl = document.getElementById("qrError");
      if (errEl) { errEl.textContent = "Kamera tidak dapat digunakan di browser ini."; errEl.classList.remove("hidden"); }
      const btnScan = document.getElementById("btnScanQR");
      const btnRetry = document.getElementById("btnRetryCamera");
      if (btnScan) btnScan.classList.remove("hidden");
      if (btnRetry) btnRetry.classList.remove("hidden");
      return;
    }
    this.state.html5QrCode = HTUI.createScanner("qr-reader");
    if (!this.state.html5QrCode) {
      this.state.cameraNotAvailable = true;
      const btnScan = document.getElementById("btnScanQR");
      const btnRetry = document.getElementById("btnRetryCamera");
      if (btnScan) btnScan.classList.remove("hidden");
      if (btnRetry) btnRetry.classList.remove("hidden");
      return;
    }
    const self = this;
    const scanner = this.state.html5QrCode;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        function (decodedText) {
          scanner.stop().then(() => { scanner.clear(); }).catch(() => {});
          if (self.state.isScanning) {
            self.state.isScanning = false;
            self._updateScannerUI();
            const id = HTUI.parseScanId(decodedText);
            if (id) {
              document.getElementById("materialCodeInput").value = id;
              self.searchMaterial();
            }
          }
        },
        function (err) {
          console.warn("[scanner]", err);
        },
      )
      .catch(function (err) {
        console.error("[scanner] start failed:", err);
        self.state.isScanning = false;
        self.state.cameraPermissionDenied = true;
        self.state.html5QrCode = null;
        const errEl = document.getElementById("qrError");
        if (errEl) { errEl.textContent = "Akses kamera ditolak. Izinkan akses kamera untuk memindai QR Code."; errEl.classList.remove("hidden"); }
        const btnScan = document.getElementById("btnScanQR");
        const btnRetry = document.getElementById("btnRetryCamera");
        if (btnScan) btnScan.classList.remove("hidden");
        if (btnRetry) btnRetry.classList.remove("hidden");
      });
    this.state.isScanning = true;
    this.state.cameraPermissionDenied = false;
    this.state.cameraNotAvailable = false;
    this._updateScannerUI();
  },

  retryCamera() {
    this.state.cameraPermissionDenied = false;
    this.state.cameraNotAvailable = false;
    const errEl = document.getElementById("qrError");
    if (errEl) { errEl.classList.add("hidden"); errEl.textContent = ""; }
    const btnRetry = document.getElementById("btnRetryCamera");
    if (btnRetry) btnRetry.classList.add("hidden");
    const btnScan = document.getElementById("btnScanQR");
    if (btnScan) btnScan.classList.add("hidden");
    const scannerContainer = document.getElementById("qr-reader");
    if (scannerContainer) scannerContainer.innerHTML = "";
    this.state.html5QrCode = null;
    this.state.isScanning = false;
    this.startScanner();
  },

  stopScanner() {
    HTUI.stopScanner(this.state.html5QrCode);
    this.state.html5QrCode = null;
    this.state.isScanning = false;
    this._updateScannerUI();
    const scannerContainer = document.getElementById("qr-reader");
    if (scannerContainer) {
      scannerContainer.innerHTML = "";
    }
    const errEl = document.getElementById("qrError");
    if (errEl) { errEl.classList.add("hidden"); errEl.textContent = ""; }
    const btnScan = document.getElementById("btnScanQR");
    const btnRetry = document.getElementById("btnRetryCamera");
    if (btnScan) btnScan.classList.remove("hidden");
    if (btnRetry) btnRetry.classList.add("hidden");
  },

  _updateScannerUI() {
    const scanning = !!this.state.isScanning;
    const btnScan = document.getElementById("btnScanQR");
    const btnRetry = document.getElementById("btnRetryCamera");
    if (btnScan) {
      btnScan.classList.toggle("hidden", scanning);
      btnScan.disabled = scanning;
      btnScan.textContent = scanning ? "Sedang Membuka Kamera..." : "Scan QR Code";
    }
    if (btnRetry) btnRetry.classList.add("hidden");
  },

  /* ---- Pencarian material ---- */
  searchMaterial() {
    const input = document.getElementById("materialCodeInput");
    if (!input) return;
    const kode = String(input.value || "").trim();
    if (!kode) {
      HTUI.toast("Masukkan kode material terlebih dahulu.", "warning");
      return;
    }

    const material = DB.findByKode(kode);
    if (!material) {
      this.showNotFound();
      HTUI.toast("Control Number tidak ditemukan: " + kode, "error");
      return;
    }

    this.loadMaterialData(material);
  },

  loadMaterialData(material) {
    this.state.currentMaterial = material;
    this.state.currentPart = DB.findPartById(material.part_id) || null;
    this.state.currentCustomer = DB.findCustomerById(material.customer_id) || null;
    this.state.currentProduction = DB.getProcessProduction(material, "HT") || null;

    /* Cari QC records (before dan after) */
    this.state.afterQc = this._findQcByStage(material.id, "after");
    this.state.beforeQc = this._findQcByStage(material.id, "before");

    this.hideNotFound();
    this.showReportPanel();
    this.renderPartInfo();
    this.renderHardnessTable();
    this.renderJudgement();
    this.showJudgementNotification();
  },

  _findQcByStage(materialId, stage) {
    const qcs = DB.get("qcs").filter(function (q) {
      return String(q.material_id) === String(materialId);
    });
    let result = null;
    for (let i = 0; i < qcs.length; i++) {
      const q = qcs[i];
      const ext = this._parseRemarks(q);
      const qStage = (ext && ext.stage) || "after";
      if (qStage === stage) {
        if (!result || (q.id || 0) > (result.id || 0)) {
          result = q;
        }
      }
    }
    return result;
  },

  _parseRemarks(qc) {
    if (!qc || !qc.remarks) return null;
    try {
      const parsed = JSON.parse(qc.remarks);
      if (parsed && typeof parsed === "object" && parsed.stage !== undefined) {
        return parsed;
      }
    } catch (e) { /* plain string */ }
    return null;
  },

  /* ---- Render bagian Informasi Part ---- */
  renderPartInfo() {
    const m = this.state.currentMaterial;
    const p = this.state.currentPart;
    const c = this.state.currentCustomer;
    const grid = document.getElementById("partInfoGrid");
    if (!grid) return;

    const rows = [];
    rows.push(this._infoRow("Control Number / Kode Material", m.kode || "-", "mono"));
    rows.push(this._infoRow("Customer", c ? c.nama_customer : "-"));
    rows.push(this._infoRow("Part Name", p ? p.nama_part : "-"));
    rows.push(this._infoRow("Part No.", p ? p.nomor_part : "-", "mono"));
    rows.push(this._infoRow("Lot Number", m.lot_no || "-", "mono"));
    rows.push(this._infoRow("Material Charge", m.material_charge || "-", "mono"));
    rows.push(this._infoRow("Material Grade", p ? (p.nomor_part || "-") : "-"));
    rows.push(this._infoRow("Status Part", m.status_part || "-"));
    rows.push(this._infoRow("Jenis Proses", m.process_type || "-"));
    rows.push(this._infoRow("Target Hardness", p ? p.target_hardness : "-", "mono hardness"));
    rows.push(this._infoRow("QTY", m.qty ? m.qty.toLocaleString("id-ID") + " PCS" : "-"));

    grid.innerHTML = rows.join("");
  },

  _infoRow(label, value, extraClass) {
    const cls = extraClass ? " " + extraClass : "";
    return (
      '<div class="ht-info-item">' +
      '<span class="ht-info-label">' + this._escape(label) + '</span>' +
      '<span class="ht-info-value' + cls + '">' + this._escape(value) + '</span>' +
      '</div>'
    );
  },

  /* ---- Render tabel hardness (preview, konsisten dengan PDF/Print) ---- */
  renderHardnessTable() {
    const wrapper = document.getElementById("hardnessTableWrapper");
    if (!wrapper) return;

    const afterQc = this.state.afterQc;
    const beforeQc = this.state.beforeQc;

    const afterExt = afterQc ? this._parseRemarks(afterQc) : null;
    const beforeExt = beforeQc ? this._parseRemarks(beforeQc) : null;

    const afterSurface = (afterExt && afterExt.surface_values) || [];
    const afterCore = (afterExt && afterExt.core_values) || [];
    const beforeSurface = (beforeExt && beforeExt.surface_values) || [];
    const beforeCore = (beforeExt && beforeExt.core_values) || [];

    const maxPieces = Math.max(
      afterSurface.length, afterCore.length,
      beforeSurface.length, beforeCore.length, 12
    );

    const hasBefore = beforeSurface.length > 0 || beforeCore.length > 0;
    const hasAfter = afterSurface.length > 0 || afterCore.length > 0;

    /* Helper: format nilai sel tabel (null/undefined/kosong/NaN -> "-") */
    function formatCell(val) {
      if (val === undefined || val === null || val === "") return "-";
      const n = Number(val);
      if (isNaN(n)) return "-";
      return val;
    }

    /* Build table rows - test pieces only, no average/range columns */
    let html = '<table class="ht-ir-hardness-table">';
    html += '<thead><tr>';
    html += '<th>Test Piece</th>';
    if (hasBefore) {
      html += '<th>Before<br>Surface</th><th>Before<br>Core</th>';
    }
    if (hasAfter) {
      html += '<th>After<br>Surface</th><th>After<br>Core</th>';
    }
    html += '</tr></thead><tbody>';

    for (let i = 1; i <= maxPieces; i++) {
      html += '<tr>';
      html += '<td>' + i + '</td>';
      if (hasBefore) {
        html += '<td>' + formatCell(beforeSurface[i - 1]) + '</td>';
        html += '<td>' + formatCell(beforeCore[i - 1]) + '</td>';
      }
      if (hasAfter) {
        html += '<td>' + formatCell(afterSurface[i - 1]) + '</td>';
        html += '<td>' + formatCell(afterCore[i - 1]) + '</td>';
      }
      html += '</tr>';
    }

    /* Helper: hitung rata-rata dari array nilai (abaikan null/undefined/kosong/non-angka) */
    function computeColAvg(arr) {
      const valid = arr.filter(function (v) {
        return v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
      });
      if (valid.length === 0) return "-";
      return (valid.reduce(function (a, b) { return Number(a) + Number(b); }, 0) / valid.length).toFixed(2);
    }

    /* Helper: hitung range (max - min) dari array nilai */
    function computeColRange(arr) {
      const valid = arr.filter(function (v) {
        return v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
      });
      if (valid.length === 0) return "-";
      const nums = valid.map(function (v) { return Number(v); });
      return (Math.max.apply(null, nums) - Math.min.apply(null, nums)).toFixed(2);
    }

    const avgBeforeSurface = computeColAvg(beforeSurface);
    const avgBeforeCore = computeColAvg(beforeCore);
    const avgAfterSurface = computeColAvg(afterSurface);
    const avgAfterCore = computeColAvg(afterCore);

    const rangeBeforeSurface = computeColRange(beforeSurface);
    const rangeBeforeCore = computeColRange(beforeCore);
    const rangeAfterSurface = computeColRange(afterSurface);
    const rangeAfterCore = computeColRange(afterCore);

    /* Build summary rows (Average + Range) - konsisten dengan PDF/Print */
    html += '<tr class="ir-summary-row ir-avg-row">';
    html += '<td style="text-align:right;" colspan="1"><strong>AVERAGE</strong></td>';
    if (hasBefore) {
      html += '<td>' + avgBeforeSurface + '</td>';
      html += '<td>' + avgBeforeCore + '</td>';
    }
    if (hasAfter) {
      html += '<td>' + avgAfterSurface + '</td>';
      html += '<td>' + avgAfterCore + '</td>';
    }
    html += '</tr>';

    html += '<tr class="ir-summary-row ir-range-row">';
    html += '<td style="text-align:right;" colspan="1"><strong>RANGE (R)</strong></td>';
    if (hasBefore) {
      html += '<td>' + rangeBeforeSurface + '</td>';
      html += '<td>' + rangeBeforeCore + '</td>';
    }
    if (hasAfter) {
      html += '<td>' + rangeAfterSurface + '</td>';
      html += '<td>' + rangeAfterCore + '</td>';
    }
    html += '</tr>';

    html += '</tbody></table>';
    wrapper.innerHTML = html;
  },

  /* ---- Render judgement (Inspector / Leader / Supervisor) ---- */
  renderJudgement() {
    const grid = document.getElementById("judgementGrid");
    if (!grid) return;

    const afterQc = this.state.afterQc;
    const items = [];

    /* Inspector QC */
    const inspHasil = afterQc ? String(afterQc.hasil || "").toUpperCase() : "";
    items.push({
      title: "Inspector QC",
      name: afterQc ? (afterQc.inspector || "-") : "-",
      date: afterQc ? this._formatDate(afterQc.tanggal_inspector) : "-",
      status: inspHasil === "OK" ? "OK" : (inspHasil === "NG" ? "NG" : "BELUM DI-JUDGEMENT"),
      statusClass: inspHasil === "OK" ? "ht-ir-judgement-status-ok" : (inspHasil === "NG" ? "ht-ir-judgement-status-ng" : "ht-ir-judgement-status-pending"),
      signature: afterQc ? this._parseSignature(afterQc) : null,
    });

    /* Leader QC */
    const leaderJudgement = afterQc ? (afterQc.leader_judgement || null) : null;
    items.push({
      title: "Leader QC",
      name: afterQc ? (afterQc.leader_name || "-") : "-",
      date: afterQc ? this._formatDate(afterQc.leader_date) : "-",
      status: leaderJudgement === "OK" ? "OK" : (leaderJudgement === "NG" ? "NG" : "BELUM DI-JUDGEMENT"),
      statusClass: leaderJudgement === "OK" ? "ht-ir-judgement-status-ok" : (leaderJudgement === "NG" ? "ht-ir-judgement-status-ng" : "ht-ir-judgement-status-pending"),
      signature: afterQc ? afterQc.leader_signature : null,
    });

    /* Supervisor QC */
    const supervisorJudgement = afterQc ? (afterQc.supervisor_judgement || null) : null;
    items.push({
      title: "Supervisor QC",
      name: afterQc ? (afterQc.supervisor_name || "-") : "-",
      date: afterQc ? this._formatDate(afterQc.supervisor_date) : "-",
      status: supervisorJudgement === "OK" ? "OK" : (supervisorJudgement === "NG" ? "NG" : "BELUM DI-JUDGEMENT"),
      statusClass: supervisorJudgement === "OK" ? "ht-ir-judgement-status-ok" : (supervisorJudgement === "NG" ? "ht-ir-judgement-status-ng" : "ht-ir-judgement-status-pending"),
      signature: afterQc ? afterQc.supervisor_signature : null,
    });

    let html = "";
    items.forEach(function (item) {
      /* Signature row */
      let sigHtml = "";
      if (item.signature) {
        sigHtml = '<div class="ht-ir-judgement-row"><span class="label">Tanda Tangan</span><span class="value sig-img-wrap"><img src="' + item.signature + '" class="ht-ir-sig-img" alt="Tanda Tangan"></span></div>';
      } else if (item.status === "OK" || item.status === "NG") {
        sigHtml = '<div class="ht-ir-judgement-row"><span class="label">Tanda Tangan</span><span class="value sig-pending">BELUM ADA TANDA TANGAN</span></div>';
      }

      html +=
        '<div class="ht-ir-judgement-item">' +
        '<h4>' + item.title + '</h4>' +
        '<div class="ht-ir-judgement-row"><span class="label">Nama</span><span class="value">' + item.name + '</span></div>' +
        '<div class="ht-ir-judgement-row"><span class="label">Tanggal</span><span class="value">' + item.date + '</span></div>' +
        '<div class="ht-ir-judgement-row"><span class="label">Status</span><span class="value ' + item.statusClass + '">' + item.status + '</span></div>' +
        sigHtml +
        '</div>';
    });
    grid.innerHTML = html;
  },

  /* ---- Notifikasi jika belum ada judgement ---- */
  showJudgementNotification() {
    const afterQc = this.state.afterQc;
    const notifEl = document.getElementById("judgementNotification");
    const notifText = document.getElementById("judgementNotificationText");
    const notifDetail = document.getElementById("judgementNotificationDetail");
    if (!notifEl || !notifText || !notifDetail) return;

    const inspHasil = afterQc ? String(afterQc.hasil || "").toUpperCase() : "";
    const leaderJudgement = afterQc ? (afterQc.leader_judgement || null) : null;
    const supervisorJudgement = afterQc ? (afterQc.supervisor_judgement || null) : null;

    const inspMissing = inspHasil !== "OK" && inspHasil !== "NG";
    const leaderMissing = leaderJudgement !== "OK" && leaderJudgement !== "NG";
    const supervisorMissing = supervisorJudgement !== "OK" && supervisorJudgement !== "NG";

    const anyMissing = inspMissing || leaderMissing || supervisorMissing;

    if (!anyMissing) {
      notifEl.classList.add("hidden");
      notifText.textContent = "";
      notifDetail.innerHTML = "";
      return;
    }

    notifEl.classList.remove("hidden");
    notifText.textContent = "PERHATIAN: Material ini belum memiliki judgement.";

    let detailHtml = "<ul>";
    if (inspMissing) {
      detailHtml +=
        '<li><span class="label">Inspector QC</span><span class="badge badge-pending">BELUM ADA JUDGEMENT</span></li>';
    } else {
      detailHtml +=
        '<li><span class="label">Inspector QC</span><span class="badge badge-ok">' +
        inspHasil +
        "</span></li>";
    }
    if (leaderMissing) {
      detailHtml +=
        '<li><span class="label">Leader QC</span><span class="badge badge-pending">BELUM ADA JUDGEMENT</span></li>';
    } else {
      detailHtml +=
        '<li><span class="label">Leader QC</span><span class="badge badge-ok">' +
        leaderJudgement +
        "</span></li>";
    }
    if (supervisorMissing) {
      detailHtml +=
        '<li><span class="label">Supervisor QC</span><span class="badge badge-pending">BELUM ADA JUDGEMENT</span></li>';
    } else {
      detailHtml +=
        '<li><span class="label">Supervisor QC</span><span class="badge badge-ok">' +
        supervisorJudgement +
        "</span></li>";
    }
    detailHtml += "</ul>";
    notifDetail.innerHTML = detailHtml;
  },

  _parseSignature(qc) {
    const ext = this._parseRemarks(qc);
    return ext ? ext.signature : null;
  },

  _formatDate(iso) {
    if (!iso) return "-";
    try {
      return String(iso).slice(0, 10);
    } catch (e) {
      return "-";
    }
  },

  _escape(text) {
    if (text === null || text === undefined) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },

  /* ---- Tampilan panel ---- */
  showReportPanel() {
    document.getElementById("reportPanel").classList.remove("hidden");
    document.getElementById("notFoundState").classList.add("hidden");
  },

  showNotFound() {
    document.getElementById("reportPanel").classList.add("hidden");
    document.getElementById("notFoundState").classList.remove("hidden");
  },

  hideNotFound() {
    document.getElementById("notFoundState").classList.add("hidden");
  },

  resetSearch() {
    const input = document.getElementById("materialCodeInput");
    if (input) input.value = "";
    this.state.currentMaterial = null;
    this.state.currentPart = null;
    this.state.currentCustomer = null;
    this.state.currentProduction = null;
    this.state.afterQc = null;
    this.state.beforeQc = null;
    this.state.html5QrCode = null;
    this.state.isScanning = false;
    document.getElementById("qr-reader").innerHTML = "";
    const errEl = document.getElementById("qrError");
    if (errEl) { errEl.classList.add("hidden"); errEl.textContent = ""; }
    this._updateScannerUI();
    document.getElementById("reportPanel").classList.add("hidden");
    document.getElementById("notFoundState").classList.add("hidden");
  },

  /* ---- Print & PDF ---- */
  printReport() {
    const material = this.state.currentMaterial;
    if (!material) return;

    const kode = material.kode || "-";
    const qrDataUrl = this.generateQRDataURL(kode);
    const docHtml = this.generateDocumentHtml(qrDataUrl);
    const fileNameBase = "Inspection_Report_" + kode.replace(/[^a-zA-Z0-9]/g, "_");

    const printWin = window.open("", "_blank", "width=900,height=1100");
    if (!printWin) {
      HTUI.toast("Popup diblokir. Izinkan pop-up untuk mencetak dokumen.", "error");
      return;
    }

    printWin.document.open();
    printWin.document.write(docHtml);
    printWin.document.close();

    printWin.focus();
    setTimeout(function () {
      printWin.print();
    }, 500);
  },

  downloadPdf() {
    /* Tidak ada library PDF — gunakan browser print (Save as PDF) */
    this.printReport();
  },

  /* ---- Generate QR Code sebagai data URL untuk dokumen ---- */
  generateQRDataURL(kode) {
    if (!kode || kode === "-" || typeof QRCode === "undefined") {
      return null;
    }
    try {
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.left = "-9999px";
      div.style.top = "-9999px";
      div.style.visibility = "hidden";
      document.body.appendChild(div);

      new QRCode(div, {
        text: kode,
        width: 140,
        height: 140,
        colorDark: "#0B3150",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
      });

      const canvas = div.querySelector("canvas");
      if (!canvas) {
        document.body.removeChild(div);
        return null;
      }

      const dataUrl = canvas.toDataURL("image/png");
      document.body.removeChild(div);
      return dataUrl;
    } catch (e) {
      console.error("[QR] generateQRDataURL failed:", e);
      return null;
    }
  },

  generateDocumentHtml(qrDataUrl) {
    const m = this.state.currentMaterial;
    const p = this.state.currentPart;
    const c = this.state.currentCustomer;
    const afterQc = this.state.afterQc;
    const beforeQc = this.state.beforeQc;

    const reportDate = new Date().toISOString().slice(0, 10);
    const kode = m.kode || "-";

    const afterExt = afterQc ? this._parseRemarks(afterQc) : null;
    const beforeExt = beforeQc ? this._parseRemarks(beforeQc) : null;
    const afterSurface = (afterExt && afterExt.surface_values) || [];
    const afterCore = (afterExt && afterExt.core_values) || [];
    const beforeSurface = (beforeExt && beforeExt.surface_values) || [];
    const beforeCore = (beforeExt && beforeExt.core_values) || [];

    const maxPieces = Math.max(
      afterSurface.length, afterCore.length,
      beforeSurface.length, beforeCore.length, 12
    );

    const hasBefore = beforeSurface.length > 0 || beforeCore.length > 0;
    const hasAfter = afterSurface.length > 0 || afterCore.length > 0;

    /* Helper: format nilai sel tabel (null/undefined/kosong/NaN -> "-") */
    function formatCell(val) {
      if (val === undefined || val === null || val === "") return "-";
      const n = Number(val);
      if (isNaN(n)) return "-";
      return val;
    }

    /* Build table rows - test pieces only, no average/range columns */
    let tableRows = "";
    for (let i = 1; i <= maxPieces; i++) {
      tableRows += '<tr>';
      tableRows += '<td>' + i + '</td>';
      if (hasBefore) {
        tableRows += '<td>' + formatCell(beforeSurface[i - 1]) + '</td>';
        tableRows += '<td>' + formatCell(beforeCore[i - 1]) + '</td>';
      }
      if (hasAfter) {
        tableRows += '<td>' + formatCell(afterSurface[i - 1]) + '</td>';
        tableRows += '<td>' + formatCell(afterCore[i - 1]) + '</td>';
      }
      tableRows += '</tr>';
    }

    /* Helper: hitung rata-rata dari array nilai (abaikan null/undefined/kosong/non-angka) */
    function computeColAvg(arr) {
      const valid = arr.filter(function (v) {
        return v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
      });
      if (valid.length === 0) return "-";
      return (valid.reduce(function (a, b) { return Number(a) + Number(b); }, 0) / valid.length).toFixed(2);
    }

    /* Helper: hitung range (max - min) dari array nilai */
    function computeColRange(arr) {
      const valid = arr.filter(function (v) {
        return v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
      });
      if (valid.length === 0) return "-";
      const nums = valid.map(function (v) { return Number(v); });
      return (Math.max.apply(null, nums) - Math.min.apply(null, nums)).toFixed(2);
    }

    const avgBeforeSurface = computeColAvg(beforeSurface);
    const avgBeforeCore = computeColAvg(beforeCore);
    const avgAfterSurface = computeColAvg(afterSurface);
    const avgAfterCore = computeColAvg(afterCore);

    const rangeBeforeSurface = computeColRange(beforeSurface);
    const rangeBeforeCore = computeColRange(beforeCore);
    const rangeAfterSurface = computeColRange(afterSurface);
    const rangeAfterCore = computeColRange(afterCore);

    /* Build summary rows (Average + Range) */
    let summaryRows = "";

    /* Baris AVERAGE: sel label + sel untuk setiap kolom data yang ada */
    summaryRows += '<tr class="ir-summary-row ir-avg-row">';
    summaryRows += '<td style="text-align:right;" colspan="1"><strong>AVERAGE</strong></td>';
    if (hasBefore) {
      summaryRows += '<td>' + avgBeforeSurface + '</td>';
      summaryRows += '<td>' + avgBeforeCore + '</td>';
    }
    if (hasAfter) {
      summaryRows += '<td>' + avgAfterSurface + '</td>';
      summaryRows += '<td>' + avgAfterCore + '</td>';
    }
    summaryRows += '</tr>';

    /* Baris RANGE (R): sel label + sel untuk setiap kolom data yang ada */
    summaryRows += '<tr class="ir-summary-row ir-range-row">';
    summaryRows += '<td style="text-align:right;" colspan="1"><strong>RANGE (R)</strong></td>';
    if (hasBefore) {
      summaryRows += '<td>' + rangeBeforeSurface + '</td>';
      summaryRows += '<td>' + rangeBeforeCore + '</td>';
    }
    if (hasAfter) {
      summaryRows += '<td>' + rangeAfterSurface + '</td>';
      summaryRows += '<td>' + rangeAfterCore + '</td>';
    }
    summaryRows += '</tr>';

    /* Judgement statuses */
    const inspHasil = afterQc ? String(afterQc.hasil || "").toUpperCase() : "";
    const inspStatus = inspHasil === "OK" ? "OK" : (inspHasil === "NG" ? "NG" : "BELUM DI-JUDGEMENT");
    const inspClass = inspHasil === "OK" ? "status-ok" : (inspHasil === "NG" ? "status-ng" : "status-pending");
    const leaderJudgement = afterQc ? (afterQc.leader_judgement || null) : null;
    const leaderStatus = leaderJudgement === "OK" ? "OK" : (leaderJudgement === "NG" ? "NG" : "BELUM DI-JUDGEMENT");
    const leaderClass = leaderJudgement === "OK" ? "status-ok" : (leaderJudgement === "NG" ? "status-ng" : "status-pending");
    const supervisorJudgement = afterQc ? (afterQc.supervisor_judgement || null) : null;
    const supervisorStatus = supervisorJudgement === "OK" ? "OK" : (supervisorJudgement === "NG" ? "NG" : "BELUM DI-JUDGEMENT");
    const supervisorClass = supervisorJudgement === "OK" ? "status-ok" : (supervisorJudgement === "NG" ? "status-ng" : "status-pending");

    /* Signature images (data URL) */
    const inspSignature = afterExt ? afterExt.signature : null;
    const leaderSignature = afterQc ? afterQc.leader_signature : null;
    const supervisorSignature = afterQc ? afterQc.supervisor_signature : null;

    /* Helper: signature HTML */
    function sigHtml(sig, hasJudgement) {
      if (sig) {
        return '<div class="judge-row"><span class="label">Tanda Tangan</span><span class="value"><img src="' + sig + '" class="judge-sig-img" alt="Tanda Tangan"></span></div>';
      } else if (hasJudgement) {
        return '<div class="judge-row"><span class="label">Tanda Tangan</span><span class="value sig-pending-doc">BELUM ADA TANDA TANGAN</span></div>';
      }
      return "";
    }

    const beforeCols = (beforeSurface.length > 0 || beforeCore.length > 0)
      ? '<th>Before Surface</th><th>Before Core</th>'
      : '';
    const afterCols = (afterSurface.length > 0 || afterCore.length > 0)
      ? '<th>After Surface</th><th>After Core</th>'
      : '';

    const partInfoRows = [
      ["Control Number / Kode Material", m.kode || "-"],
      ["Customer", c ? c.nama_customer : "-"],
      ["Part Name", p ? p.nama_part : "-"],
      ["Part No.", p ? p.nomor_part : "-"],
      ["Lot Number", m.lot_no || "-"],
      ["Material Charge", m.material_charge || "-"],
      ["Status Part", m.status_part || "-"],
      ["Jenis Proses", m.process_type || "-"],
      ["Target Hardness", p ? p.target_hardness : "-"],
      ["QTY", m.qty ? m.qty.toLocaleString("id-ID") + " PCS" : "-"],
    ].map(function (row) {
      return '<tr><td style="font-weight:600;color:#475569;">' + row[0] + '</td><td>' + row[1] + '</td></tr>';
    }).join("");

    const html = [
      '<!doctype html>',
      '<html lang="id">',
      '<head><meta charset="UTF-8"><title>Inspection Report - ' + kode + '</title>',
      '<style>',
      '@page { size: A4 portrait; margin: 12mm; }',
      'html,body { margin:0; padding:0; background:#fff; font-family:"Inter",Arial,Helvetica,sans-serif; color:#18364F; font-size:10px; line-height:1.4; }',
      '* { -webkit-print-color-adjust:exact !important; color-adjust:exact !important; box-sizing:border-box; }',
      '.doc { width:210mm; margin:0 auto; padding:0; }',
      '.header { display:flex; align-items:center; justify-content:space-between; gap:8px; border-bottom:2px solid #123F63; padding-bottom:8px; margin-bottom:12px; }',
      '.header img { width:32px; height:32px; }',
      '.header-center { flex:1; text-align:center; }',
      '.header-center h1 { margin:0; font-size:16px; font-weight:800; color:#123F63; letter-spacing:1px; }',
      '.header-center p { margin:0; font-size:9px; color:#60778C; }',
      '.header-qr { display:flex; flex-direction:column; align-items:center; gap:4px; }',
      '.header-qr-img { width:90px; height:90px; }',
      '.header-qr-text { font-size:9px; font-weight:700; color:#123F63; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100px; }',
      '.header-qr-placeholder { display:flex; flex-direction:column; align-items:center; gap:4px; font-size:8px; color:#60778C; }',
      '.header h1 { margin:0; font-size:16px; font-weight:800; color:#123F63; letter-spacing:1px; }',
      '.header p { margin:0; font-size:9px; color:#60778C; }',
      '.meta { display:flex; justify-content:space-between; font-size:9px; color:#60778C; margin-bottom:12px; }',
      '.section { margin-bottom:12px; }',
      '.section h3 { font-size:12px; font-weight:700; color:#123F63; margin:0 0 6px 0; border-bottom:1px solid var(--border,#cbd5e1); padding-bottom:4px; }',
      '.info-table { width:100%; border-collapse:collapse; }',
      '.info-table td { padding:4px 6px; border:1px solid #cbd5e1; font-size:9.5px; }',
      '.info-table td:first-child { font-weight:600; color:#475569; width:40%; background:#f8fafc; }',
      '.hardness-table { width:100%; border-collapse:collapse; margin-top:6px; }',
      '.hardness-table th { background:#f1f5f9; font-weight:600; color:#475569; text-transform:uppercase; letter-spacing:0.04em; font-size:8.5px; padding:5px; text-align:center; border:1px solid #cbd5e1; }',
      '.hardness-table td { padding:5px; text-align:center; border:1px solid #cbd5e1; font-size:9px; }',
      '.hardness-table td:first-child { font-weight:600; color:#475569; }',
      '.ir-summary-row { font-weight:700; }',
      '.ir-summary-row td { border:1px solid #cbd5e1; text-align:center; font-size:9px; }',
      '.ir-summary-row td:first-child { font-weight:700; color:#123F63; }',
      '.ir-avg-row { background:#eaf3fb; }',
      '.ir-range-row { background:#f1f5f9; }',
      '.judgement-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:6px; }',
      '.judge-item { border:1px solid #cbd5e1; border-radius:4px; padding:8px; background:#f8fafc; }',
      '.judge-item h4 { margin:0 0 6px 0; font-size:11px; font-weight:700; color:#123F63; text-transform:uppercase; letter-spacing:0.04em; }',
      '.judge-row { display:flex; justify-content:space-between; font-size:8.5px; margin-bottom:2px; }',
      '.judge-row .label { color:#60778C; font-weight:600; font-size:8px; text-transform:uppercase; }',
      '.judge-row .value { font-weight:700; }',
      '.judge-sig-img { max-width:45mm; max-height:18mm; object-fit:contain; border:0.5px solid #C7D9E8; border-radius:1mm; background:#fff; }',
      '.sig-pending-doc { font-size:6.5px; color:#6b7280; font-style:italic; }',
      '.status-ok { color:#166534; }',
      '.status-ng { color:#991b1b; }',
      '.status-pending { color:#475569; }',
      '.footer { margin-top:16px; font-size:8px; color:#60778C; text-align:center; border-top:1px solid #cbd5e1; padding-top:6px; }',
      '@media print { .no-print { display:none !important; } }',
      '</style>',
      '</head>',
      '<body><div class="doc">',
      '<div class="header">',
      '<img src="assets/logo/logo baru.svg" alt="Logo">',
      '<div class="header-center">',
      '<h1>INSPECTION REPORT</h1>',
      '<p>PT CHUNETSU INDONESIA &bull; Heat Treatment Department</p>',
      '</div>',
      (qrDataUrl
        ? '<div class="header-qr">' +
          '<img src="' + qrDataUrl + '" alt="QR Code" class="header-qr-img">' +
          '<div class="header-qr-text">' + kode + '</div>' +
          '</div>'
        : '<div class="header-qr-placeholder">' +
          '<div class="header-qr-text">QR Code tidak tersedia</div>' +
          '</div>') +
      '</div>',
      '<div class="meta">',
      '<span>No. Laporan: ' + kode + '</span>',
      '<span>Tanggal: ' + reportDate + '</span>',
      '</div>',

      '<div class="section">',
      '<h3>Informasi Part</h3>',
      '<table class="info-table">' + partInfoRows + '</table>',
      '</div>',

      '<div class="section">',
      '<h3>Tabel Hasil Hardness</h3>',
      '<table class="hardness-table">',
      '<thead><tr>',
      '<th>Test Piece</th>' + beforeCols + afterCols,
      '</tr></thead>',
      '<tbody>' + tableRows + summaryRows + '</tbody>',
      '</table>',
      '</div>',

      '<div class="section">',
      '<h3>Judgement dan Approval</h3>',
      '<div class="judgement-grid">',
      '<div class="judge-item">',
      '<h4>Inspector QC</h4>',
      '<div class="judge-row"><span class="label">Nama</span><span class="value">' + (afterQc ? (afterQc.inspector || "-") : "-") + '</span></div>',
      '<div class="judge-row"><span class="label">Tanggal</span><span class="value">' + (afterQc ? this._formatDate(afterQc.tanggal_inspector) : "-") + '</span></div>',
      '<div class="judge-row"><span class="label">Status</span><span class="value ' + inspClass + '">' + inspStatus + '</span></div>',
      sigHtml(inspSignature, inspHasil === "OK" || inspHasil === "NG"),
      '</div>',
      '<div class="judge-item">',
      '<h4>Leader QC</h4>',
      '<div class="judge-row"><span class="label">Nama</span><span class="value">' + (afterQc ? (afterQc.leader_name || "-") : "-") + '</span></div>',
      '<div class="judge-row"><span class="label">Tanggal</span><span class="value">' + (afterQc ? this._formatDate(afterQc.leader_date) : "-") + '</span></div>',
      '<div class="judge-row"><span class="label">Status</span><span class="value ' + leaderClass + '">' + leaderStatus + '</span></div>',
      sigHtml(leaderSignature, leaderJudgement === "OK" || leaderJudgement === "NG"),
      '</div>',
      '<div class="judge-item">',
      '<h4>Supervisor QC</h4>',
      '<div class="judge-row"><span class="label">Nama</span><span class="value">' + (afterQc ? (afterQc.supervisor_name || "-") : "-") + '</span></div>',
      '<div class="judge-row"><span class="label">Tanggal</span><span class="value">' + (afterQc ? this._formatDate(afterQc.supervisor_date) : "-") + '</span></div>',
      '<div class="judge-row"><span class="label">Status</span><span class="value ' + supervisorClass + '">' + supervisorStatus + '</span></div>',
      sigHtml(supervisorSignature, supervisorJudgement === "OK" || supervisorJudgement === "NG"),
      '</div>',
      '</div>',
      '</div>',

      '<div class="footer">',
      'Dokumen ini dihasilkan dari sistem Inspection Report PT CHUNETSU INDONESIA. Data berdasarkan catatan QC yang tersimpan.',
      '</div>',
      '</div></body></html>',
    ].join("\n");

    return html;
  },
};
