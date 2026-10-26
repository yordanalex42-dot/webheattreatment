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
     Layout industri: Header, Metadata, Inspection Info + Schematics,
     Hardness Results, Standards/Criteria, Signatures. */
  generateDocumentHtml(material, qc, judg, ext, production) {
    var part = material.part_id ? DB.findPartById(material.part_id) : null;
    var customer = material.customer_id ? DB.findCustomerById(material.customer_id) : null;
    var reportNo = this.state.reportNumber || "-";
    var satuan = (ext && ext.satuan_hardness) || (qc && qc.satuan_hardness) || "HRC";

    /* Before QC */
    var beforeQc = this._getBeforeQc(material);
    var beforeExt = beforeQc ? DB._parseQCRemarks(beforeQc) : null;

    /* Surface / core values (after QC) */
    var surfaceValues = (ext && ext.surface_values) || [];
    var coreValues = (ext && ext.core_values) || [];
    var surfaceStats = this.calcStats(surfaceValues);
    var coreStats = this.calcStats(coreValues);

    /* Helper untuk nilai atau "—" */
    var f = this._fmt.bind(this);
    var fd = this._fmtDate.bind(this);

    /* Build hardness table rows (12 rows) */
    var surfaceRows = "";
    var maxRows = Math.max(surfaceValues.length, coreValues.length, 12);
    for (var i = 0; i < maxRows; i++) {
      var sv = (i < surfaceValues.length && surfaceValues[i] != null) ? surfaceValues[i] : "-";
      var cv = (i < coreValues.length && coreValues[i] != null) ? coreValues[i] : "-";
      surfaceRows += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td class="mono">' + sv + '</td>' +
        '<td class="mono">' + cv + '</td>' +
      '</tr>';
    }

    /* Stats rows */
    var surfaceAvgStr = surfaceStats.avg != null ? surfaceStats.avg : "-";
    var coreAvgStr = coreStats.avg != null ? coreStats.avg : "-";
    var surfaceRStr = surfaceStats.r != null ? surfaceStats.r : "-";
    var coreRStr = coreStats.r != null ? coreStats.r : "-";

    /* Target hardness */
    var targetHardness = (part && part.target_hardness) ? part.target_hardness : "—";

    /* Result badge */
    var hasil = (qc && qc.hasil) ? qc.hasil.toUpperCase() : "—";
    var resultClass = (qc && qc.hasil === "OK") ? "ir-result-ok" : "ir-result-ng";
    var resultBadge = '<span class="ir-result-badge ' + resultClass + '">' + hasil + '</span>';

    /* Temperature info */
    var tempActual = production.actual_temperature != null ? production.actual_temperature + "°C" : "—";
    var tempMin = production.temperature_min != null ? production.temperature_min + "°C" : "—";
    var tempMax = production.temperature_max != null ? production.temperature_max + "°C" : "—";

    /* Microstructure */
    var microstructure = (qc && qc.microstructure) ? qc.microstructure : "—";

    /* Build the document */
    var html = '<div class="ir-document">' +

      /* ---- Header ---- */
      '<div class="ir-header">' +
        '<div class="ir-header-logo">' +
          '<img src="assets/logo/logo baru.svg" alt="PT CHUNETSU INDONESIA" />' +
        '</div>' +
        '<div class="ir-company-block">' +
          '<p class="ir-company-name">PT CHUNETSU INDONESIA</p>' +
          '<p class="ir-dept-name">HEAT TREATMENT DEPARTMENT</p>' +
          '<p class="ir-doc-title">QUALITY RECORD — INSPECTION SHEET</p>' +
        '</div>' +
        '<div class="ir-report-no">No. ' + f(reportNo) + '</div>' +
      '</div>' +

      /* ---- Metadata ---- */
      '<div class="ir-meta">' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Report No.</span><span class="ir-meta-value mono">' + f(reportNo) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Inspection Date</span><span class="ir-meta-value">' + fd(qc && qc.tanggal_inspector) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Customer</span><span class="ir-meta-value">' + f(customer ? customer.nama_customer : null) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Work Order No.</span><span class="ir-meta-value mono">' + f(material.nomor_surat_jalan) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Control Number</span><span class="ir-meta-value mono">' + f(material.kode) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Part Name</span><span class="ir-meta-value">' + f(part ? part.nama_part : null) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Part Number</span><span class="ir-meta-value mono">' + f(part ? part.nomor_part : null) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Material Grade</span><span class="ir-meta-value mono">' + f(material.material_charge) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Heat Number / Batch</span><span class="ir-meta-value mono">' + f(material.lot_no) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Quantity (pcs)</span><span class="ir-meta-value mono">' + f(material.qty || 0) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Process Type</span><span class="ir-meta-value">' + f(production.jenis_treatment || material.process_type) + '</span></div>' +
        '<div class="ir-meta-item"><span class="ir-meta-label">Hardness Scale</span><span class="ir-meta-value mono">' + f(satuan) + '</span></div>' +
      '</div>' +

      /* ---- A. Inspection Info + Schematics ---- */
      '<div class="ir-section">' +
        '<span class="ir-section-title">A. INSPECTION INFORMATION</span>' +
        '<div class="ir-inspection-info">' +
          '<div>' +
            '<div class="ir-inspection-meta">' +
              '<div class="ir-meta-item"><span class="ir-meta-label">Before HT — Inspector</span><span class="ir-meta-value">' + f(beforeQc ? beforeQc.inspector : null) + '</span></div>' +
              '<div class="ir-meta-item"><span class="ir-meta-label">Before HT — Date</span><span class="ir-meta-value">' + fd(beforeQc ? beforeQc.tanggal_inspector : null) + '</span></div>' +
              '<div class="ir-meta-item"><span class="ir-meta-label">After HT — Inspector</span><span class="ir-meta-value">' + f(qc ? qc.inspector : null) + '</span></div>' +
              '<div class="ir-meta-item"><span class="ir-meta-label">After HT — Date</span><span class="ir-meta-value">' + fd(qc ? qc.tanggal_inspector : null) + '</span></div>' +
              '<div class="ir-meta-item"><span class="ir-meta-label">Microstructure</span><span class="ir-meta-value">' + f(microstructure) + '</span></div>' +
              '<div class="ir-meta-item"><span class="ir-meta-label">Process Temp. (actual)</span><span class="ir-meta-value mono">' + f(tempActual) + '</span></div>' +
              '<div class="ir-meta-item"><span class="ir-meta-label">Temp. Range (min–max)</span><span class="ir-meta-value mono">' + f(tempMin) + ' — ' + f(tempMax) + '</span></div>' +
              '<div class="ir-meta-item"><span class="ir-meta-label">Process Result</span><span class="ir-meta-value">' + f(production ? production.process_result : null) + '</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="ir-schematic">' +
            this._schematicSvg("surface") +
            '<span class="ir-schematic-label">Surface Measurement Points</span>' +
          '</div>' +
          '<div class="ir-schematic">' +
            this._schematicSvg("core") +
            '<span class="ir-schematic-label">Core Measurement Points</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ---- B. Hardness Results ---- */
      '<div class="ir-section">' +
        '<span class="ir-section-title">B. HARDENSS RESULTS</span>' +
        '<table class="ir-hardness-table">' +
          '<thead><tr><th>No.</th><th>Surface Hardness (' + satuan + ')</th><th>Core Hardness (' + satuan + ')</th></tr></thead>' +
          '<tbody>' + surfaceRows + '</tbody>' +
        '</table>' +
        '<div class="ir-stats-row">' +
          '<div class="ir-meta-item"><span class="ir-meta-label">Average Surface</span><span class="ir-meta-value mono">' + f(surfaceAvgStr) + '</span></div>' +
          '<div class="ir-meta-item"><span class="ir-meta-label">Average Core</span><span class="ir-meta-value mono">' + f(coreAvgStr) + '</span></div>' +
          '<div class="ir-meta-item"><span class="ir-meta-label">R Surface (Max−Min)</span><span class="ir-meta-value mono">' + f(surfaceRStr) + '</span></div>' +
          '<div class="ir-meta-item"><span class="ir-meta-label">R Core (Max−Min)</span><span class="ir-meta-value mono">' + f(coreRStr) + '</span></div>' +
        '</div>' +
      '</div>' +

      /* ---- C. Standards & Criteria ---- */
      '<div class="ir-section">' +
        '<span class="ir-section-title">C. STANDARDS &amp; CRITERIA</span>' +
        '<div class="ir-standards">' +
          '<table class="ir-standards-table">' +
            '<tr><td class="ir-standards-label">Target Hardness</td><td class="ir-standards-value mono">' + f(targetHardness) + '</td></tr>' +
            '<tr><td class="ir-standards-label">Hardness Unit</td><td class="ir-standards-value mono">' + f(satuan) + '</td></tr>' +
            '<tr><td class="ir-standards-label">Hardness Criterion</td><td class="ir-standards-value">Per ASME B18.2.1 / ASTM A310</td></tr>' +
            '<tr><td class="ir-standards-label">Measurement Method</td><td class="ir-standards-value">Rockwell / Vickers Hardness Tester</td></tr>' +
            '<tr><td class="ir-standards-label">Final Inspection Result</td><td class="ir-standards-value">' + resultBadge + '</td></tr>' +
          '</table>' +
        '</div>' +
      '</div>' +

      /* ---- D. Signatures ---- */
      '<div class="ir-section">' +
        '<span class="ir-section-title">D. APPROVAL &amp; SIGNATURES</span>' +
        '<div class="ir-signatures">' +
          '<div class="ir-sig-cell">' +
            '<p class="ir-sig-name">INSPECTED BY</p>' +
            '<p class="ir-sig-title">Inspector QC</p>' +
            this._sigImg(ext ? ext.signature : null) +
            '<p class="ir-sig-name">' + f(qc ? qc.inspector : null) + '</p>' +
            '<p class="ir-sig-date">' + fd(qc ? qc.tanggal_inspector : null) + '</p>' +
          '</div>' +
          '<div class="ir-sig-cell">' +
            '<p class="ir-sig-name">REVIEWED BY</p>' +
            '<p class="ir-sig-title">Leader QC</p>' +
            this._sigImg(qc ? qc.leader_signature : null) +
            '<p class="ir-sig-name">' + f(qc ? qc.leader_name : null) + '</p>' +
            '<p class="ir-sig-date">' + fd(qc ? qc.leader_date : null) + '</p>' +
          '</div>' +
          '<div class="ir-sig-cell">' +
            '<p class="ir-sig-name">APPROVED BY</p>' +
            '<p class="ir-sig-title">Supervisor QC</p>' +
            this._sigImg(qc ? qc.supervisor_signature : null) +
            '<p class="ir-sig-name">' + f(qc ? qc.supervisor_name : null) + '</p>' +
            '<p class="ir-sig-date">' + fd(qc ? qc.supervisor_date : null) + '</p>' +
          '</div>' +
        '</div>' +
        (qc && qc.supervisor_notes ? '<div class="ir-sup-notes"><strong>Supervisor Notes:</strong> ' + qc.supervisor_notes + '</div>' : '') +
      '</div>' +

      '<div class="ir-footer">' +
        '<p>PT CHUNETSU INDONESIA — Heat Treatment Department | Quality Record — Inspection Sheet</p>' +
        '<div class="ir-footer-qr" id="docQrCode"></div>' +
      '</div>' +
    '</div>';

    return html;
  },

  /* ---- Show document preview ---- */
  showPreview() {
    var material = this.state.currentMaterial;
    var qc = this.state.currentQc;
    var judge = this.state.currentJudge;
    var ext = this.state.currentExt;
    var production = DB.getProcessProduction(material, "HT") || {};

    var html = this.generateDocumentHtml(material, qc, judge, ext, production);
    var body = document.getElementById("documentPreviewBody");
    body.innerHTML = html;

    /* Generate QR code for the document */
    setTimeout(function () {
      var qrDiv = document.getElementById("docQrCode");
      if (qrDiv && typeof QRCode !== "undefined") {
        qrDiv.innerHTML = "";
        new QRCode(qrDiv, {
          text: material.kode || "",
          width: 80,
          height: 80,
          colorDark: "#0F172A",
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
     All CSS is inlined so it resolves in the about:blank print window. */
  generateInlineDocument(material, qc, judge, ext, production) {
    var docContent = this.generateDocumentHtml(material, qc, judge, ext, production);
    var reportNo = this.state.reportNumber || "-";

    var css = [
      '@page { size: A4 landscape; margin: 0mm; }',
      'html,body { margin:0; padding:0; background:#fff !important; overflow:hidden; font-family:Arial,Helvetica,sans-serif; color:#0f172a; box-sizing:border-box; }',
      '* { -webkit-print-color-adjust:exact !important; color-adjust:exact !important; }',
      '.ir-document { font-family:Arial,Helvetica,sans-serif; font-size:9px; line-height:1.4; color:#0f172a; width:297mm; min-height:210mm; margin:0 auto; padding:4mm; background:#fff; box-sizing:border-box; border:none; }',
      '.ir-header { display:flex; align-items:center; gap:10px; margin-bottom:6mm; padding-bottom:4mm; border-bottom:2px solid #0f172a; }',
      '.ir-header-logo { width:36mm; height:36mm; flex-shrink:0; display:flex; align-items:center; justify-content:center; border:1px solid #d1d9e6; padding:4px; }',
      '.ir-header-logo img { max-width:100%; max-height:100%; }',
      '.ir-company-block { flex:1; }',
      '.ir-company-name { font-size:14px; font-weight:700; color:#0f172a; margin:0; }',
      '.ir-dept-name { font-size:10px; color:#64748b; margin:1px 0; }',
      '.ir-doc-title { font-size:12px; font-weight:700; color:#0f172a; margin-top:2px; }',
      '.ir-report-no { font-size:9px; font-family:monospace; font-weight:600; color:#64748b; text-align:right; flex-shrink:0; }',
      '.ir-meta { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; margin-bottom:6mm; border:1px solid #d1d9e6; background:#f1f5f9; }',
      '.ir-meta-item { display:flex; flex-direction:column; padding:2px 4px; border-right:1px solid #d1d9e6; border-bottom:1px solid #d1d9e6; background:#fff; }',
      '.ir-meta-item:nth-child(4n) { border-right:none; }',
      '.ir-meta-item:last-child { border-bottom:none; }',
      '.ir-meta-label { font-size:8px; color:#64748b; font-weight:600; margin-bottom:1px; }',
      '.ir-meta-value { font-size:9px; font-weight:600; color:#0f172a; }',
      '.ir-meta-value.mono { font-family:monospace; }',
      '.ir-section { margin-bottom:6mm; }',
      '.ir-section-title { font-size:10px; font-weight:700; color:#0f172a; margin-bottom:2mm; padding:1px 4px; background:#f1f5f9; border-left:3px solid #0f172a; display:inline-block; }',
      '.ir-inspection-info { display:grid; grid-template-columns:1fr auto auto; gap:4mm; align-items:start; margin-bottom:6mm; }',
      '.ir-inspection-info div:first-child { width:100%; }',
      '.ir-inspection-meta { display:grid; grid-template-columns:repeat(2,1fr); gap:1px; border:1px solid #d1d9e6; background:#f1f5f9; }',
      '.ir-inspection-meta .ir-meta-item { border-right:1px solid #d1d9e6; border-bottom:1px solid #d1d9e6; background:#fff; }',
      '.ir-inspection-meta .ir-meta-item:nth-child(2n) { border-right:none; }',
      '.ir-inspection-meta .ir-meta-item:last-child { border-bottom:none; }',
      '.ir-schematic { width:50mm; height:50mm; flex-shrink:0; display:flex; flex-direction:column; align-items:center; }',
      '.ir-schematic svg { width:100%; height:auto; display:block; }',
      '.ir-schematic-label { font-size:8px; color:#64748b; text-align:center; margin-top:1mm; }',
      '.ir-hardness-table { width:100%; border-collapse:collapse; font-size:9px; margin-bottom:4mm; }',
      '.ir-hardness-table th,.ir-hardness-table td { border:1px solid #d1d9e6; padding:2px 4px; text-align:center; }',
      '.ir-hardness-table th { background:#f1f5f9; font-weight:700; color:#0f172a; font-size:8px; }',
      '.ir-hardness-table td.mono { font-family:monospace; font-weight:600; }',
      '.ir-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; margin-top:4mm; border:1px solid #d1d9e6; background:#f1f5f9; }',
      '.ir-stats-row .ir-meta-item { border-right:1px solid #d1d9e6; border-bottom:1px solid #d1d9e6; background:#fff; }',
      '.ir-stats-row .ir-meta-item:nth-child(4n) { border-right:none; }',
      '.ir-stats-row .ir-meta-item:last-child { border-bottom:none; }',
      '.ir-standards { border:1px solid #d1d9e6; background:#f1f5f9; margin-bottom:6mm; }',
      '.ir-standards-table { width:100%; border-collapse:collapse; font-size:9px; }',
      '.ir-standards-table td { padding:2px 4px; border-bottom:1px solid #d1d9e6; }',
      '.ir-standards-table td:last-child { border-bottom:none; }',
      '.ir-standards-label { font-size:8px; color:#64748b; font-weight:600; width:30%; }',
      '.ir-standards-value { font-size:9px; font-weight:600; color:#0f172a; width:70%; }',
      '.ir-standards-value.mono { font-family:monospace; }',
      '.ir-result-badge { display:inline-block; padding:1px 8px; border-radius:2px; font-size:9px; font-weight:700; font-family:monospace; }',
      '.ir-result-ok { color:#15803d; border:1px solid #16a34a; background:#dcfce7; }',
      '.ir-result-ng { color:#b91c1c; border:1px solid #ef4444; background:#fee2e2; }',
      '.ir-signatures { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; margin-top:4mm; border:1px solid #d1d9e6; }',
      '.ir-sig-cell { display:flex; flex-direction:column; align-items:center; text-align:center; padding:4mm 2mm; border-right:1px solid #d1d9e6; border-bottom:1px solid #d1d9e6; background:#fff; }',
      '.ir-sig-cell:nth-child(3n) { border-right:none; }',
      '.ir-sig-cell:last-child { border-bottom:none; }',
      '.ir-sig-line { width:100%; height:1px; background:#d1d9e6; margin:6mm 0 3mm 0; }',
      '.ir-sig-image { max-height:12mm; max-width:30mm; display:block; margin:2mm 0; }',
      '.ir-sig-placeholder { display:inline-block; padding:3mm 2mm; border:1px dashed #d1d9e6; font-size:8px; color:#64748b; text-align:center; margin:2mm 0; }',
      '.ir-sig-name { font-size:9px; font-weight:600; margin:1mm 0; }',
      '.ir-sig-title { font-size:8px; color:#64748b; margin:1mm 0; }',
      '.ir-sig-date { font-size:8px; color:#64748b; margin:1mm 0; }',
      '.ir-sup-notes { font-size:8px; color:#0f172a; margin-top:2mm; padding:2mm 4px; background:#f1f5f9; }',
      '.ir-footer { margin-top:6mm; padding-top:2mm; border-top:1px solid #d1d9e6; font-size:7px; color:#64748b; text-align:center; }',
      '.ir-footer-qr { display:inline-block; width:16mm; height:16mm; background:#fff; border:1px solid #d1d9e6; padding:1mm; vertical-align:middle; margin-right:3mm; }',
      '@media print { html,body { margin:0; padding:0; background:#fff !important; overflow:hidden; font-family:Arial,Helvetica,sans-serif; } .ir-document { border:none; padding:4mm; width:297mm; height:210mm; box-sizing:border-box; } body { background:#fff !important; } }',
      '.ht-sidebar,.ht-header,.ht-ir-actions,.ht-ir-scanner-row,.ht-ir-summary-grid,.ht-ir-approval-flow,.ht-ir-issue-list,.ht-ir-status-badge,.ht-empty-icon { display:none !important; }',
    ].join(" ");

    var html = '<!doctype html><html><head>' +
      '<meta charset="UTF-8">' +
      '<title>Inspection Report - ' + reportNo + '</title>' +
      '<style>' + css + '</style>' +
      '</head><body>' +
      docContent +
      '<script>' +
        'window.addEventListener("DOMContentLoaded", function() {' +
          'var qrDiv = document.getElementById("docQrCode");' +
          'if (qrDiv && typeof parent.QRCode !== "undefined") {' +
            'qrDiv.innerHTML = "";' +
            'new parent.QRCode(qrDiv, {' +
              'text: "' + (material.kode || "") + '",' +
              'width: 60, height: 60, colorDark: "#0F172A", colorLight: "#ffffff"' +
            '});' +
          '}' +
        '});' +
      '</script>' +
      '</body></html>';

    return html;
  },
};
