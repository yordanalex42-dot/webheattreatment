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

  /* ---- Generate document HTML ---- */
  generateDocumentHtml(material, qc, judge, ext, production) {
    var part = material.part_id ? DB.findPartById(material.part_id) : null;
    var customer = material.customer_id ? DB.findCustomerById(material.customer_id) : null;
    var reportNo = this.state.reportNumber;

    var surfaceValues = (ext && ext.surface_values) || [];
    var coreValues = (ext && ext.core_values) || [];
    var validSurface = surfaceValues.filter(function (v) { return v != null && !isNaN(v); });
    var validCore = coreValues.filter(function (v) { return v != null && !isNaN(v); });

    var surfaceAvg = validSurface.length > 0
      ? (validSurface.reduce(function (a, b) { return a + b; }, 0) / validSurface.length).toFixed(1)
      : "-";
    var coreAvg = validCore.length > 0
      ? (validCore.reduce(function (a, b) { return a + b; }, 0) / validCore.length).toFixed(1)
      : "-";

    var hardnessValues = validSurface.length > 0 ? surfaceAvg : (validCore.length > 0 ? coreAvg : "-");
    var satuan = qc.satuan_hardness || "HRC";

    /* Format signature image helper */
    var sigImg = function (sig) {
      if (!sig) return '<span class="ir-sig-placeholder">Tidak tersedia</span>';
      return '<img src="' + sig + '" class="ir-sig-image" alt="Tanda Tangan" />';
    };

    /* Format date */
    var fmtDate = function (d) {
      if (!d) return "-";
      return formatDateLong(d);
    };

    /* Build surface values table rows */
    var surfaceRows = "";
    for (var i = 0; i < 12; i++) {
      var sv = (i < surfaceValues.length && surfaceValues[i] != null) ? surfaceValues[i] : "-";
      var cv = (i < coreValues.length && coreValues[i] != null) ? coreValues[i] : "-";
      surfaceRows += '<tr><td class="ir-td-center">' + (i + 1) + '</td><td class="ir-td-center">' + sv + '</td><td class="ir-td-center">' + cv + '</td></tr>';
    }

    /* Build specification / drawing info from part */
    var specInfo = part ? (part.nomor_part || "-") : "-";
    var drawingNo = part ? (part.nomor_part || "-") : "-";
    var materialGrade = material.material_charge || "-";
    var hardnessScale = satuan || "HRC";

    /* QR code container */
    var qrContainerId = "docQrCode";
    var qrCode = material.kode || "-";

    /* Temperature info */
    var tempActual = production.actual_temperature || "-";
    var tempRecord = production.temperature_result || "-";
    var tempMin = production.temperature_min || "-";
    var tempMax = production.temperature_max || "-";

    /* Build the document */
    var html = '<div class="ir-document">' +
      '<div class="ir-doc-header">' +
        '<div class="ir-company-logo">' +
          '<img src="assets/logo/logo baru.svg" alt="PT CHUNETSU INDONESIA" class="ir-logo" />' +
        '</div>' +
        '<div class="ir-company-info">' +
          '<h1 class="ir-company-name">PT CHUNETSU INDONESIA</h1>' +
          '<p class="ir-dept-name">HEAT TREATMENT DEPARTMENT</p>' +
          '<p class="ir-doc-title">FINAL INSPECTION REPORT</p>' +
        '</div>' +
      '</div>' +

      '<div class="ir-doc-meta">' +
        '<table class="ir-meta-table">' +
          '<tr><td class="ir-meta-label">Report No.</td><td class="ir-meta-value">' + reportNo + '</td>' +
          '<td class="ir-meta-label">Inspection Date</td><td class="ir-meta-value">' + fmtDate(qc.tanggal_inspector) + '</td></tr>' +
          '<tr><td class="ir-meta-label">Customer</td><td class="ir-meta-value">' + (customer ? customer.nama_customer : "-") + '</td>' +
          '<td class="ir-meta-label">Work Order No.</td><td class="ir-meta-value">' + (material.nomor_surat_jalan || "-") + '</td></tr>' +
          '<tr><td class="ir-meta-label">Control Number / Material Code</td><td class="ir-meta-value mono">' + (material.kode || "-") + '</td>' +
          '<td class="ir-meta-label">Part Name</td><td class="ir-meta-value">' + (part ? part.nama_part : "-") + '</td></tr>' +
          '<tr><td class="ir-meta-label">Material Grade</td><td class="ir-meta-value mono">' + materialGrade + '</td>' +
          '<td class="ir-meta-label">Heat Number / Batch</td><td class="ir-meta-value mono">' + (material.lot_no || "-") + '</td></tr>' +
          '<tr><td class="ir-meta-label">Quantity</td><td class="ir-meta-value">' + (material.qty || 0) + '</td>' +
          '<td class="ir-meta-label">Specification / Drawing No.</td><td class="ir-meta-value mono">' + specInfo + '</td></tr>' +
          '<tr><td class="ir-meta-label">Jenis Proses</td><td class="ir-meta-value">' + (production.jenis_treatment || material.process_type || "-") + '</td>' +
          '<td class="ir-meta-label">Hardness Scale</td><td class="ir-meta-value">' + hardnessScale + '</td></tr>' +
        '</table>' +
      '</div>' +

      '<div class="ir-section">' +
        '<h2 class="ir-section-title">A. Hasil Pemeriksaan Hardness</h2>' +
        '<table class="ir-hardsness-table">' +
          '<thead><tr><th class="ir-th">No.</th><th class="ir-th">Surface Hardness</th><th class="ir-th">Core Hardness</th><th class="ir-th">Satuan</th></tr></thead>' +
          '<tbody>' + surfaceRows + '</tbody>' +
          '<tfoot>' +
            '<tr><td class="ir-td-center" colspan="1"><strong>Rata-rata</strong></td>' +
            '<td class="ir-td-center mono"><strong>' + surfaceAvg + '</strong></td>' +
            '<td class="ir-td-center mono"><strong>' + coreAvg + '</strong></td>' +
            '<td class="ir-td-center"><strong>' + satuan + '</strong></td></tr>' +
          '</tfoot>' +
        '</table>' +
        '<div class="ir-hardness-summary">' +
          '<p>Nilai Hardness Aktual (rata-rata): <strong class="mono">' + hardnessValues + ' ' + satuan + '</strong></p>' +
          '<p>Target Hardness: <strong>' + (part && part.target_hardness ? part.target_hardness : "-") + '</strong></p>' +
          '<p>Hasil Akhir Inspeksi: <strong class="mono ' + (qc.hasil === "OK" ? "ir-result-ok" : "ir-result-ng") + '">' + (qc.hasil || "-") + '</strong></p>' +
          (qc.catatan ? '<p>Catatan Inspeksi: ' + qc.catatan + '</p>' : '') +
        '</div>' +
      '</div>' +

      '<div class="ir-section">' +
        '<h2 class="ir-section-title">B. Persetujuan dan Tanda Tangan</h2>' +
        '<table class="ir-signature-table">' +
          '<tr>' +
            '<td class="ir-sig-cell">' +
              '<p class="ir-sig-label"><strong>Inspected By — Inspector QC</strong></p>' +
              sigImg(ext ? ext.signature : null) +
              '<p class="ir-sig-name">' + (qc.inspector || "-") + '</p>' +
              '<p class="ir-sig-title">Inspector QC</p>' +
              '<p class="ir-sig-date">' + fmtDate(qc.tanggal_inspector) + '</p>' +
            '</td>' +
            '<td class="ir-sig-cell">' +
              '<p class="ir-sig-label"><strong>Reviewed By — Leader QC</strong></p>' +
              sigImg(qc.leader_signature) +
              '<p class="ir-sig-name">' + (qc.leader_name || "-") + '</p>' +
              '<p class="ir-sig-title">Leader QC</p>' +
              '<p class="ir-sig-date">' + fmtDate(qc.leader_date) + '</p>' +
            '</td>' +
            '<td class="ir-sig-cell">' +
              '<p class="ir-sig-label"><strong>Approved By — Supervisor QC</strong></p>' +
              sigImg(qc.supervisor_signature) +
              '<p class="ir-sig-name">' + (qc.supervisor_name || "-") + '</p>' +
              '<p class="ir-sig-title">Supervisor QC</p>' +
              '<p class="ir-sig-date">' + fmtDate(qc.supervisor_date) + '</p>' +
            '</td>' +
          '</tr>' +
        '</table>' +
        (qc.supervisor_notes ? '<p class="ir-sup-notes"><strong>Catatan Supervisor:</strong> ' + qc.supervisor_notes + '</p>' : '') +
      '</div>' +

      '<div class="ir-section">' +
        '<h2 class="ir-section-title">C. Informasi Tambahan</h2>' +
        '<table class="ir-info-table">' +
          '<tr><td class="ir-info-label">Microstructure</td><td class="ir-info-value">' + (qc.microstructure || "-") + '</td>' +
          '<td class="ir-info-label">Material Charge</td><td class="ir-info-value mono">' + (material.material_charge || "-") + '</td></tr>' +
          '<tr><td class="ir-info-label">No. Surat Jalan</td><td class="ir-info-value mono">' + (material.nomor_surat_jalan || "-") + '</td>' +
          '<td class="ir-info-label">Berat Part</td><td class="ir-info-value">' + (material.berat_part_snapshot ? material.berat_part_snapshot + " " + (material.satuan_berat || "KG") : "-") + '</td></tr>' +
          '<tr><td class="ir-info-label">Suhu Aktual</td><td class="ir-info-value mono">' + tempActual + '°C</td>' +
          '<td class="ir-info-label">Rentang Suhu</td><td class="ir-info-value mono">' + tempMin + '°C - ' + tempMax + '°C</td></tr>' +
        '</table>' +
      '</div>' +

      '<div class="ir-doc-footer">' +
        '<p class="ir-footer-text">Dokumen ini adalah laporan inspeksi final yang sah dan telah disetujui secara resmi.</p>' +
        '<div class="ir-footer-qr">' +
          '<div id="' + qrContainerId + '" class="ir-footer-qr-code"></div>' +
          '<p class="ir-footer-qr-label">Kode Material: ' + qrCode + '</p>' +
        '</div>' +
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
          width: 120,
          height: 120,
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

  /* ---- Generate complete HTML document for print window ---- */
  generateInlineDocument(material, qc, judge, ext, production) {
    var docContent = this.generateDocumentHtml(material, qc, judge, ext, production);
    var reportNo = this.state.reportNumber;

    /* Build absolute CSS URLs so they resolve in the about:blank print window */
    var base = window.location.protocol + "//" + window.location.host;
    var cssLinks = [
      base + "/css/global.css",
      base + "/css/report-center.css",
    ];

    var html = '<!doctype html><html lang="en"><head>' +
      '<meta charset="UTF-8">' +
      '<title>Inspection Report - ' + reportNo + '</title>' +
      cssLinks.map(function (href) { return '<link rel="stylesheet" href="' + href + '" />'; }).join("") +
      '<style>' +
        '@page { size: A4 landscape; margin: 0mm; }' +
        'body { font-family: "Inter", sans-serif; background: white; color: #0f172a; margin: 0; padding: 0; }' +
        '.ir-document { max-width: 100%; width: 297mm; height: 210mm; box-sizing: border-box; }' +
        '.ir-sig-image { max-height: 80px; max-width: 180px; }' +
        '.ht-sidebar, .ht-header, .ir-actions { display: none !important; }' +
      '</style>' +
      '</head><body>' +
      docContent +
      '<script>' +
        'window.addEventListener("DOMContentLoaded", function() {' +
          'var qrDiv = document.getElementById("docQrCode");' +
          'if (qrDiv && typeof parent.QRCode !== "undefined") {' +
            'new parent.QRCode(qrDiv, {' +
              'text: "' + (material.kode || "") + '",' +
              'width: 120, height: 120, colorDark: "#0F172A", colorLight: "#ffffff"' +
            '});' +
          '}' +
        '});' +
      '</script>' +
      '</body></html>';

    return html;
  },
};
