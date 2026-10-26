/* ============================================================
   ReportCenter — Final Inspection Report Center
   PT CHUNETSU INDONESIA — Sistem Informasi Produksi Heat Treatment

   Fungsi: Cari material, validasi persetujuan QC (Inspector,
   Leader, Supervisor), tampilkan dokumen final, print & PDF.

   Sumber data:
   - htm_materials (kode, qr_code, part_id, customer_id, qty,
     lot_no, material_charge, status_proses, tanggal_masuk)
   - htm_parts (nomor_part, nama_part, target_hardness,
     process_type, standard_temperature)
   - htm_customers (nama_customer, kode_customer, alamat, pic, phone, email)
   - htm_qcs (hasil, hardness, satuan_hardness, inspector,
     tanggal_inspector, catatan, catatan, leader_*, supervisor_*)
   - remarks JSON: stage, surface_values, core_values, signature
   ============================================================ */
const RCF = {
  state: {
    currentMaterial: null,
    currentQc: null,
    currentJudge: null,
    currentExt: null,
    html5QrCode: null,
    reportNumber: "",
  },

  /* ---- Inisialisasi halaman ---- */
  init() {
    HTDateFormat.init();
    this.bindEvents();
    this.startScanner();
  },

  /* ---- Event binding ---- */
  bindEvents() {
    var self = this;

    var btnSearch = document.getElementById("btnSearch");
    if (btnSearch) btnSearch.addEventListener("click", function () { self.searchMaterial(); });

    var btnReset = document.getElementById("btnReset");
    if (btnReset) btnReset.addEventListener("click", function () { self.resetSearch(); });

    var btnClear = document.getElementById("btnClearSearch");
    if (btnClear) btnClear.addEventListener("click", function () { self.resetSearch(); });

    var input = document.getElementById("materialCodeInput");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); self.searchMaterial(); }
      });
      input.focus();
    }

    var btnPreview = document.getElementById("btnPreview");
    if (btnPreview) btnPreview.addEventListener("click", function () { self.showPreview(); });

    var btnPrint = document.getElementById("btnPrint");
    if (btnPrint) btnPrint.addEventListener("click", function () { self.printReport(); });

    var btnPdf = document.getElementById("btnDownloadPdf");
    if (btnPdf) btnPdf.addEventListener("click", function () { self.downloadPdf(); });

    var btnClosePreview = document.getElementById("btnClosePreview");
    if (btnClosePreview) btnClosePreview.addEventListener("click", function () { self.closePreview(); });
    var btnClosePreviewFooter = document.getElementById("btnClosePreviewFooter");
    if (btnClosePreviewFooter) btnClosePreviewFooter.addEventListener("click", function () { self.closePreview(); });
  },

  /* ---- QR Scanner ---- */
  startScanner() {
    if (!window.Html5Qrcode) {
      var scannerContainer = document.getElementById("qr-reader");
      if (scannerContainer) {
        scannerContainer.innerHTML = '<p class="ht-hint text-center">Kamera tidak tersedia di browser ini. Gunakan pencarian manual.</p>';
      }
      return;
    }
    this.state.html5QrCode = HTUI.createScanner("qr-reader");
    if (!this.state.html5QrCode) return;
    HTUI.startScanner(this.state.html5QrCode, function (decodedText) {
      var id = HTUI.parseScanId(decodedText);
      if (id) {
        document.getElementById("materialCodeInput").value = id;
        RCF.searchMaterial();
      }
    });
  },

  /* ---- Pencarian material ---- */
  searchMaterial() {
    var input = document.getElementById("materialCodeInput");
    var errorEl = document.getElementById("searchError");
    var query = (input ? input.value : "").trim();

    if (errorEl) { errorEl.classList.add("hidden"); errorEl.textContent = ""; }

    if (!query) {
      if (errorEl) { errorEl.textContent = "Masukkan QR Code atau Control Number."; errorEl.classList.remove("hidden"); }
      return;
    }

    var material = DB.findByKode(query) || DB.findMaterial(query);

    if (!material) {
      this.showNotFound();
      return;
    }

    this.state.currentMaterial = material;
    this.loadAndRender(material);
  },

  /* ---- Load QC data and render ---- */
  loadAndRender(material) {
    var qc = DB._getAfterQc(material);
    var judge = DB.getQCJudgement(material);
    var ext = qc ? DB._parseQCRemarks(qc) : null;
    var production = DB.getProcessProduction(material, "HT") || {};

    this.state.currentQc = qc;
    this.state.currentJudge = judge;
    this.state.currentExt = ext;

    if (!qc || !judge.hasInspector) {
      this.showNoQC(material);
      return;
    }

    this.renderResults(material, qc, judge, ext, production);
  },

  /* ---- Render search results ---- */
  renderResults(material, qc, judge, ext, production) {
    var part = material.part_id ? DB.findPartById(material.part_id) : null;
    var customer = material.customer_id ? DB.findCustomerById(material.customer_id) : null;
    var treatment = production.jenis_treatment || "-";

    document.getElementById("sControlNumber").textContent = material.kode || "-";
    document.getElementById("sCustomer").textContent = customer ? customer.nama_customer : "-";
    document.getElementById("sNamaPart").textContent = part ? part.nama_part : "-";
    document.getElementById("sNomorPart").textContent = part ? part.nomor_part : "-";
    document.getElementById("sLotNumber").textContent = material.lot_no || "-";
    document.getElementById("sQty").textContent = (material.qty || 0) + " " + (material.status_part || "");
    document.getElementById("sProcessType").textContent = treatment;
    document.getElementById("sTargetHardness").textContent = part && part.target_hardness ? part.target_hardness : "-";
    document.getElementById("sInspectionDate").textContent = formatDateLong(qc.tanggal_inspector);
    document.getElementById("sHasil").innerHTML = '<span class="ht-badge ' + (qc.hasil === "OK" ? "ht-badge-ok" : qc.hasil === "NG" ? "ht-badge-ng" : "ht-badge-pending") + '">' + (qc.hasil || "-") + '</span>';

    /* Approval status */
    this.renderApprovalStatus(judge, qc, ext);

    /* Generate report number */
    var reportNo = "IR-" + (material.kode || "").toUpperCase() + "-" + (qc.id || "");
    this.state.reportNumber = reportNo;

    /* Hide states */
    document.getElementById("notFoundState").classList.add("hidden");
    document.getElementById("searchResults").classList.remove("hidden");

    /* Scroll to results */
    document.getElementById("searchResults").scrollIntoView({ behavior: "smooth" });
  },

  /* ---- Render approval status ---- */
  renderApprovalStatus(judge, qc, ext) {
    /* Inspector */
    var inspectorOk = judge.hasInspector && judge.inspectorHasil === "OK";
    var inspectorNameEl = document.getElementById("aInspectorName");
    var inspectorDateEl = document.getElementById("aInspectorDate");
    var inspectorBadgeEl = document.getElementById("aInspectorBadge");
    var stepInspector = document.getElementById("stepInspector");

    if (inspectorOk) {
      inspectorNameEl.textContent = qc.inspector || "-";
      inspectorDateEl.textContent = formatDateLong(qc.tanggal_inspector);
      inspectorBadgeEl.textContent = "OK";
      inspectorBadgeEl.className = "ht-ir-approval-badge ht-ir-badge-ok";
      stepInspector.classList.remove("ht-ir-step-incomplete");
      stepInspector.classList.add("ht-ir-step-complete");
    } else {
      inspectorNameEl.textContent = "-";
      inspectorDateEl.textContent = "-";
      inspectorBadgeEl.textContent = "Belum Lengkap";
      inspectorBadgeEl.className = "ht-ir-approval-badge ht-ir-badge-incomplete";
      stepInspector.classList.remove("ht-ir-step-complete");
      stepInspector.classList.add("ht-ir-step-incomplete");
    }

    /* Leader */
    var leaderOk = judge.leaderJudgement === "OK" && !!judge.leaderName && !!judge.leaderSignature;
    var leaderNameEl = document.getElementById("aLeaderName");
    var leaderDateEl = document.getElementById("aLeaderDate");
    var leaderBadgeEl = document.getElementById("aLeaderBadge");
    var stepLeader = document.getElementById("stepLeader");

    if (leaderOk) {
      leaderNameEl.textContent = judge.leaderName || "-";
      leaderDateEl.textContent = formatDateLong(judge.leaderDate);
      leaderBadgeEl.textContent = "OK";
      leaderBadgeEl.className = "ht-ir-approval-badge ht-ir-badge-ok";
      stepLeader.classList.remove("ht-ir-step-incomplete");
      stepLeader.classList.add("ht-ir-step-complete");
    } else {
      leaderNameEl.textContent = judge.leaderName || "-";
      leaderDateEl.textContent = judge.leaderDate ? formatDateLong(judge.leaderDate) : "-";
      leaderBadgeEl.textContent = "Belum Lengkap";
      leaderBadgeEl.className = "ht-ir-approval-badge ht-ir-badge-incomplete";
      stepLeader.classList.remove("ht-ir-step-complete");
      stepLeader.classList.add("ht-ir-step-incomplete");
    }

    /* Supervisor */
    var supervisorOk = judge.supervisorJudgement === "OK" && !!judge.supervisorName && !!judge.supervisorSignature;
    var supNameEl = document.getElementById("aSupervisorName");
    var supDateEl = document.getElementById("aSupervisorDate");
    var supBadgeEl = document.getElementById("aSupervisorBadge");
    var stepSupervisor = document.getElementById("stepSupervisor");

    if (supervisorOk) {
      supNameEl.textContent = judge.supervisorName || "-";
      supDateEl.textContent = formatDateLong(judge.supervisorDate);
      supBadgeEl.textContent = "OK";
      supBadgeEl.className = "ht-ir-approval-badge ht-ir-badge-ok";
      stepSupervisor.classList.remove("ht-ir-step-incomplete");
      stepSupervisor.classList.add("ht-ir-step-complete");
    } else {
      supNameEl.textContent = judge.supervisorName || "-";
      supDateEl.textContent = judge.supervisorDate ? formatDateLong(judge.supervisorDate) : "-";
      supBadgeEl.textContent = "Belum Lengkap";
      supBadgeEl.className = "ht-ir-approval-badge ht-ir-badge-incomplete";
      stepSupervisor.classList.remove("ht-ir-step-complete");
      stepSupervisor.classList.add("ht-ir-step-incomplete");
    }

    /* Validate and show issues */
    var validation = this.validateReport(qc, judge, ext);
    var issueList = document.getElementById("issueList");
    var statusBadge = document.getElementById("documentStatusBadge");

    if (validation.valid) {
      issueList.innerHTML = '<p class="ht-ir-issue-text ht-ir-issue-ok"><img src="assets/icons/check.svg" alt="" class="icon mr-1" />Semua persetujuan lengkap. Siap diterbitkan.</p>';
      statusBadge.textContent = "SIAP DITERBITKAN";
      statusBadge.className = "ht-ir-status-badge ht-ir-status-ok";

      document.getElementById("btnPreview").disabled = false;
      document.getElementById("btnPrint").disabled = false;
      document.getElementById("btnDownloadPdf").disabled = false;
    } else {
      var issuesHtml = validation.issues.map(function (i) {
        return '<li><img src="assets/icons/error.svg" alt="" class="icon mr-1" />' + i + '</li>';
      }).join("");
      issueList.innerHTML = '<ul class="ht-ir-issue-list">' + issuesHtml + '</ul>';
      statusBadge.textContent = "BELUM LENGKAP";
      statusBadge.className = "ht-ir-status-badge ht-ir-status-incomplete";

      document.getElementById("btnPreview").disabled = true;
      document.getElementById("btnPrint").disabled = true;
      document.getElementById("btnDownloadPdf").disabled = true;
    }

    issueList.classList.remove("hidden");
    statusBadge.classList.remove("hidden");
  },

  /* ---- Validasi laporan ---- */
  validateReport(qc, judge, ext) {
    var issues = [];

    /* Inspector QC */
    if (!judge.hasInspector) {
      issues.push("Belum ada hasil inspeksi QC.");
    } else {
      if (judge.inspectorHasil !== "OK") {
        issues.push("Hasil QC Inspector adalah " + (judge.inspectorHasil || "kosong") + ", harus OK.");
      }
      if (!qc.inspector) issues.push("Nama Inspector belum diisi.");
      if (!qc.tanggal_inspector) issues.push("Tanggal inspeksi belum diisi.");
      if (!ext || !ext.signature) issues.push("Tanda tangan Inspector belum tersedia.");

      /* Surface values */
      var surfaceValues = (ext && ext.surface_values) || [];
      var validSurface = surfaceValues.filter(function (v) { return v != null && !isNaN(v); });
      if (validSurface.length === 0) issues.push("Nilai Surface Hardness belum diisi.");

      /* Core values */
      var coreValues = (ext && ext.core_values) || [];
      var validCore = coreValues.filter(function (v) { return v != null && !isNaN(v); });
      if (validCore.length === 0) issues.push("Nilai Core Hardness belum diisi.");
    }

    /* Leader QC */
    if (!judge.leaderJudgement || judge.leaderJudgement !== "OK") {
      issues.push("Leader QC belum memberikan judgment OK.");
    }
    if (!judge.leaderName) issues.push("Nama Leader QC belum diisi.");
    if (!judge.leaderDate) issues.push("Tanggal persetujuan Leader belum diisi.");
    if (!judge.leaderSignature) issues.push("Tanda tangan Leader QC belum tersedia.");

    /* Supervisor QC */
    if (!judge.supervisorJudgement || judge.supervisorJudgement !== "OK") {
      issues.push("Supervisor QC belum memberikan judgment OK.");
    }
    if (!judge.supervisorName) issues.push("Nama Supervisor QC belum diisi.");
    if (!judge.supervisorDate) issues.push("Tanggal persetujuan Supervisor belum diisi.");
    if (!judge.supervisorSignature) issues.push("Tanda tangan Supervisor QC belum tersedia.");

    return { valid: issues.length === 0, issues: issues };
  },

  /* ---- Show not found ---- */
  showNotFound() {
    document.getElementById("notFoundState").classList.remove("hidden");
    document.getElementById("searchResults").classList.add("hidden");
    document.getElementById("searchError").classList.add("hidden");
  },

  /* ---- Show no QC ---- */
  showNoQC(material) {
    document.getElementById("notFoundState").classList.remove("hidden");
    var notFoundText = document.querySelector("#notFoundState .ht-empty-text");
    if (notFoundText) {
      notFoundText.textContent = "Material ditemukan (" + material.kode + "), tetapi belum ada data QC Inspeksi. Pastikan proses Heat Treatment dan QC sudah selesai.";
    }
    document.getElementById("searchResults").classList.add("hidden");
  },

  /* ---- Reset search ---- */
  resetSearch() {
    var input = document.getElementById("materialCodeInput");
    if (input) input.value = "";
    document.getElementById("notFoundState").classList.add("hidden");
    document.getElementById("searchResults").classList.add("hidden");
    document.getElementById("searchError").classList.add("hidden");

    this.state.currentMaterial = null;
    this.state.currentQc = null;
    this.state.currentJudge = null;
    this.state.currentExt = null;
    this.state.reportNumber = "";

    if (input) input.focus();
  },

  /* ---- Dapatkan QC record "before" untuk sebuah material ---- */
  _getBeforeQc(material) {
    if (!material) return null;
    var qcs = DB.get("qcs").filter(function (q) {
      return String(q.material_id) === String(material.id);
    });
    var beforeQc = null;
    for (var i = 0; i < qcs.length; i++) {
      var q = qcs[i];
      var ext = DB._parseQCRemarks(q);
      var stage = (ext && ext.stage) || "after";
      if (stage === "before") {
        if (!beforeQc || (q.id || 0) > (beforeQc.id || 0)) {
          beforeQc = q;
        }
      }
    }
    return beforeQc;
  },

  /* ---- Hitung statistik kekerasan (average + R) ----
     R = Max - Min. Average dan R menggunakan toFixed(1). */
  calcStats(values) {
    var valid = values.filter(function (v) {
      return v != null && !isNaN(v);
    });
    var avg = valid.length > 0
      ? (valid.reduce(function (a, b) { return a + b; }, 0) / valid.length).toFixed(1)
      : null;
    var r = valid.length > 0
      ? (Math.max.apply(null, valid) - Math.min.apply(null, valid)).toFixed(1)
      : null;
    return { avg: avg, r: r, count: valid.length };
  },

  /* ---- Format nilai: tampilkan "—" untuk null / undefined / kosong ---- */
  _fmt(v) {
    if (v === null || v === undefined || v === "") return "-";
    return v;
  },

  /* ---- Format tanggal ---- */
  _fmtDate(d) {
    if (!d) return "-";
    return formatDateLong(d);
  },

  /* ---- Signature image helper ---- */
  _sigImg(sig) {
    if (!sig) return '<span class="ir-sig-placeholder">Tidak tersedia</span>';
    return '<img src="' + sig + '" class="ir-sig-image" alt="Tanda Tangan" />';
  },

  /* ---- SVG schematic: titik pengukuran surface & core ---- */
  _schematicSvg(stage) {
    var surfacePoints = [
      { x: 20, y: 25 }, { x: 50, y: 25 }, { x: 80, y: 25 },
      { x: 20, y: 75 }, { x: 50, y: 75 }, { x: 80, y: 75 },
      { x: 35, y: 40 }, { x: 65, y: 40 },
      { x: 35, y: 60 }, { x: 65, y: 60 },
    ];
    var corePoints = [
      { x: 50, y: 50 }, { x: 35, y: 45 }, { x: 65, y: 45 },
      { x: 35, y: 55 }, { x: 65, y: 55 },
      { x: 50, y: 35 }, { x: 50, y: 65 },
      { x: 40, y: 50 }, { x: 60, y: 50 }, { x: 50, y: 45 },
    ];
    var points = stage === "surface" ? surfacePoints : corePoints;
    var dots = points.map(function (p) {
      return '<circle cx="' + p.x + '" cy="' + p.y + '" r="1.5" fill="#000" />';
    }).join("");
    var label = stage === "surface" ? "Surface Measurement Points" : "Core Measurement Points";
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="10" y="20" width="80" height="60" fill="none" stroke="#000" stroke-width="0.5" />' +
      '<rect x="15" y="40" width="70" height="20" fill="none" stroke="#000" stroke-width="0.5" />' +
      dots +
      '</svg>';
  },

  /* ---- Generate document HTML ----
      Redesign: Header, Info Panels, Hardness Table, Approval Panels, Footer. */
  generateDocumentHtml(material, qc, judg, ext, production) {
    var part = material.part_id ? DB.findPartById(material.part_id) : null;
    var customer = material.customer_id ? DB.findCustomerById(material.customer_id) : null;
    var reportNo = this.state.reportNumber || "-";
    var satuan = (ext && ext.satuan_hardness) || (qc && qc.satuan_hardness) || "HRC";

    /* Before QC data */
    var beforeQc = this._getBeforeQc(material);
    var beforeExt = beforeQc ? DB._parseQCRemarks(beforeQc) : null;

    /* Before / After values */
    var beforeSv = (beforeExt && beforeExt.surface_values) || [];
    var beforeCv = (beforeExt && beforeExt.core_values) || [];
    var afterSv = (ext && ext.surface_values) || [];
    var afterCv = (ext && ext.core_values) || [];

    /* Stats per column */
    var bsSvStats = this.calcStats(beforeSv);
    var bsCvStats = this.calcStats(beforeCv);
    var aftSvStats = this.calcStats(afterSv);
    var aftCvStats = this.calcStats(afterCv);

    /* Target hardness */
    var targetHardness = (part && part.target_hardness) ? part.target_hardness : "";
    var targetDisplay = targetHardness ? targetHardness + " " + satuan : "-";

    /* Result badge */
    var hasil = (qc && qc.hasil) ? String(qc.hasil).toUpperCase() : "PENDING";
    var resultBadgeClass = hasil === "OK" ? "ir-result-ok" : hasil === "NG" ? "ir-result-ng" : "ir-result-pending";

    /* Result badge HTML for table + info panel */
    var resultBadge = '<span class="ir-tiny-badge ' + resultBadgeClass + '">' + hasil + '</span>';
    var resultCard = '<div class="ir-result-card ' + resultBadgeClass + '">'
      + '<span class="ir-result-icon">' + (hasil === "OK" ? '✓' : hasil === "NG" ? '✗' : '○') + '</span>'
      + '<span class="ir-result-text">' + hasil + '</span>'
      + '</div>';

    /* Signature helper */
    var sigImg = function (sig) {
      if (!sig) return '<span class="ir-sig-placeholder">Belum ditandatangani</span>';
      return '<img src="' + sig + '" class="ir-sig-image" alt="Tanda Tangan" />';
    };

    /* Dates */
    var productionDate = (material && material.tanggal_masuk) ? formatDateLong(material.tanggal_masuk) : "-";
    var reportDate = (qc && qc.tanggal_inspector) ? formatDateLong(qc.tanggal_inspector) : "-";

    /* QR code URL — points to this app's inspection-report page with material code */
    var reportUrl = "";
    try {
      if (typeof window !== "undefined") {
        var origin = window.location.protocol + "//" + window.location.host;
        var basePath = window.location.pathname.replace(/[^\/]*$/, "");
        reportUrl = origin + basePath + "inspection-report.html?kode=" + encodeURIComponent(material.kode || "");
      }
    } catch (e) { reportUrl = ""; }
    this.state.reportUrl = reportUrl;

    /* QR label */
    var qrLabel = reportUrl ? '<span class="ir-qr-label">Scan for Digital Report</span>' : '<span class="ir-qr-label">Scan untuk Laporan Digital</span>';

    /* Helpers */
    var f = this._fmt.bind(this);
    var fd = this._fmtDate.bind(this);

    /* Build hardness table rows (12 rows) */
    var tableRows = "";
    for (var i = 0; i < 12; i++) {
      var bsv = (i < beforeSv.length && beforeSv[i] != null) ? beforeSv[i] : "-";
      var bcv = (i < beforeCv.length && beforeCv[i] != null) ? beforeCv[i] : "-";
      var asv = (i < afterSv.length && afterSv[i] != null) ? afterSv[i] : "-";
      var acv = (i < afterCv.length && afterCv[i] != null) ? afterCv[i] : "-";
      tableRows += '<tr>'
        + '<td class="ir-cell-num">' + (i + 1) + '</td>'
        + '<td class="ir-cell-tp mono">TP ' + (i + 1) + '</td>'
        + '<td class="ir-cell-val mono">' + f(bsv) + '</td>'
        + '<td class="ir-cell-val mono">' + f(bcv) + '</td>'
        + '<td class="ir-cell-val mono">' + f(asv) + '</td>'
        + '<td class="ir-cell-val mono">' + f(acv) + '</td>'
        + '<td class="ir-cell-result">' + resultBadge + '</td>'
        + '</tr>';
    }

    /* Average summary row */
    var avgRow = '<tr class="ir-summary-row">'
      + '<td class="ir-summary-label">Average</td>'
      + '<td class="ir-summary-empty"></td>'
      + '<td class="ir-cell-val mono">' + f(bsSvStats.avg) + '</td>'
      + '<td class="ir-cell-val mono">' + f(bsCvStats.avg) + '</td>'
      + '<td class="ir-cell-val mono">' + f(aftSvStats.avg) + '</td>'
      + '<td class="ir-cell-val mono">' + f(aftCvStats.avg) + '</td>'
      + '<td class="ir-summary-empty"></td>'
      + '</tr>';

    /* Range summary row */
    var rangeRow = '<tr class="ir-summary-row">'
      + '<td class="ir-summary-label">Range (R)</td>'
      + '<td class="ir-summary-empty"></td>'
      + '<td class="ir-cell-val mono">' + f(bsSvStats.r) + '</td>'
      + '<td class="ir-cell-val mono">' + f(bsCvStats.r) + '</td>'
      + '<td class="ir-cell-val mono">' + f(aftSvStats.r) + '</td>'
      + '<td class="ir-cell-val mono">' + f(aftCvStats.r) + '</td>'
      + '<td class="ir-summary-empty"></td>'
      + '</tr>';

    var html = '<div class="ir-document">' +

      /* ---- Header ---- */
      '<div class="ir-header">'
        + '<div class="ir-header-title-col">'
          + '<div class="ir-header-logo">'
            + '<img src="assets/logo/logo baru.svg" alt="PT CHUNETSU INDONESIA" />'
          + '</div>'
          + '<div class="ir-company-block">'
            + '<p class="ir-company-name">PT CHUNETSU INDONESIA</p>'
            + '<p class="ir-dept-name">HEAT TREATMENT &amp; SURFACE ENGINEERING</p>'
            + '<p class="ir-tagline">QUALITY TODAY | RELIABILITY TOMORROW</p>'
          + '</div>'
        + '</div>'
        + '<div class="ir-header-title-col ir-header-title-center">'
          + '<div class="ir-report-badge">'
            + '<span class="ir-report-title">INSPECTION REPORT</span>'
            + '<span class="ir-report-subtitle">HARDNESS TEST<br>(Before &amp; After Heat Treatment)</span>'
          + '</div>'
        + '</div>'
        + '<div class="ir-header-title-col ir-header-title-right">'
          + '<div class="ir-qr-wrapper">'
            + '<div class="ir-qr-code" id="docQrCode" data-url="' + reportUrl + '"></div>'
            + qrLabel
            + '<span class="ir-report-id">No. ' + f(reportNo) + '</span>'
          + '</div>'
        + '</div>'
      + '</div>'

      /* ---- Info Panel ---- */
      + '<div class="ir-info-panel">'
        + '<div class="ir-panel">'
          + '<div class="ir-panel-header">'
            + '<span class="ir-panel-icon">📋</span>'
            + '<h4 class="ir-panel-title">Part Information</h4>'
          + '</div>'
          + '<div class="ir-panel-grid">'
            + '<div class="ir-panel-item"><span class="ir-panel-label">Part Name</span><span class="ir-panel-value">' + f(part ? part.nama_part : null) + '</span></div>'
            + '<div class="ir-panel-item"><span class="ir-panel-label">Part Number</span><span class="ir-panel-value mono">' + f(part ? part.nomor_part : null) + '</span></div>'
            + '<div class="ir-panel-item"><span class="ir-panel-label">Material Grade</span><span class="ir-panel-value mono">' + f(material.material_charge) + '</span></div>'
            + '<div class="ir-panel-item"><span class="ir-panel-label">Heat Treatment</span><span class="ir-panel-value">' + f(production ? production.jenis_treatment : null) + '</span></div>'
          + '</div>'
        + '</div>'
        + '<div class="ir-panel">'
          + '<div class="ir-panel-header">'
            + '<span class="ir-panel-icon">📦</span>'
            + '<h4 class="ir-panel-title">Production Information</h4>'
          + '</div>'
          + '<div class="ir-panel-grid">'
            + '<div class="ir-panel-item"><span class="ir-panel-label">Control Number</span><span class="ir-panel-value mono">' + f(material.kode) + '</span></div>'
            + '<div class="ir-panel-item"><span class="ir-panel-label">Lot / Batch</span><span class="ir-panel-value mono">' + f(material.lot_no) + '</span></div>'
            + '<div class="ir-panel-item"><span class="ir-panel-label">Production Date</span><span class="ir-panel-value">' + fd(material.tanggal_masuk) + '</span></div>'
            + '<div class="ir-panel-item"><span class="ir-panel-label">Report Date</span><span class="ir-panel-value">' + fd(qc && qc.tanggal_inspector ? qc.tanggal_inspector : null) + '</span></div>'
          + '</div>'
        + '</div>'
        + '<div class="ir-panel ir-panel-result">'
          + '<div class="ir-panel-header">'
            + '<span class="ir-panel-icon">✅</span>'
            + '<h4 class="ir-panel-title">Inspection Result</h4>'
          + '</div>'
          + resultCard
          + '<div class="ir-remarks-row">'
            + '<span class="ir-remarks-label">Remarks:</span>'
            + '<span class="ir-remarks-value">' + f(qc && qc.catatan ? qc.catatan : null) + '</span>'
          + '</div>'
        + '</div>'
      + '</div>'

      /* ---- Hardness Test Table ---- */
      + '<div class="ir-table-section">'
        + '<h4 class="ir-table-title">HARDNESS TEST RESULTS</h4>'
        + '<div class="ir-table-wrap">'
          + '<table class="ir-hardness-table">'
            + '<thead>'
              + '<tr class="ir-thead-main">'
                + '<th>No.</th>'
                + '<th>Test Piece</th>'
                + '<th colspan="2">Before Heat Treatment</th>'
                + '<th colspan="2">After Heat Treatment</th>'
                + '<th>Average (' + satuan + ')</th>'
                + '<th>Range (R)</th>'
                + '<th>Result</th>'
              + '</tr>'
              + '<tr class="ir-thead-sub">'
                + '<th></th>'
                + '<th></th>'
                + '<th>Surface</th>'
                + '<th>Core</th>'
                + '<th>Surface</th>'
                + '<th>Core</th>'
                + '<th>-</th>'
                + '<th>-</th>'
                + '<th></th>'
              + '</tr>'
            + '</thead>'
            + '<tbody>'
              + tableRows
              + avgRow
              + rangeRow
            + '</tbody>'
          + '</table>'
        + '</div>'
      + '</div>'

      /* ---- Standards & Criteria ---- */
        + '<table class="ir-standards-table">'
          + '<tr><td class="ir-std-label">Target Hardness</td><td class="ir-std-value mono">' + f(targetDisplay) + '</td>'
            + '<td class="ir-std-label">Hardness Unit</td><td class="ir-std-value mono">' + f(satuan) + '</td></tr>'
          + '<tr><td class="ir-std-label">Hardness Criterion</td><td class="ir-std-value">Per ASME B18.2.1 / ASTM A310</td>'
            + '<td class="ir-std-label">Measurement Method</td><td class="ir-std-value">Rockwell / Vickers Hardness Tester</td></tr>'
        + '</table>'
      + '</div>'

      /* ---- Approval Sections ---- */
      + '<div class="ir-approval-section">'
        + '<div class="ir-approval-card">'
          + '<div class="ir-approval-header">'
            + '<span class="ir-approval-icon">🔍</span>'
            + '<span class="ir-approval-role">INSPECTED BY</span>'
          + '</div>'
          + '<div class="ir-approval-name">' + f(qc ? qc.inspector : null) + '</div>'
          + '<div class="ir-approval-date">' + fd(qc && qc.tanggal_inspector ? qc.tanggal_inspector : null) + '</div>'
          + '<div class="ir-signature-box">' + sigImg(ext ? ext.signature : null) + '</div>'
          + '<span class="ir-approval-title">Inspector QC</span>'
          + '<span class="ir-approval-badge ' + (judg && judg.inspectorHasil === "OK" ? "ir-badge-ok" : "ir-badge-incomplete") + '">'
            + (judg && judg.inspectorHasil === "OK" ? "OK" : "Belum Lengkap") + '</span>'
        + '</div>'
        + '<div class="ir-approval-card">'
          + '<div class="ir-approval-header">'
            + '<span class="ir-approval-icon">⚖️</span>'
            + '<span class="ir-approval-role">REVIEWED BY</span>'
          + '</div>'
          + '<div class="ir-approval-name">' + f(qc ? qc.leader_name : null) + '</div>'
          + '<div class="ir-approval-date">' + fd(qc && qc.leader_date ? qc.leader_date : null) + '</div>'
          + '<div class="ir-signature-box">' + sigImg(qc ? qc.leader_signature : null) + '</div>'
          + '<span class="ir-approval-title">Leader QC</span>'
          + '<span class="ir-approval-badge ' + (judg && judg.leaderJudgement === "OK" ? "ir-badge-ok" : "ir-badge-incomplete") + '">'
            + (judg && judg.leaderJudgement === "OK" ? "OK" : "Belum Lengkap") + '</span>'
        + '</div>'
        + '<div class="ir-approval-card">'
          + '<div class="ir-approval-header">'
            + '<span class="ir-approval-icon">📋</span>'
            + '<span class="ir-approval-role">APPROVED BY</span>'
          + '</div>'
          + '<div class="ir-approval-name">' + f(qc ? qc.supervisor_name : null) + '</div>'
          + '<div class="ir-approval-date">' + fd(qc && qc.supervisor_date ? qc.supervisor_date : null) + '</div>'
          + '<div class="ir-signature-box">' + sigImg(qc ? qc.supervisor_signature : null) + '</div>'
          + '<span class="ir-approval-title">Supervisor QC</span>'
          + '<span class="ir-approval-badge ' + (judg && judg.supervisorJudgement === "OK" ? "ir-badge-ok" : "ir-badge-incomplete") + '">'
            + (judg && judg.supervisorJudgement === "OK" ? "OK" : "Belum Lengkap") + '</span>'
        + '</div>'
      + '</div>'

      /* ---- Supervisor Notes ---- */
      + (qc && qc.supervisor_notes ? '<div class="ir-sup-notes"><strong>Supervisor Notes:</strong> ' + qc.supervisor_notes + '</div>' : '')

      /* ---- Footer ---- */
      + '<div class="ir-footer">'
        + '<div class="ir-footer-left">'
          + '<img src="assets/icons/doc-icon.svg" alt="" class="icon mr-1" style="width:14px;height:14px;vertical-align:middle;opacity:0.6;" />'
          + '<span>This report is generated automatically by the QC System.</span>'
          + '<span>PT CHUNETSU INDONESIA</span>'
        + '</div>'
        + '<div class="ir-footer-right">'
          + '<span class="ir-footer-report-id">No. ' + f(reportNo) + '</span>'
          + '<span class="ir-footer-page">Page 1 of 1</span>'
        + '</div>'
      + '</div>'

    + '</div>';

    return html;
  },

  /* ---- Show document preview ---- */
  showPreview() {
    var self = this;
    var material = this.state.currentMaterial;
    var qc = this.state.currentQc;
    var judge = this.state.currentJudge;
    var ext = this.state.currentExt;
    var production = DB.getProcessProduction(material, "HT") || {};

    var html = this.generateDocumentHtml(material, qc, judge, ext, production);
    var cssText = this._getInlineCss();
    var body = document.getElementById("documentPreviewBody");
    body.innerHTML = '<style>' + cssText + '</style>' + html;

    /* Generate QR code for the document */
    setTimeout(function () {
      var qrDiv = document.getElementById("docQrCode");
      if (qrDiv && typeof QRCode !== "undefined") {
        qrDiv.innerHTML = "";
        var qrUrl = self.state.reportUrl || material.kode || "";
        new QRCode(qrDiv, {
          text: qrUrl,
          width: 80,
          height: 80,
          colorDark: "#0B3150",
          colorLight: "#ffffff",
        });
      }
    }, 100);

    HTUI.openModal("documentPreviewModal");
  },

  /* ---- Close preview ---- */
  closePreview() {
    HTUI.closeModal("documentPreviewModal");
  },

  /* ---- Print report ---- */
  printReport() {
    var material = this.state.currentMaterial;
    var qc = this.state.currentQc;
    var judge = this.state.currentJudge;
    var ext = this.state.currentExt;
    var production = DB.getProcessProduction(material, "HT") || {};

    var docHtml = this.generateInlineDocument(material, qc, judge, ext, production);
    var reportNo = this.state.reportNumber;
    var fileName = "Inspection-Report_" + reportNo + "_" + material.kode + ".pdf";

    var printWin = window.open("", "_blank", "width=1000,height=800");
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

  /* ---- Download / Save as PDF ---- */
  downloadPdf() {
    /* No PDF library available — use browser print to Save as PDF */
    this.printReport();
  },

  /* ---- Generate complete HTML document for print window ----
  /* ---- Inline CSS used for both print window and preview modal ---- */
  _getInlineCss() {
    return [
      '@page { size: A4 landscape; margin: 0mm; }',
      'html,body { margin:0; padding:0; background:#fff !important; overflow:hidden; font-family:"Inter",Arial,Helvetica,sans-serif; color:#18364F; box-sizing:border-box; }',
      '* { -webkit-print-color-adjust:exact !important; color-adjust:exact !important; }',
      '.ir-document { font-family:"Inter",Arial,Helvetica,sans-serif; font-size:9px; line-height:1.4; color:#18364F; width:297mm; min-height:210mm; margin:0 auto; padding:8mm; background:#fff; box-sizing:border-box; border:none; position:relative; }',
      '/* ===== Header ===== */',
      '.ir-header { display:grid; grid-template-columns:1fr 1fr 1fr; align-items:center; gap:4mm; padding-bottom:4mm; border-bottom:2px solid #123F63; }',
      '.ir-header-title-col { display:flex; align-items:center; justify-content:center; }',
      '.ir-header-title-center { justify-content:center; }',
      '.ir-header-title-right { justify-content:flex-end; }',
      '.ir-header-logo { width:34mm; height:18mm; flex-shrink:0; display:flex; align-items:center; justify-content:center; }',
      '.ir-header-logo img { max-width:100%; max-height:100%; }',
      '.ir-company-block { display:flex; flex-direction:column; }',
      '.ir-company-name { font-size:12px; font-weight:700; color:#123F63; margin:0; }',
      '.ir-dept-name { font-size:8px; color:#60778C; margin:0; }',
      '.ir-tagline { font-size:7px; color:#60778C; font-style:italic; margin:0; }',
      '.ir-report-badge { background:#0B3150; color:#fff; padding:4mm 6mm; border-radius:3mm; text-align:center; }',
      '.ir-report-title { font-size:9px; font-weight:700; letter-spacing:1px; }',
      '.ir-report-subtitle { font-size:6px; margin-top:1px; opacity:0.85; }',
      '/* ===== QR Code ===== */',
      '.ir-qr-wrapper { display:flex; flex-direction:column; align-items:center; gap:1px; }',
      '.ir-qr-code { width:14mm; height:14mm; background:#fff; border:1px solid #C7D9E8; border-radius:2mm; }',
      '.ir-qr-label { font-size:5px; color:#60778C; text-align:center; }',
      '.ir-report-id { font-size:5px; color:#60778C; font-family:monospace; }',
      '/* ===== Info Panel ===== */',
      '.ir-info-panel { display:grid; grid-template-columns:1fr 1fr 1fr; gap:3mm; margin-bottom:6mm; align-items:start; }',
      '@media print { .ir-info-panel { grid-template-columns:1fr 1fr 1fr; } }',
      '.ir-panel { background:#fff; border:1px solid #C7D9E8; border-radius:3mm; padding:3mm; display:flex; flex-direction:column; height:100%; box-sizing:border-box; min-height:18mm; }',
      '.ir-panel-result { background:#F4F7FA; }',
      '.ir-panel-header { display:flex; align-items:center; gap:1mm; margin-bottom:2mm; flex-shrink:0; }',
      '.ir-panel-icon { font-size:8px; }',
      '.ir-panel-title { font-size:7px; font-weight:700; color:#123F63; margin:0; text-transform:uppercase; letter-spacing:0.05em; }',
      '.ir-panel-grid { display:grid; grid-template-columns:1fr; gap:1.5mm; flex:1; }',
      '.ir-panel-item { display:flex; flex-direction:column; gap:0.5mm; }',
      '.ir-panel-label { font-size:6px; color:#60778C; font-weight:600; }',
      '.ir-panel-value { font-size:7px; font-weight:600; color:#18364F; word-break:break-word; }',
      '.ir-panel-value.mono { font-family:monospace; }',
      '/* ===== Result Card ===== */',
      '.ir-result-card { display:flex; align-items:center; gap:1mm; padding:2mm 3mm; border-radius:2mm; font-weight:700; font-size:8px; text-transform:uppercase; letter-spacing:0.5px; margin-top:1mm; }',
      '.ir-result-ok { color:#20B879; background:#E6F4EA; border:1px solid #20B879; }',
      '.ir-result-ng { color:#DC3545; background:#FDECEC; border:1px solid #DC3545; }',
      '.ir-result-pending { color:#60778C; background:#EEF1F5; border:1px solid #C7D9E8; }',
      '.ir-result-icon { font-size:8px; }',
      '.ir-result-text { margin-left:1mm; }',
      '.ir-remarks-row { margin-top:2mm; font-size:6px; color:#60778C; }',
      '.ir-remarks-label { font-weight:600; }',
      '.ir-remarks-value { margin-left:1mm; }',
      '/* ===== Hardness Table ===== */',
      '.ir-table-section { margin-bottom:5mm; }',
      '.ir-table-title { font-size:8px; font-weight:700; color:#123F63; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2mm; }',
      '.ir-table-wrap { overflow-x:auto; }',
      '.ir-hardness-table { width:100%; border-collapse:collapse; font-size:8px; table-layout:auto; }',
      '.ir-hardness-table th { padding:2px 3px; text-align:center; font-weight:700; }',
      '.ir-hardness-table td { padding:2px 3px; text-align:center; }',
      '.ir-thead-main th { background:#0B3150; color:#fff; font-size:7px; }',
      '.ir-thead-sub th { background:#2E6E9E; color:#fff; font-size:6px; }',
      '.ir-thead-sub th:first-child, .ir-thead-sub th:nth-child(2) { background:#DCEAF6; color:#123F63; }',
      '.ir-hardness-table tbody tr:nth-child(odd) { background:#fff; }',
      '.ir-hardness-table tbody tr:nth-child(even) { background:#F4F7FA; }',
      '.ir-cell-num { font-weight:600; color:#123F63; width:5mm; }',
      '.ir-cell-tp { width:10mm; }',
      '.ir-cell-val { width:11mm; }',
      '.ir-cell-result { width:9mm; }',
      '.ir-summary-row td { border-top:1px solid #C7D9E8; }',
      '.ir-summary-label { font-weight:700; color:#123F63; text-align:left; width:16mm; }',
      '.ir-summary-empty { width:5mm; }',
      '.ir-tiny-badge { display:inline-block; padding:0.5mm 2mm; border-radius:1.5mm; font-size:6px; font-weight:700; text-transform:uppercase; }',
      '.ir-tiny-badge.ok { color:#20B879; background:#E6F4EA; border:1px solid #20B879; }',
      '.ir-tiny-badge.ng { color:#DC3545; background:#FDECEC; border:1px solid #DC3545; }',
      '.ir-tiny-badge.pending { color:#60778C; background:#EEF1F5; border:1px solid #C7D9E8; }',
      '/* ===== Standards ===== */',
      '.ir-standards { border:1px solid #C7D9E8; border-radius:3mm; margin-bottom:6mm; overflow:hidden; }',
      '.ir-standards-table { width:100%; border-collapse:collapse; font-size:8px; }',
      '.ir-standards-table td { padding:2mm 3mm; border-bottom:1px solid #C7D9E8; }',
      '.ir-standards-table td:last-child { border-bottom:none; }',
      '.ir-std-label { width:30%; color:#60778C; font-weight:600; }',
      '.ir-std-value { width:70%; color:#18364F; font-weight:600; }',
      '.ir-std-value.mono { font-family:monospace; }',
      '/* ===== Approval ===== */',
      '.ir-approval-section { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; margin-bottom:6mm; }',
      '.ir-approval-card { background:#fff; border:1px solid #C7D9E8; border-radius:3mm; padding:3mm; display:flex; flex-direction:column; align-items:center; text-align:center; }',
      '.ir-approval-header { display:flex; align-items:center; gap:1mm; margin-bottom:2mm; }',
      '.ir-approval-icon { font-size:7px; }',
      '.ir-approval-role { font-size:6px; font-weight:700; color:#0B3150; letter-spacing:0.5px; }',
      '.ir-approval-name { font-size:7px; font-weight:700; color:#18364F; margin:1mm 0; }',
      '.ir-approval-date { font-size:6px; color:#60778C; margin-bottom:1mm; }',
      '.ir-signature-box { width:100%; height:8mm; border:1px dashed #C7D9E8; border-radius:2mm; display:flex; align-items:center; justify-content:center; margin-bottom:1mm; background:#F4F7FA; }',
      '.ir-sig-image { max-height:6mm; max-width:26mm; }',
      '.ir-sig-placeholder { font-size:5px; color:#60778C; }',
      '.ir-approval-title { font-size:6px; color:#2E6E9E; font-weight:600; margin-bottom:1mm; }',
      '.ir-approval-badge { display:inline-block; padding:0.5mm 3mm; border-radius:1.5mm; font-size:6px; font-weight:700; text-transform:uppercase; }',
      '.ir-badge-ok { color:#20B879; background:#E6F4EA; border:1px solid #20B879; }',
      '.ir-badge-incomplete { color:#DC3545; background:#FDECEC; border:1px solid #DC3545; }',
      '/* ===== Supervisor Notes ===== */',
      '.ir-sup-notes { font-size:6px; color:#18364F; padding:2mm 3mm; background:#F4F7FA; border:1px solid #C7D9E8; border-radius:2mm; margin-bottom:6mm; }',
      '/* ===== Footer ===== */',
      '.ir-footer { display:flex; justify-content:space-between; align-items:center; padding-top:2mm; border-top:1px solid #C7D9E8; font-size:6px; color:#60778C; }',
      '.ir-footer-left { display:flex; align-items:center; gap:1mm; }',
      '.ir-footer-left span { display:inline; }',
      '.ir-footer-right { display:flex; align-items:center; gap:3mm; }',
      '.ir-footer-report-id { font-family:monospace; font-weight:600; color:#60778C; }',
      '.ir-footer-page { color:#60778C; }',
      '/* ===== Print & Responsive ===== */',
      '@media print { html,body { background:#fff !important; } .ir-document { padding:6mm; width:297mm; height:210mm; } .ir-info-panel { grid-template-columns:1fr 1fr 1fr; } .ir-approval-section { grid-template-columns:repeat(3,1fr); } }',
      '@media screen and (max-width:768px) { .ir-header { grid-template-columns:1fr; text-align:center; } .ir-header-title-col { justify-content:center; } .ir-info-panel { grid-template-columns:1fr; gap:2mm; } .ir-approval-section { grid-template-columns:1fr; gap:2mm; } }',
    ].join("\n");
  },

  /* ---- Generate complete HTML document for print window ----
      All CSS is inlined so it resolves in the about:blank print window. */
  generateInlineDocument(material, qc, judge, ext, production) {
    var docContent = this.generateDocumentHtml(material, qc, judge, ext, production);
    var reportNo = this.state.reportNumber || "-";
    var reportUrl = this.state.reportUrl || "";
    var css = this._getInlineCss();

    var html = '<!doctype html><html><head>' +
      '<meta charset="UTF-8">' +
      '<title>Inspection Report - ' + reportNo + '</title>' +
      '<style>' + css + '</style>' +
      '</head><body>' +
      docContent +
      '<script>' +
        'var url = "' + reportUrl + '";' +
        'if (url) {' +
          'var qrDivs = document.querySelectorAll("#docQrCode");' +
          'qrDivs.forEach(function(el) {' +
            'el.innerHTML = "";' +
            'if (typeof parent.QRCode !== "undefined") {' +
              'new parent.QRCode(el, { text: url, width: 56, height: 56, colorDark: "#0B3150", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });' +
            '} else if (typeof QRCode !== "undefined") {' +
              'new QRCode(el, { text: url, width: 56, height: 56, colorDark: "#0B3150", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });' +
            '} else {' +
              'el.innerHTML = "<span style=\"font-size:5px;color:#DC3545\">QR Code unavailable</span>";' +
            '}' +
          '});' +
        '}' +
      '<\/script>' +
      '</body></html>';

    return html;
  },
};
