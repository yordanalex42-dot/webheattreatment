/* ============================================================
   HT-InspectionReport — Modul Inspection Report
   PT CHUNETSU INDONESIA — Sistem Informasi Produksi Heat Treatment

   Penyimpanan: localStorage 'ht_inspection_reports'
   (terpisah dari DB.tables / DB.SCHEMAS — tidak mengganggu
    migrasi, seed, atau data produksi yang sudah ada.)

   Alur status:
     Draft → Pending Approval → Approved | Rejected
     Rejected → Edit (revisi) → Draft → Pending Approval

   Batasan aplikasi browser-only:
     - Hanya role "Administrator" yang tersedia di js/auth.js.
     - Approval dilakukan oleh user yang sedang login (dari session).
     - Nama approver diambil dari session, bukan dari input bebas.
     - Di lingkungan produksi dengan role terpisah (Operator/Supervisor),
       kontrol tambahan perlu ditambahkan di sisi server.
   ============================================================ */

const HTInspectionReport = {
  STORAGE_KEY: "ht_inspection_reports",

  STATUSES: {
    DRAFT: "Draft",
    PENDING: "Pending Approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  },

  JUDGEMENT: {
    OK: "OK",
    NG: "NG",
  },

  HARNESS_UNITS: ["HRC", "HV", "HB"],

  state: {
    searchQuery: "",
    statusFilter: "all",
    dateFilter: "",
    pageSize: 25,
    currentPage: 1,
    currentReport: null,
    isEditMode: false,
  },

  _el: {},

  init() {
    this._cacheElements();
    this._bindEvents();
    this._bindModalClose();
    this.renderSummary();
    this.renderTable();
  },

  /* ----------------------------------------------------------
     Cache DOM elements
     ---------------------------------------------------------- */
  _cacheElements() {
    this._el = {
      totalKpi: document.getElementById("kpiTotalReports"),
      draftKpi: document.getElementById("kpiDraft"),
      pendingKpi: document.getElementById("kpiPending"),
      approvedKpi: document.getElementById("kpiApproved"),
      rejectedKpi: document.getElementById("kpiRejected"),
      searchInput: document.getElementById("reportSearchInput"),
      statusFilter: document.getElementById("reportStatusFilter"),
      dateFilter: document.getElementById("reportDateFilter"),
      resetBtn: document.getElementById("reportResetBtn"),
      pageSizeSelect: document.getElementById("reportPageSize"),
      tableBody: document.getElementById("reportTableBody"),
      pagination: document.getElementById("reportPagination"),
      pageInfo: document.getElementById("reportPageInfo"),
      totalItems: document.getElementById("reportTotalItems"),
      prevPage: document.getElementById("reportPrevPage"),
      nextPage: document.getElementById("reportNextPage"),
      pageNumbers: document.getElementById("reportPageNumbers"),
      createBtn: document.getElementById("btnCreateReport"),
      formModal: document.getElementById("reportFormModal"),
      formTitle: document.getElementById("reportFormTitle"),
      formSubtitle: document.getElementById("reportFormSubtitle"),
       formEl: document.getElementById("reportForm"),
      materialSelect: document.getElementById("reportControlNumber"),
      customerDisplay: document.getElementById("reportCustomer"),
      nomorPartDisplay: document.getElementById("reportNomorPart"),
      namaPartDisplay: document.getElementById("reportNamaPart"),
      qtyDisplay: document.getElementById("reportQty"),
      processTypeDisplay: document.getElementById("reportProcessType"),
      targetHardnessDisplay: document.getElementById("reportTargetHardness"),
      materialWarning: document.getElementById("reportMaterialWarning"),
      hardnessInput: document.getElementById("reportHardnessActual"),
      hardnessUnitSelect: document.getElementById("reportHardnessUnit"),
      inspectionDateInput: document.getElementById("reportInspectionDate"),
      inspectorInput: document.getElementById("reportInspector"),
      inspectorNotesTextarea: document.getElementById("reportInspectorNotes"),
      summaryBox: document.getElementById("reportSummaryBox"),
      saveDraftBtn: document.getElementById("btnSaveDraft"),
      sendApprovalBtn: document.getElementById("btnSendApproval"),
      closeFormBtn: document.getElementById("btnCloseForm"),
      cancelFormBtn: document.getElementById("btnCancelForm"),
      approvalModal: document.getElementById("approvalModal"),
      approvalReportNum: document.getElementById("approvalReportNumber"),
      approvalCustomer: document.getElementById("approvalCustomer"),
      approvalControlNum: document.getElementById("approvalControlNumber"),
      approvalPartNo: document.getElementById("approvalNomorPart"),
      approvalPartName: document.getElementById("approvalNamaPart"),
      approvalQty: document.getElementById("approvalQty"),
      approvalProcess: document.getElementById("approvalProcessType"),
      approvalTarget: document.getElementById("approvalTargetHardness"),
      approvalActual: document.getElementById("approvalHardnessActual"),
      approvalUnit: document.getElementById("approvalHardnessUnit"),
      approvalInspector: document.getElementById("approvalInspector"),
      approvalInspectorDate: document.getElementById("approvalInspectorDate"),
      approvalInspectorNotes: document.getElementById("approvalInspectorNotes"),
      approvalNotesTextarea: document.getElementById("approvalNotes"),
      approveBtn: document.getElementById("btnApproveReport"),
      rejectBtn: document.getElementById("btnRejectReport"),
      closeApprovalBtn: document.getElementById("btnCloseApproval"),
      detailModal: document.getElementById("reportDetailModal"),
      detailBody: document.getElementById("reportDetailBody"),
      closeDetailBtn: document.getElementById("btnCloseDetail"),
      closeDetailFooterBtn: document.getElementById("btnCloseDetailFooter"),
    };
  },

  /* ----------------------------------------------------------
     Storage (localStorage — terpisah dari DB.tables)
     ---------------------------------------------------------- */
  getReports() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]");
    } catch (e) {
      console.error("[IR] Failed to read reports:", e);
      return [];
    }
  },

  _persist(reports) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  },

  saveReport(report) {
    const reports = this.getReports();
    const idx = reports.findIndex((r) => r.id === report.id);
    if (idx !== -1) {
      reports[idx] = report;
    } else {
      reports.push(report);
    }
    this._persist(reports);
    return report;
  },

  updateReport(id, updates) {
    const reports = this.getReports();
    const idx = reports.findIndex((r) => r.id === id);
    if (idx !== -1) {
      const merged = { ...reports[idx], ...updates, updated_at: new Date().toISOString() };
      reports[idx] = merged;
      this._persist(reports);
      return merged;
    }
    return null;
  },

  _deleteReport(id) {
    const reports = this.getReports().filter((r) => r.id !== id);
    this._persist(reports);
  },

  getReportById(id) {
    return this.getReports().find((r) => r.id == id) || null;
  },

  /* ----------------------------------------------------------
     Report number generation — HIR-YYYY-NNNN
     ---------------------------------------------------------- */
  generateReportNumber() {
    const year = new Date().getFullYear();
    const reports = this.getReports();
    let maxSeq = 0;
    reports.forEach((r) => {
      if (r.report_number) {
        const match = r.report_number.match(/^HIR-(\d{4})-(\d{4})$/);
        if (match && match[1] === String(year)) {
          maxSeq = Math.max(maxSeq, parseInt(match[2], 10));
        }
      }
    });
    return "HIR-" + year + "-" + String(maxSeq + 1).padStart(4, "0");
  },

  _nextId() {
    const reports = this.getReports();
    let maxId = 0;
    reports.forEach((r) => {
      if (r.id && r.id > maxId) maxId = r.id;
    });
    return maxId + 1;
  },

  /* ----------------------------------------------------------
     Material resolution — menggunakan DB (read-only)
     ---------------------------------------------------------- */
  resolveMaterial(kode) {
    const material = DB.findByKode(kode) || DB.findMaterial(kode);
    if (!material) return null;

    const customer = DB.findCustomerById(material.customer_id);
    const part = DB.findPartById(material.part_id);

    const production = DB.get("productions").find(
      (p) => String(p.material_id) === String(material.id),
    );

    const qcs = DB.get("qcs").filter(
      (q) => String(q.material_id) === String(material.id),
    );
    const qc =
      qcs.length > 0
        ? qcs.reduce((latest, q) =>
            !latest || (q.id || 0) > (latest.id || 0) ? q : latest,
          )
        : null;

    return { material, customer, part, production, qc };
  },

  findActiveReportByControlNumber(controlNumber) {
    const reports = this.getReports();
    return reports.find(
      (r) =>
        r.control_number === controlNumber &&
        (r.status === this.STATUSES.DRAFT ||
          r.status === this.STATUSES.PENDING),
    );
  },

  /* ----------------------------------------------------------
     Auth / role helpers
     ---------------------------------------------------------- */
  getCurrentUser() {
    return Auth.getSession();
  },

  isApprover() {
    const session = this.getCurrentUser();
    if (!session) return false;
    return (
      session.role === "Administrator" || session.role === "Supervisor"
    );
  },

  isCreator(report) {
    const session = this.getCurrentUser();
    if (!session || !report) return false;
    return report.created_by === session.username;
  },

  _currentUserName() {
    const session = this.getCurrentUser();
    return session ? session.name : "";
  },

  _currentUserUsername() {
    const session = this.getCurrentUser();
    return session ? session.username : "";
  },

  _currentUserRole() {
    const session = this.getCurrentUser();
    return session ? session.role : "";
  },

  /* ----------------------------------------------------------
     Summary rendering
     ---------------------------------------------------------- */
  renderSummary() {
    const reports = this.getReports();
    const counts = {
      total: reports.length,
      draft: reports.filter((r) => r.status === this.STATUSES.DRAFT).length,
      pending: reports.filter(
        (r) => r.status === this.STATUSES.PENDING,
      ).length,
      approved: reports.filter(
        (r) => r.status === this.STATUSES.APPROVED,
      ).length,
      rejected: reports.filter(
        (r) => r.status === this.STATUSES.REJECTED,
      ).length,
    };

    if (this._el.totalKpi) this._el.totalKpi.textContent = counts.total;
    if (this._el.draftKpi) this._el.draftKpi.textContent = counts.draft;
    if (this._el.pendingKpi) this._el.pendingKpi.textContent = counts.pending;
    if (this._el.approvedKpi) this._el.approvedKpi.textContent = counts.approved;
    if (this._el.rejectedKpi) this._el.rejectedKpi.textContent = counts.rejected;
  },

  /* ----------------------------------------------------------
     Filter & table
     ---------------------------------------------------------- */
  getFilteredReports() {
    const reports = this.getReports();
    const s = this.state;
    const search = s.searchQuery.toLowerCase();

    return reports.filter((r) => {
      if (search) {
        const reportNum = (r.report_number || "").toLowerCase();
        const controlNum = (r.control_number || "").toLowerCase();
        const partName = (
          (r.part && r.part.nama_part) ||
          ""
        ).toLowerCase();
        const customerName = (
          (r.customer && r.customer.nama_customer) ||
          ""
        ).toLowerCase();

        if (
          !reportNum.includes(search) &&
          !controlNum.includes(search) &&
          !partName.includes(search) &&
          !customerName.includes(search)
        ) {
          return false;
        }
      }

      if (s.statusFilter !== "all" && r.status !== s.statusFilter)
        return false;

      if (s.dateFilter) {
        const reportDate = (r.report_date || "").slice(0, 10);
        if (reportDate !== s.dateFilter) return false;
      }

      return true;
    });
  },

  renderTable() {
    const filtered = this.getFilteredReports();
    const totalItems = filtered.length;
    const start = (this.state.currentPage - 1) * this.state.pageSize;
    const end = start + this.state.pageSize;
    const pageData = filtered.slice(start, end);

    if (this._el.totalItems)
      this._el.totalItems.textContent = totalItems;
    const showingStart = totalItems > 0 ? start + 1 : 0;
    const showingEnd = Math.min(end, totalItems);
    if (this._el.pageInfo)
      this._el.pageInfo.textContent = showingStart + "-" + showingEnd;

    const totalPages = Math.ceil(totalItems / this.state.pageSize) || 1;
    if (this._el.prevPage)
      this._el.prevPage.disabled = this.state.currentPage === 1;
    if (this._el.nextPage)
      this._el.nextPage.disabled = this.state.currentPage >= totalPages;

    if (this._el.pageNumbers) {
      let pagesHtml = "";
      const maxVisible = 5;
      let startPage = Math.max(
        1,
        this.state.currentPage - Math.floor(maxVisible / 2),
      );
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
      if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }
      for (let i = startPage; i <= endPage; i++) {
        pagesHtml +=
          '<button class="ht-btn ht-btn-sm ' +
          (i === this.state.currentPage
            ? "ht-btn-primary"
            : "ht-btn-ghost") +
          '" data-page="' +
          i +
          '">' +
          i +
          "</button>";
      }
      this._el.pageNumbers.innerHTML = pagesHtml;
      const self = this;
      this._el.pageNumbers
        .querySelectorAll("button")
        .forEach((btn) => {
          btn.addEventListener("click", function () {
            self.state.currentPage = parseInt(this.dataset.page);
            self.renderTable();
          });
        });
    }

    const self = this;
    const html = pageData
      .map(function (r, idx) {
        var actual =
          r.hardness_actual !== null && r.hardness_actual !== undefined
            ? r.hardness_actual + " " + (r.hardness_unit || "")
            : "-";
        var judgement = r.final_judgement
          ? '<span class="ht-badge ' +
            self.getJudgementBadgeClass(r.final_judgement) +
            '">' +
            r.final_judgement +
            "</span>"
          : '<span class="text-secondary">-</span>';

        var actions = self._renderActions(r);
        var reportDate = self._formatDateShort(r.report_date);

        return (
          '<tr class="ht-table-row">' +
          '<td class="font-mono text-center">' +
          (start + idx + 1) +
          "</td>" +
          '<td class="font-mono" title="' +
          (r.report_number || "") +
          '">' +
          (r.report_number || "-") +
          "</td>" +
          '<td class="font-mono" title="' +
          (r.control_number || "") +
          '">' +
          (r.control_number || "-") +
          "</td>" +
          '<td title="' +
          (r.customer && r.customer.nama_customer ? r.customer.nama_customer : "") +
          '">' +
          (r.customer ? r.customer.nama_customer : "-") +
          "</td>" +
          '<td title="' +
          (r.part && r.part.nama_part ? r.part.nama_part : "") +
          '">' +
          (r.part ? r.part.nama_part : "-") +
          "</td>" +
          '<td class="font-mono text-center">' +
          reportDate +
          "</td>" +
          '<td class="font-mono">' +
          actual +
          "</td>" +
          "<td>" +
          judgement +
          "</td>" +
          '<td><span class="ht-badge ' +
          self.getStatusBadgeClass(r.status) +
          '">' +
          r.status +
          "</span></td>" +
          "<td>" +
          actions +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (this._el.tableBody) {
      this._el.tableBody.innerHTML =
        html ||
        '<tr><td colspan="10" class="ht-table-empty"><img src="assets/icons/inbox.svg" alt="Empty" class="icon"><p>Belum ada Inspection Report</p></td></tr>';
    }
  },

  _renderActions(r) {
    var id = r.id;
    var btns = [];
    var self = this;

    btns.push(
      '<button onclick="HTInspectionReport.viewReport(' +
        id +
        ')" class="ht-action-btn view" title="Detail" aria-label="Detail"><img src="assets/icons/eye.svg" alt="Detail" class="icon"></button>',
    );

    if (r.status === this.STATUSES.DRAFT) {
      btns.push(
        '<button onclick="HTInspectionReport.editReport(' +
          id +
          ')" class="ht-action-btn edit" title="Edit" aria-label="Edit"><img src="assets/icons/edit.svg" alt="Edit" class="icon"></button>',
      );
      btns.push(
        '<button onclick="HTInspectionReport.sendForApprovalConfirm(' +
          id +
          ')" class="ht-action-btn" title="Kirim untuk Approval" aria-label="Kirim"><img src="assets/icons/paper-plane.svg" alt="Kirim" class="icon"></button>',
      );
      btns.push(
        '<button onclick="HTInspectionReport.deleteReportConfirm(' +
          id +
          ')" class="ht-action-btn delete" title="Hapus" aria-label="Hapus"><img src="assets/icons/delete.svg" alt="Hapus" class="icon"></button>',
      );
    } else if (r.status === this.STATUSES.PENDING) {
      if (this.isApprover()) {
        btns.push(
          '<button onclick="HTInspectionReport.openApproval(' +
            id +
            ')" class="ht-action-btn" title="Persetujuan" aria-label="Approve"><img src="assets/icons/gavel.svg" alt="Approve" class="icon"></button>',
        );
      }
    } else if (r.status === this.STATUSES.APPROVED) {
      btns.push(
        '<button onclick="HTInspectionReport.previewReport(' +
          id +
          ')" class="ht-action-btn view" title="Preview" aria-label="Preview"><img src="assets/icons/eye.svg" alt="Preview" class="icon"></button>',
      );
      btns.push(
        '<button onclick="HTInspectionReport.printReport(' +
          id +
          ')" class="ht-action-btn print" title="Print" aria-label="Print"><img src="assets/icons/print.svg" alt="Print" class="icon"></button>',
      );
      btns.push(
        '<button onclick="HTInspectionReport.downloadPdf(' +
          id +
          ')" class="ht-action-btn" title="Download PDF" aria-label="PDF"><img src="assets/icons/download.svg" alt="PDF" class="icon"></button>',
      );
    } else if (r.status === this.STATUSES.REJECTED) {
      btns.push(
        '<button onclick="HTInspectionReport.editReport(' +
          id +
          ')" class="ht-action-btn edit" title="Edit untuk revisi" aria-label="Edit"><img src="assets/icons/edit.svg" alt="Edit" class="icon"></button>',
      );
      btns.push(
        '<button onclick="HTInspectionReport.sendForApprovalConfirm(' +
          id +
          ')" class="ht-action-btn" title="Kirim ulang untuk approval" aria-label="Kirim"><img src="assets/icons/paper-plane.svg" alt="Kirim" class="icon"></button>',
      );
    }

    return '<div class="ht-action-group compact">' + btns.join("") + "</div>";
  },

  /* ----------------------------------------------------------
      Form: create / edit
      ---------------------------------------------------------- */
   editReport(id) {
     this.openFormModal(id);
   },

   openFormModal(reportId) {
    const modal = this._el.formModal;
    if (!modal) return;

    if (reportId) {
      const report = this.getReportById(reportId);
      if (!report) return;
      this.state.currentReport = report;
      this.state.isEditMode = true;
      this._populateForm(report);
    } else {
      this.state.currentReport = null;
      this.state.isEditMode = false;
      this._clearForm();
    }

    if (this._el.formSubtitle) {
      this._el.formSubtitle.textContent = this.state.isEditMode
        ? "Perbarui data laporan inspection report"
        : "Isi data material dan hasil hardness";
    }

    this._populateMaterialSelect();
    this._updateSummaryBox();
    HTUI.openModal("reportFormModal");
  },

  closeFormModal() {
    HTUI.closeModal("reportFormModal");
  },

  _populateMaterialSelect() {
    if (!this._el.materialSelect) return;
    const materials = DB.get("materials");
    const self = this;
    let html = '<option value="">Pilih Control Number...</option>';

    materials
      .slice()
      .sort((a, b) => String(a.kode).localeCompare(String(b.kode)))
      .forEach((m) => {
        const part = DB.findPartById(m.part_id);
        const cust = DB.findCustomerById(m.customer_id);
        const partName = part ? part.nama_part : "-";
        const custName = cust ? cust.nama_customer : "-";
        const label =
          (m.kode || "-") +
          " | " +
          partName +
          " (" +
          custName +
          ") — " +
          (m.qty || 0) +
          " pcs";
        html +=
          '<option value="' +
          (m.kode || m.id) +
          '">' +
          self._escapeHtml(label) +
          "</option>";
      });

    this._el.materialSelect.innerHTML = html;

    if (this.state.isEditMode && this.state.currentReport) {
      this._el.materialSelect.value = this.state.currentReport.control_number;
      this._el.materialSelect.disabled = true;
    } else {
      this._el.materialSelect.disabled = false;
    }

    if (this._el.materialSelect.value) {
      this._onMaterialChange();
    }
  },

  _onMaterialChange() {
    var select = this._el.materialSelect;
    var kode = select ? select.value : "";

    if (!kode) {
      this._clearMaterialInfo();
      return;
    }

    var resolved = this.resolveMaterial(kode);
    if (!resolved) {
      if (this._el.materialWarning) {
        this._el.materialWarning.innerHTML =
          '<div class="ht-ir-role-warning"><img src="assets/icons/warning.svg" alt="" class="icon">' +
          "Material dengan Control Number <strong>" +
          this._escapeHtml(kode) +
          "</strong> tidak ditemukan di database." +
          "</div>";
      }
      this._clearMaterialInfo();
      return;
    }

    var m = resolved.material;
    var cust = resolved.customer;
    var part = resolved.part;
    var prod = resolved.production;
    var qc = resolved.qc;

    if (this._el.customerDisplay)
      this._el.customerDisplay.textContent = cust
        ? cust.nama_customer
        : "—";
    if (this._el.nomorPartDisplay)
      this._el.nomorPartDisplay.textContent = part ? part.nomor_part : "—";
    if (this._el.namaPartDisplay)
      this._el.namaPartDisplay.textContent = part ? part.nama_part : "—";
    if (this._el.qtyDisplay)
      this._el.qtyDisplay.textContent = m.qty || 0;
    if (this._el.targetHardnessDisplay)
      this._el.targetHardnessDisplay.textContent = part
        ? part.target_hardness || "—"
        : "—";

    var processType = "—";
    if (prod && prod.jenis_treatment) {
      processType = prod.jenis_treatment;
    } else if (m.process_type) {
      processType = m.process_type;
    } else if (part && part.process_type) {
      processType = part.process_type;
    }
    if (this._el.processTypeDisplay)
      this._el.processTypeDisplay.textContent = processType;

    var warnings = [];
    if (!cust) warnings.push("Customer tidak ditemukan");
    if (!part) warnings.push("Part tidak ditemukan");
    if (!prod) warnings.push("Data produksi belum tersedia");
    if (!qc) warnings.push("Data QC belum tersedia");

    if (this._el.materialWarning) {
      if (warnings.length > 0) {
        this._el.materialWarning.innerHTML =
          '<div class="ht-ir-role-warning"><img src="assets/icons/warning.svg" alt="" class="icon">' +
          warnings.join(", ") +
          "</div>";
      } else {
        this._el.materialWarning.innerHTML = "";
      }
    }

    this._updateSummaryBox();
  },

  _clearMaterialInfo() {
    if (this._el.customerDisplay) this._el.customerDisplay.textContent = "—";
    if (this._el.nomorPartDisplay) this._el.nomorPartDisplay.textContent = "—";
    if (this._el.namaPartDisplay) this._el.namaPartDisplay.textContent = "—";
    if (this._el.qtyDisplay) this._el.qtyDisplay.textContent = "0";
    if (this._el.processTypeDisplay)
      this._el.processTypeDisplay.textContent = "—";
    if (this._el.targetHardnessDisplay)
      this._el.targetHardnessDisplay.textContent = "—";
    if (this._el.materialWarning) this._el.materialWarning.innerHTML = "";
  },

  _populateForm(report) {
    if (this._el.formTitle)
      this._el.formTitle.textContent = "Edit Inspection Report";
    if (this._el.materialSelect)
      this._el.materialSelect.value = report.control_number || "";
    if (this._el.hardnessInput)
      this._el.hardnessInput.value = report.hardness_actual != null
        ? report.hardness_actual
        : "";
    if (this._el.hardnessUnitSelect)
      this._el.hardnessUnitSelect.value = report.hardness_unit || "HRC";
    if (this._el.inspectionDateInput)
      this._el.inspectionDateInput.value = report.inspection_date
        ? report.inspection_date.slice(0, 10)
        : "";
    if (this._el.inspectorInput)
      this._el.inspectorInput.value = report.inspector || "";
    if (this._el.inspectorNotesTextarea)
      this._el.inspectorNotesTextarea.value = report.inspector_notes || "";
  },

  _clearForm() {
    if (this._el.formTitle)
      this._el.formTitle.textContent = "Buat Inspection Report";
    if (this._el.materialSelect) this._el.materialSelect.value = "";
    if (this._el.hardnessInput) this._el.hardnessInput.value = "";
    if (this._el.hardnessUnitSelect)
      this._el.hardnessUnitSelect.value = "HRC";
    if (this._el.inspectionDateInput)
      this._el.inspectionDateInput.value = "";
    if (this._el.inspectorInput)
      this._el.inspectorInput.value = this._currentUserName();
    if (this._el.inspectorNotesTextarea)
      this._el.inspectorNotesTextarea.value = "";
    this._clearMaterialInfo();
  },

  _updateSummaryBox() {
    if (!this._el.summaryBox) return;
    var kode = this._el.materialSelect ? this._el.materialSelect.value : "";
    var hardness = this._el.hardnessInput
      ? this._el.hardnessInput.value
      : "";
    var unit = this._el.hardnessUnitSelect
      ? this._el.hardnessUnitSelect.value
      : "";
    var inspector = this._el.inspectorInput
      ? this._el.inspectorInput.value
      : "";
    var inspDate = this._el.inspectionDateInput
      ? this._el.inspectionDateInput.value
      : "";

    var resolved = kode ? this.resolveMaterial(kode) : null;
    var customerName = resolved && resolved.customer
      ? resolved.customer.nama_customer
      : kode
        ? "—"
        : "";
    var partName = resolved && resolved.part
      ? resolved.part.nama_part
      : kode
        ? "—"
        : "";
    var targetHardness = resolved && resolved.part
      ? resolved.part.target_hardness || "—"
      : kode
        ? "—"
        : "";

    var html = "";
    if (kode) {
      html +=
        '<div class="ht-info-item">' +
        '<span class="ht-info-label">Control Number</span>' +
        '<span class="ht-info-value mono">' +
        this._escapeHtml(kode) +
        "</span>" +
        "</div>";
      html +=
        '<div class="ht-info-item">' +
        '<span class="ht-info-label">Customer</span>' +
        '<span class="ht-info-value">' +
        this._escapeHtml(customerName) +
        "</span>" +
        "</div>";
      html +=
        '<div class="ht-info-item">' +
        '<span class="ht-info-label">Nama Part</span>' +
        '<span class="ht-info-value">' +
        this._escapeHtml(partName) +
        "</span>" +
        "</div>";
      html +=
        '<div class="ht-info-item">' +
        '<span class="ht-info-label">Target Hardness</span>' +
        '<span class="ht-info-value mono hardness">' +
        this._escapeHtml(targetHardness) +
        "</span>" +
        "</div>";
      html +=
        '<div class="ht-info-item">' +
        '<span class="ht-info-label">Hardness Actual</span>' +
        '<span class="ht-info-value mono">' +
        (hardness ? this._escapeHtml(hardness) + " " + this._escapeHtml(unit) : "—") +
        "</span>" +
        "</div>";
      html +=
        '<div class="ht-info-item">' +
        '<span class="ht-info-label">Inspector</span>' +
        '<span class="ht-info-value">' +
        (inspector ? this._escapeHtml(inspector) : "—") +
        "</span>" +
        "</div>";
      html +=
        '<div class="ht-info-item">' +
        '<span class="ht-info-label">Tanggal Inspeksi</span>' +
        '<span class="ht-info-value">' +
        (inspDate ? this._escapeHtml(inspDate) : "—") +
        "</span>" +
        "</div>";
    } else {
      html =
        '<p class="ht-hint">Pilih Control Number untuk melihat ringkasan data.</p>';
    }

    this._el.summaryBox.innerHTML = html;
  },

  _validateForm() {
    var kode = this._el.materialSelect
      ? this._el.materialSelect.value
      : "";
    var hardness = this._el.hardnessInput
      ? this._el.hardnessInput.value.trim()
      : "";
    var unit = this._el.hardnessUnitSelect
      ? this._el.hardnessUnitSelect.value
      : "";
    var inspDate = this._el.inspectionDateInput
      ? this._el.inspectionDateInput.value
      : "";
    var inspector = this._el.inspectorInput
      ? this._el.inspectorInput.value.trim()
      : "";

    if (!kode) {
      HTUI.toast("Control Number harus dipilih!", "error");
      return false;
    }

    var resolved = this.resolveMaterial(kode);
    if (!resolved) {
      HTUI.toast(
        "Material tidak ditemukan di database. Pilih Control Number yang valid.",
        "error",
      );
      return false;
    }

    if (resolved.part) {
      /* ok */
    }

    if (resolved.material && !resolved.customer) {
      HTUI.toast(
        "Data customer material tidak lengkap. Laporan tidak dapat dibuat dengan identitas salah.",
        "error",
      );
      return false;
    }

    if (!hardness) {
      HTUI.toast("Nilai Hardness Aktual wajib diisi!", "error");
      return false;
    }

    var hardnessNum = parseFloat(hardness);
    if (isNaN(hardnessNum)) {
      HTUI.toast("Nilai Hardness harus berupa angka yang valid!", "error");
      return false;
    }

    if (hardnessNum < 0 || hardnessNum > 1000) {
      HTUI.toast(
        "Nilai Hardness tidak masuk akal (rentang 0–1000). Silakan koreksi.",
        "error",
      );
      return false;
    }

    if (!unit) {
      HTUI.toast("Satuan hardness wajib dipilih!", "error");
      return false;
    }

    if (!inspDate) {
      HTUI.toast("Tanggal Inspeksi wajib diisi!", "error");
      return false;
    }

    if (!inspector) {
      HTUI.toast("Nama Inspector wajib diisi!", "error");
      return false;
    }

    return true;
  },

  _buildReportFromForm() {
    var kode = this._el.materialSelect.value;
    var resolved = this.resolveMaterial(kode);
    var m = resolved.material;
    var part = resolved.part;
    var cust = resolved.customer;
    var prod = resolved.production;

    var processType = "—";
    if (prod && prod.jenis_treatment) {
      processType = prod.jenis_treatment;
    } else if (m.process_type) {
      processType = m.process_type;
    } else if (part && part.process_type) {
      processType = part.process_type;
    }

    var now = new Date();
    var nowISO = now.toISOString();
    var nowDate = now.toISOString().slice(0, 10);

    var existing = this.state.currentReport;
    var reportNumber = existing ? existing.report_number : this.generateReportNumber();
    var revision = existing ? existing.revision : 0;
    var createdBy = existing ? existing.created_by : this._currentUserUsername();
    var createdAt = existing ? existing.created_at : nowISO;

    if (existing && existing.status === this.STATUSES.REJECTED) {
      revision = existing.revision + 1;
    }

    var report = {
      id: existing ? existing.id : this._nextId(),
      report_number: reportNumber,
      control_number: m.kode || kode,
      material_id: m.id,
      customer: cust
        ? {
            id: cust.id,
            kode_customer: cust.kode_customer,
            nama_customer: cust.nama_customer,
          }
        : null,
      part: part
        ? {
            nomor_part: part.nomor_part,
            nama_part: part.nama_part,
            target_hardness: part.target_hardness,
            process_type: part.process_type,
          }
        : null,
      qty: m.qty || 0,
      process_type: processType,
      target_hardness: part ? part.target_hardness || null : null,
      hardness_actual: parseFloat(this._el.hardnessInput.value.trim()),
      hardness_unit: this._el.hardnessUnitSelect.value,
      inspection_date: this._el.inspectionDateInput.value,
      report_date: existing && existing.report_date
        ? existing.report_date
        : nowDate,
      inspector: this._el.inspectorInput.value.trim(),
      inspector_notes: this._el.inspectorNotesTextarea.value.trim(),
      status: existing ? this.STATUSES.DRAFT : this.STATUSES.DRAFT,
      final_judgement: existing ? existing.final_judgement : null,
      approver: existing ? existing.approver : null,
      approver_notes: existing ? existing.approver_notes : "",
      approved_at: existing ? existing.approved_at : null,
      revision: revision,
      created_by: createdBy,
      created_at: createdAt,
      updated_at: nowISO,
      history: existing ? (existing.history || []) : [],
    };

    return report;
  },

  _addHistoryEntry(report, action, by, at, notes) {
    var hist = report.history || [];
    hist.push({
      action: action,
      by: by,
      at: at,
      notes: notes || "",
      status_before: report.status,
    });
    return hist;
  },

  saveDraft() {
    if (!this._validateForm()) return;
    var report = this._buildReportFromForm();
    this.saveReport(report);
    HTUI.toast("Draft berhasil disimpan!", "success");
    this.closeFormModal();
    this.renderSummary();
    this.renderTable();
  },

  sendForApprovalFromForm() {
    if (!this._validateForm()) return;
    var report = this._buildReportFromForm();

    var existingActive = this.findActiveReportByControlNumber(
      report.control_number,
    );
    if (existingActive && (!this.state.currentReport || existingActive.id !== this.state.currentReport.id)) {
      if (
        !confirm(
          "Control Number " +
            report.control_number +
            " sudah memiliki laporan aktif (" +
            existingActive.status +
            "). Buat laporan baru dengan konfirmasi?",
        )
      ) {
        return;
      }
    }

    report.status = this.STATUSES.PENDING;
    var now = new Date().toISOString();
    report.history = this._addHistoryEntry(
      report,
      "send_approval",
      this._currentUserUsername(),
      now,
      "",
    );

    this.saveReport(report);
    HTUI.toast("Laporan dikirim untuk approval!", "success");
    this.closeFormModal();
    this.renderSummary();
    this.renderTable();
  },

  /* ----------------------------------------------------------
     Workflow: send for approval (from table action)
     ---------------------------------------------------------- */
  sendForApprovalConfirm(id) {
    var report = this.getReportById(id);
    if (!report) return;
    if (
      report.status !== this.STATUSES.DRAFT &&
      report.status !== this.STATUSES.REJECTED
    )
      return;

    if (
      !confirm(
        "Kirim laporan " +
          report.report_number +
          " untuk approval?\n\nLaporan tidak dapat diubah setelah dikirim.",
      )
    )
      return;

    var now = new Date().toISOString();
    var updates = {
      status: this.STATUSES.PENDING,
    };
    if (report.status === this.STATUSES.REJECTED) {
      updates.revision = (report.revision || 0) + 1;
    }

    var updated = this.updateReport(id, updates);
    if (updated) {
      updated.history = this._addHistoryEntry(
        updated,
        "send_approval",
        this._currentUserUsername(),
        now,
        "",
      );
      this.updateReport(id, { history: updated.history });
    }

    HTUI.toast("Laporan dikirim untuk approval!", "success");
    this.renderSummary();
    this.renderTable();
  },

  /* ----------------------------------------------------------
     Approval modal
     ---------------------------------------------------------- */
  openApproval(id) {
    var report = this.getReportById(id);
    if (!report) return;
    if (report.status !== this.STATUSES.PENDING) return;

    this.state.currentReport = report;

    if (this._el.approvalReportNum)
      this._el.approvalReportNum.textContent = report.report_number || "-";
    if (this._el.approvalCustomer)
      this._el.approvalCustomer.textContent =
        (report.customer && report.customer.nama_customer) || "-";
    if (this._el.approvalControlNum)
      this._el.approvalControlNum.textContent = report.control_number || "-";
    if (this._el.approvalPartNo)
      this._el.approvalPartNo.textContent =
        (report.part && report.part.nomor_part) || "-";
    if (this._el.approvalPartName)
      this._el.approvalPartName.textContent =
        (report.part && report.part.nama_part) || "-";
    if (this._el.approvalQty)
      this._el.approvalQty.textContent = report.qty || 0;
    if (this._el.approvalProcess)
      this._el.approvalProcess.textContent = report.process_type || "-";
    if (this._el.approvalTarget)
      this._el.approvalTarget.textContent =
        (report.target_hardness && report.target_hardness) || "-";
    if (this._el.approvalActual)
      this._el.approvalActual.textContent =
        (report.hardness_actual != null
          ? report.hardness_actual + " " + (report.hardness_unit || "")
          : "-");
    if (this._el.approvalUnit)
      this._el.approvalUnit.textContent = report.hardness_unit || "-";
    if (this._el.approvalInspector)
      this._el.approvalInspector.textContent = report.inspector || "-";
    if (this._el.approvalInspectorDate)
      this._el.approvalInspectorDate.textContent =
        this._formatDateShort(report.inspection_date) || "-";
    if (this._el.approvalInspectorNotes)
      this._el.approvalInspectorNotes.textContent =
        report.inspector_notes || "(tidak ada catatan)";
    if (this._el.approvalNotesTextarea)
      this._el.approvalNotesTextarea.value = "";

    // Reset radio
    var radioOk = document.getElementById("judgementOk");
    var radioNg = document.getElementById("judgementNg");
    if (radioOk) radioOk.checked = false;
    if (radioNg) radioNg.checked = false;

    // Role warning
    var warningBox = document.getElementById("approvalRoleWarning");
    if (warningBox) {
      if (this.isCreator(report)) {
        warningBox.classList.remove("hidden");
      } else {
        warningBox.classList.add("hidden");
      }
    }

    this._updateApprovalButtons();
    HTUI.openModal("approvalModal");
  },

  closeApprovalModal() {
    HTUI.closeModal("approvalModal");
  },

  _updateApprovalButtons() {
    if (!this._el.approveBtn) return;
    var judgement =
      document.getElementById("judgementOk") &&
      document.getElementById("judgementOk").checked
        ? "OK"
        : document.getElementById("judgementNg") &&
            document.getElementById("judgementNg").checked
          ? "NG"
          : null;

    this._el.approveBtn.disabled = !judgement;
  },

  _handleJudgementChange() {
    this._updateApprovalButtons();
  },

  approveReport() {
    if (!this.state.currentReport) return;
    var report = this.state.currentReport;
    if (report.status !== this.STATUSES.PENDING) return;

    var judgement = null;
    var radioOk = document.getElementById("judgementOk");
    var radioNg = document.getElementById("judgementNg");
    if (radioOk && radioOk.checked) judgement = "OK";
    else if (radioNg && radioNg.checked) judgement = "NG";

    if (!judgement) {
      HTUI.toast("Pilih Final Judgement (OK atau NG) terlebih dahulu!", "error");
      return;
    }

    var approverNotes = this._el.approvalNotesTextarea
      ? this._el.approvalNotesTextarea.value.trim()
      : "";

    if (judgement === "NG" && !approverNotes) {
      HTUI.toast(
        "Catatan atasan wajib diisi untuk Final Judgement NG!",
        "error",
      );
      return;
    }

    var now = new Date().toISOString();
    var session = this.getCurrentUser();
    var approverName = session ? session.name : "";

    this.updateReport(report.id, {
      status: this.STATUSES.APPROVED,
      final_judgement: judgement,
      approver: approverName,
      approver_notes: approverNotes,
      approved_at: now,
      history: (report.history || []).concat([
        {
          action: "approve",
          by: this._currentUserUsername(),
          at: now,
          notes: approverNotes,
          status_before: this.STATUSES.PENDING,
          final_judgement: judgement,
        },
      ]),
    });

    HTUI.toast(
      "Laporan disetujui! Judgement: " + judgement,
      "success",
    );
    this.closeApprovalModal();
    this.renderSummary();
    this.renderTable();
  },

  rejectReport() {
    if (!this.state.currentReport) return;
    var report = this.state.currentReport;
    if (report.status !== this.STATUSES.PENDING) return;

    var approverNotes = this._el.approvalNotesTextarea
      ? this._el.approvalNotesTextarea.value.trim()
      : "";

    if (!approverNotes) {
      HTUI.toast("Alasan penolakan wajib diisi!", "error");
      return;
    }

    var now = new Date().toISOString();
    var session = this.getCurrentUser();
    var approverName = session ? session.name : "";

    this.updateReport(report.id, {
      status: this.STATUSES.REJECTED,
      approver: approverName,
      approver_notes: approverNotes,
      approved_at: now,
      history: (report.history || []).concat([
        {
          action: "reject",
          by: this._currentUserUsername(),
          at: now,
          notes: approverNotes,
          status_before: this.STATUSES.PENDING,
        },
      ]),
    });

    HTUI.toast("Laporan ditolak dan dikembalikan untuk revisi!", "warning");
    this.closeApprovalModal();
    this.renderSummary();
    this.renderTable();
  },

  /* ----------------------------------------------------------
     Delete
      ---------------------------------------------------------- */
   deleteReportConfirm(id) {
    var report = this.getReportById(id);
    if (!report) return;
    if (
      !confirm(
        "Hapus laporan " + report.report_number + "?\n\nTindakan ini tidak dapat dibatalkan.",
      )
    )
      return;
    this._deleteReport(id);
    HTUI.toast("Laporan berhasil dihapus!", "success");
    this.renderSummary();
    this.renderTable();
  },

  /* ----------------------------------------------------------
     Detail view
     ---------------------------------------------------------- */
  viewReport(id) {
    var report = this.getReportById(id);
    if (!report) return;
    this.state.currentReport = report;

    if (this._el.detailBody) {
      this._el.detailBody.innerHTML = this._renderDetailHTML(report);
    }
    if (this._el.detailModal) {
      HTUI.openModal("reportDetailModal");
    }
  },

  closeDetailModal() {
    HTUI.closeModal("reportDetailModal");
  },

  _renderDetailHTML(report) {
    var self = this;
    var sb = [];
    var statusBadge = this.getStatusBadgeClass(report.status);
    var judgementBadge = report.final_judgement
      ? this.getJudgementBadgeClass(report.final_judgement)
      : "ht-badge-waiting";

    sb.push('<div class="space-y-4">');

    // Header
    sb.push('<div class="ht-info-grid">');
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Report Number</span><span class="ht-info-value mono">' +
        this._escapeHtml(report.report_number || "-") +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Control Number</span><span class="ht-info-value mono">' +
        this._escapeHtml(report.control_number || "-") +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Status</span><span class="ht-info-value"><span class="ht-badge ' +
        statusBadge +
        '">' +
        report.status +
        "</span></span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Final Judgement</span><span class="ht-info-value">' +
        (report.final_judgement
          ? '<span class="ht-badge ' +
              judgementBadge +
              '">' +
              report.final_judgement +
              "</span>"
          : '<span class="text-secondary">-</span>') +
        "</span></div>",
    );
    sb.push("</div>");

    // Material info
    sb.push('<div class="ht-card fade-in" style="margin-top:16px"><div class="ht-card-header"><h3 class="ht-card-title">Informasi Material</h3></div><div class="ht-info-grid">');
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Customer</span><span class="ht-info-value">' +
        this._escapeHtml(
          (report.customer && report.customer.nama_customer) || "-",
        ) +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Nomor Part</span><span class="ht-info-value mono">' +
        this._escapeHtml(
          (report.part && report.part.nomor_part) || "-",
        ) +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Nama Part</span><span class="ht-info-value">' +
        this._escapeHtml(
          (report.part && report.part.nama_part) || "-",
        ) +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Quantity</span><span class="ht-info-value">' +
        (report.qty || 0) +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Jenis Proses</span><span class="ht-info-value">' +
        this._escapeHtml(report.process_type || "-") +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Target Hardness</span><span class="ht-info-value mono hardness">' +
        this._escapeHtml(report.target_hardness || "-") +
        "</span></div>",
    );
    sb.push("</div></div>");

    // Hardness results
    sb.push('<div class="ht-card fade-in" style="margin-top:16px"><div class="ht-card-header"><h3 class="ht-card-title">Hasil Inspeksi Hardness</h3></div>');
    sb.push(
      '<table class="ht-table"><thead><tr><th>Parameter</th><th>Target / Spesifikasi</th><th>Hasil Aktual</th><th>Satuan</th><th>Final Judgement</th></tr></thead><tbody>',
    );
    sb.push(
      '<tr><td>Hardness</td><td class="font-mono">' +
        this._escapeHtml(report.target_hardness || "-") +
        "</td><td class='font-mono'>" +
        (report.hardness_actual != null ? report.hardness_actual : "-") +
        "</td><td>" +
        this._escapeHtml(report.hardness_unit || "-") +
        "</td><td>" +
        (report.final_judgement
          ? '<span class="ht-badge ' +
              judgementBadge +
              '">' +
              report.final_judgement +
              "</span>"
          : '<span class="text-secondary">-</span>') +
        "</td></tr>",
    );
    sb.push("</tbody></table></div>");

    // Catatan & approval
    sb.push('<div class="ht-card fade-in" style="margin-top:16px"><div class="ht-card-header"><h3 class="ht-card-title">Catatan &amp; Persetujuan</h3></div><div class="ht-info-grid">');
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Tanggal Inspeksi</span><span class="ht-info-value">' +
        this._formatDateShort(report.inspection_date) +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Nama Inspector</span><span class="ht-info-value">' +
        this._escapeHtml(report.inspector || "-") +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item ht-info-item-wide"><span class="ht-info-label">Catatan Inspector</span><span class="ht-info-value">' +
        this._escapeHtml(report.inspector_notes || "(tidak ada)") +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Nama Approver</span><span class="ht-info-value">' +
        this._escapeHtml(report.approver || "-") +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item"><span class="ht-info-label">Tanggal Approval</span><span class="ht-info-value">' +
        (report.approved_at ? this._formatDateTime(report.approved_at) : "-") +
        "</span></div>",
    );
    sb.push(
      '<div class="ht-info-item ht-info-item-wide"><span class="ht-info-label">Catatan Atasan</span><span class="ht-info-value">' +
        this._escapeHtml(report.approver_notes || "(tidak ada)") +
        "</span></div>",
    );
    sb.push("</div></div>");

    // Riwayat
    if (report.history && report.history.length > 0) {
      sb.push('<div class="ht-card fade-in" style="margin-top:16px"><div class="ht-card-header"><h3 class="ht-card-title">Riwayat Perubahan</h3></div>');
      sb.push('<table class="ht-table"><thead><tr><th>Waktu</th><th>Aksi</th><th>Pengguna</th><th>Catatan</th></tr></thead><tbody>');
      report.history.forEach(function (h) {
        sb.push(
          "<tr><td>" +
            (h.at ? self._formatDateTime(h.at) : "-") +
            "</td><td>" +
            self._escapeHtml(h.action || "-") +
            "</td><td>" +
            self._escapeHtml(h.by || "-") +
            "</td><td>" +
            self._escapeHtml(h.notes || "") +
            "</td></tr>",
        );
      });
      sb.push("</tbody></table></div>");
    }

    sb.push("</div>");
    return sb.join("");
  },

  /* ----------------------------------------------------------
     Print & PDF (document preview)
     ---------------------------------------------------------- */
  previewReport(id) {
    var report = this.getReportById(id);
    if (!report) return;
    if (report.status !== this.STATUSES.APPROVED) {
      HTUI.toast(
        "Hanya laporan yang sudah disetujui yang dapat dilihat sebagai dokumen final.",
        "warning",
      );
      return;
    }
    var html = this._generateDocumentHTML(report);
    var printWin = window.open("", "_blank", "width=900,height=1100");
    if (!printWin) {
      HTUI.toast("Pop-up diblokir. Izinkan pop-up untuk halaman ini.", "error");
      return;
    }
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
  },

  printReport(id) {
    var report = this.getReportById(id);
    if (!report) return;
    if (report.status !== this.STATUSES.APPROVED) {
      HTUI.toast(
        "Hanya laporan yang sudah disetujui yang dapat dicetak.",
        "warning",
      );
      return;
    }
    var html = this._generateDocumentHTML(report);
    var printWin = window.open("", "_blank", "width=900,height=1100");
    if (!printWin) {
      HTUI.toast("Pop-up diblokir. Izinkan pop-up untuk halaman ini.", "error");
      return;
    }
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(function () {
      printWin.focus();
      printWin.print();
    }, 300);
  },

  downloadPdf(id) {
    var report = this.getReportById(id);
    if (!report) return;
    if (report.status !== this.STATUSES.APPROVED) {
      HTUI.toast(
        "Hanya laporan yang sudah disetujui yang dapat diunduh sebagai PDF.",
        "warning",
      );
      return;
    }
    HTUI.toast(
      "Silakan pilih 'Save as PDF' di dialog cetak browser untuk menyimpan sebagai PDF.",
      "info",
      5000,
    );
    this.printReport(id);
  },

  _generateDocumentHTML(report) {
    var logo = "assets/logo/logo baru.svg";
    var customerName =
      (report.customer && report.customer.nama_customer) || "-";
    var customerKode =
      (report.customer && report.customer.kode_customer) || "";
    var partNo =
      (report.part && report.part.nomor_part) || "-";
    var partName =
      (report.part && report.part.nama_part) || "-";
    var targetHardness = report.target_hardness || "-";
    var actualHardness =
      report.hardness_actual != null ? report.hardness_actual : "-";
    var unit = report.hardness_unit || "-";
    var finalJudgement = report.final_judgement || "-";
    var processType = report.process_type || "-";
    var qty = report.qty || 0;
    var inspector = report.inspector || "-";
    var inspectorNotes = report.inspector_notes || "";
    var inspectorDate = this._formatDateLong(report.inspection_date);
    var approver = report.approver || "-";
    var approverNotes = report.approver_notes || "";
    var approvedAt = report.approved_at
      ? this._formatDateTime(report.approved_at)
      : "-";
    var reportDate = this._formatDateLong(report.report_date);

    var judgementClass =
      finalJudgement === "OK" ? "judgement-ok" :
      finalJudgement === "NG" ? "judgement-ng" : "";

    var html =
      '<!DOCTYPE html>' +
      '<html lang="id"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      "<title>HARDNESS INSPECTION REPORT - " +
      this._escapeHtml(report.report_number || "") +
      "</title>" +
      "<style>" +
      this._getDocumentPrintCSS() +
      "</style>" +
      "</head><body>" +
      '<div class="ht-doc-page">' +
      '<div class="ht-doc-header">' +
      '<img src="' + logo + '" alt="PT CHUNETSU INDONESIA" class="ht-doc-logo">' +
      '<div class="ht-doc-company">PT CHUNETSU INDONESIA</div>' +
      "</div>" +
      '<div class="ht-doc-title-block">' +
      "<h1>HARDNESS INSPECTION REPORT</h1>" +
      '<div class="ht-doc-meta">' +
      "<div><strong>Report Number:</strong> " +
      this._escapeHtml(report.report_number || "-") +
      "</div>" +
      "<div><strong>Tanggal Laporan:</strong> " +
      this._escapeHtml(reportDate) +
      "</div>" +
      "<div><strong>Tanggal Inspeksi:</strong> " +
      this._escapeHtml(inspectorDate) +
      "</div>" +
      '<div><strong>Report Revision:</strong> Rev. ' +
      (report.revision || 0) +
      "</div>" +
      "</div>" +
      "</div>" +
      '<table class="ht-doc-table">' +
      "<thead><tr><th colspan='2'>Informasi Material</th></tr></thead>" +
      "<tbody>" +
      "<tr><td>Customer</td><td>" +
      this._escapeHtml(customerName) +
      "</td></tr>" +
      (customerKode ? "<tr><td>Kode Customer</td><td>" +
        this._escapeHtml(customerKode) + "</td></tr>" : "") +
      "<tr><td>Control Number</td><td class='mono'>" +
      this._escapeHtml(report.control_number || "-") +
      "</td></tr>" +
      "<tr><td>Nomor Part</td><td class='mono'>" +
      this._escapeHtml(partNo) +
      "</td></tr>" +
      "<tr><td>Nama Part</td><td>" +
      this._escapeHtml(partName) +
      "</td></tr>" +
      "<tr><td>Quantity</td><td>" +
      (qty || 0) +
      " pcs</td></tr>" +
      "<tr><td>Jenis Proses Heat Treatment</td><td>" +
      this._escapeHtml(processType) +
      "</td></tr>" +
      "</tbody>" +
      "</table>" +
      '<table class="ht-doc-table">' +
      "<thead><tr><th>Parameter</th><th>Spesifikasi / Target</th><th>Hasil Aktual</th><th>Satuan</th><th>Final Judgement</th></tr></thead>" +
      "<tbody>" +
      "<tr>" +
      "<td>Hardness</td>" +
      "<td class='mono'>" +
      this._escapeHtml(targetHardness) +
      "</td>" +
      "<td class='mono'>" +
      actualHardness +
      "</td>" +
      "<td>" +
      this._escapeHtml(unit) +
      "</td>" +
      "<td><span class='ht-doc-judgement " +
      judgementClass +
      "'>" +
      this._escapeHtml(finalJudgement) +
      "</span></td>" +
      "</tr>" +
      "</tbody>" +
      "</table>";

    // Catatan & approval
    html += '<table class="ht-doc-table">';
    html +=
      "<thead><tr><th colspan='2'>Catatan &amp; Persetujuan</th></tr></thead>";
    html += "<tbody>";
    html +=
      "<tr><td>Nama Inspector</td><td>" +
      this._escapeHtml(inspector) +
      "</td></tr>";
    html +=
      "<tr><td>Tanggal Inspeksi</td><td>" +
      this._escapeHtml(inspectorDate) +
      "</td></tr>";
    if (inspectorNotes) {
      html +=
        "<tr><td>Catatan Inspector</td><td>" +
        this._escapeHtml(inspectorNotes) +
        "</td></tr>";
    }
    html +=
      "<tr><td>Final Judgement</td><td><span class='ht-doc-judgement " +
      judgementClass +
      "'>" +
      this._escapeHtml(finalJudgement) +
      "</span></td></tr>";
    html +=
      "<tr><td>Nama Approver</td><td>" +
      this._escapeHtml(approver) +
      "</td></tr>";
    html +=
      "<tr><td>Jabatan</td><td>" +
      this._escapeHtml(this._currentUserRole() || "Administrator") +
      "</td></tr>";
    html +=
      "<tr><td>Tanggal Approval</td><td>" +
      this._escapeHtml(approvedAt) +
      "</td></tr>";
    if (approverNotes) {
      html +=
        "<tr><td>Catatan Atasan</td><td>" +
        this._escapeHtml(approverNotes) +
        "</td></tr>";
    }
    html += "</tbody></table>";

    // Signature area
    html += '<div class="ht-doc-signature">';
    html += "<div class='ht-doc-signature-col'>";
    html += "<p class='ht-doc-signature-title'>INSPECTOR</p>";
    html +=
      "<p class='ht-doc-signature-name'>" +
      this._escapeHtml(inspector) +
      "</p>";
    html +=
      "<p class='ht-doc-signature-sub'>" +
      this._escapeHtml(inspectorDate) +
      "</p>";
    html += "</div>";
    html += "<div class='ht-doc-signature-col'>";
    html += "<p class='ht-doc-signature-title'>APPROVER</p>";
    html +=
      "<p class='ht-doc-signature-name'>" +
      this._escapeHtml(approver) +
      "</p>";
    html +=
      "<p class='ht-doc-signature-sub'>" +
      this._escapeHtml(this._currentUserRole() || "Administrator") +
      " — " +
      this._escapeHtml(approvedAt) +
      "</p>";
    html += "</div>";
    html += "</div>";

    html += '<div class="ht-doc-footer">';
    html +=
      "<small>Dokumen ini dicetak otomatis dari Sistem Informasi Produksi Heat Treatment. " +
      "PT CHUNETSU INDONESIA — Dokumen tidak mengandung tanda tangan digital.</small>";
    html += "</div>";

    html += "</div></body></html>";

    return html;
  },

  _getDocumentPrintCSS() {
    return (
      "body{font-family:'Inter',sans-serif;margin:0;padding:0;font-size:12px;color:#0f172a;background:#fff}" +
      ".ht-doc-page{width:21cm;min-height:29.7cm;margin:0 auto;padding:2cm;box-sizing:border-box;position:relative}" +
      ".ht-doc-header{display:flex;align-items:center;gap:12px;margin-bottom:16px}" +
      ".ht-doc-logo{width:40px;height:40px}" +
      ".ht-doc-company{font-size:18px;font-weight:700;color:#0f172a}" +
      ".ht-doc-title-block{text-align:center;margin-bottom:24px}" +
      ".ht-doc-title-block h1{font-size:22px;font-weight:700;color:#1e3a8a;letter-spacing:-0.5px;margin:0}" +
      ".ht-doc-meta{display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:8px;font-size:11px;color:#475569}" +
      ".ht-doc-meta div{display:flex;gap:6px}" +
      ".ht-doc-table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}" +
      ".ht-doc-table thead th{text-align:left;padding:8px 10px;background:#eff6ff;font-weight:600;color:#1e3a8a;border-bottom:2px solid #2563eb}" +
      ".ht-doc-table td{padding:6px 10px;border-bottom:1px solid #e2e8f0}" +
      ".ht-doc-table td.mono{font-family:'Courier New',monospace;font-weight:600}" +
      ".ht-doc-judgement{display:inline-block;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap}" +
      ".judgement-ok{background:#dcfce7;color:#166534;border:0.5px solid rgba(16,185,129,0.3)}" +
      ".judgement-ng{background:#fee2e2;color:#991b1b;border:0.5px solid rgba(239,68,68,0.3)}" +
      ".ht-doc-signature{display:flex;justify-content:space-between;margin-top:24px;border-top:2px solid #cbd5e1;padding-top:20px}" +
      ".ht-doc-signature-col{text-align:center;flex:1}" +
      ".ht-doc-signature-title{font-size:11px;text-transform:uppercase;font-weight:700;color:#475569;margin-bottom:4px}" +
      ".ht-doc-signature-name{font-size:13px;font-weight:600;color:#0f172a;margin:4px 0}" +
      ".ht-doc-signature-sub{font-size:10px;color:#64748b}" +
      ".ht-doc-footer{text-align:center;margin-top:20px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}" +
      "@media print{body{margin:0} .ht-doc-page{padding:1.5cm} .ht-doc-signature{break-inside:avoid}}" +
      "@page{size:A4;margin:2cm}"
    );
  },

  /* ----------------------------------------------------------
     Event binding
     ---------------------------------------------------------- */
  _bindEvents() {
    if (this._el.createBtn) {
      this._el.createBtn.addEventListener("click", () => {
        this.openFormModal();
      });
    }
     this._bindFilterEvents();
    this._bindFormEvents();
    this._bindApprovalEvents();
    this._bindDetailEvents();
  },

  _bindFilterEvents() {
    if (this._el.searchInput) {
      this._el.searchInput.addEventListener("input", (e) => {
        this.state.searchQuery = e.target.value;
        this.state.currentPage = 1;
        this.renderTable();
      });
    }
    if (this._el.statusFilter) {
      this._el.statusFilter.addEventListener("change", (e) => {
        this.state.statusFilter = e.target.value;
        this.state.currentPage = 1;
        this.renderTable();
      });
    }
    if (this._el.dateFilter) {
      this._el.dateFilter.addEventListener("change", (e) => {
        this.state.dateFilter = e.target.value;
        this.state.currentPage = 1;
        this.renderTable();
      });
    }
    if (this._el.resetBtn) {
      this._el.resetBtn.addEventListener("click", () => {
        this._resetFilters();
      });
    }
    if (this._el.pageSizeSelect) {
      this._el.pageSizeSelect.addEventListener("change", (e) => {
        this.state.pageSize = parseInt(e.target.value, 10);
        this.state.currentPage = 1;
        this.renderTable();
      });
    }
    if (this._el.prevPage) {
      this._el.prevPage.addEventListener("click", () => {
        if (this.state.currentPage > 1) {
          this.state.currentPage--;
          this.renderTable();
        }
      });
    }
    if (this._el.nextPage) {
      this._el.nextPage.addEventListener("click", () => {
        var totalPages =
          Math.ceil(this.getFilteredReports().length / this.state.pageSize) ||
          1;
        if (this.state.currentPage < totalPages) {
          this.state.currentPage++;
          this.renderTable();
        }
      });
    }
  },

  _resetFilters() {
    this.state.searchQuery = "";
    this.state.statusFilter = "all";
    this.state.dateFilter = "";
    this.state.currentPage = 1;
    if (this._el.searchInput) this._el.searchInput.value = "";
    if (this._el.statusFilter) this._el.statusFilter.value = "all";
    if (this._el.dateFilter) this._el.dateFilter.value = "";
    this.renderTable();
  },

  _bindFormEvents() {
    if (this._el.materialSelect) {
      this._el.materialSelect.addEventListener("change", () => {
        this._onMaterialChange();
      });
    }
    if (this._el.hardnessInput) {
      this._el.hardnessInput.addEventListener("input", () => {
        this._updateSummaryBox();
      });
    }
    if (this._el.hardnessUnitSelect) {
      this._el.hardnessUnitSelect.addEventListener("change", () => {
        this._updateSummaryBox();
      });
    }
    if (this._el.inspectionDateInput) {
      this._el.inspectionDateInput.addEventListener("change", () => {
        this._updateSummaryBox();
      });
    }
    if (this._el.inspectorInput) {
      this._el.inspectorInput.addEventListener("input", () => {
        this._updateSummaryBox();
      });
    }
    if (this._el.saveDraftBtn) {
      this._el.saveDraftBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.saveDraft();
      });
    }
    if (this._el.sendApprovalBtn) {
      this._el.sendApprovalBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.sendForApprovalFromForm();
      });
    }
    if (this._el.closeFormBtn) {
      this._el.closeFormBtn.addEventListener("click", () => {
        this.closeFormModal();
      });
    }
    if (this._el.cancelFormBtn) {
      this._el.cancelFormBtn.addEventListener("click", () => {
        this.closeFormModal();
      });
    }
  },

  _bindApprovalEvents() {
    var radioOk = document.getElementById("judgementOk");
    var radioNg = document.getElementById("judgementNg");
    if (radioOk) {
      radioOk.addEventListener("change", () => this._handleJudgementChange());
    }
    if (radioNg) {
      radioNg.addEventListener("change", () => this._handleJudgementChange());
    }
    if (this._el.approvalNotesTextarea) {
      this._el.approvalNotesTextarea.addEventListener("input", () => {
        this._updateApprovalButtons();
      });
    }
    if (this._el.approveBtn) {
      this._el.approveBtn.addEventListener("click", () => {
        this.approveReport();
      });
    }
    if (this._el.rejectBtn) {
      this._el.rejectBtn.addEventListener("click", () => {
        this.rejectReport();
      });
    }
     if (this._el.closeApprovalBtn) {
       this._el.closeApprovalBtn.addEventListener("click", () => {
         this.closeApprovalModal();
       });
     }
   },

   _bindDetailEvents() {
     if (this._el.closeDetailBtn) {
       this._el.closeDetailBtn.addEventListener("click", () => {
         this.closeDetailModal();
       });
     }
     if (this._el.closeDetailFooterBtn) {
       this._el.closeDetailFooterBtn.addEventListener("click", () => {
         this.closeDetailModal();
       });
     }
   },

   _bindModalClose() {
    var formModal = document.getElementById("reportFormModal");
    if (formModal) {
      formModal.addEventListener("click", (e) => {
        if (e.target === formModal) this.closeFormModal();
      });
    }
    var approvalModal = document.getElementById("approvalModal");
    if (approvalModal) {
      approvalModal.addEventListener("click", (e) => {
        if (e.target === approvalModal) this.closeApprovalModal();
      });
    }
    var detailModal = document.getElementById("reportDetailModal");
    if (detailModal) {
      detailModal.addEventListener("click", (e) => {
        if (e.target === detailModal) this.closeDetailModal();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (formModal && formModal.classList.contains("active"))
          this.closeFormModal();
        if (approvalModal && approvalModal.classList.contains("active"))
          this.closeApprovalModal();
        if (detailModal && detailModal.classList.contains("active"))
          this.closeDetailModal();
      }
    });
  },

  /* ----------------------------------------------------------
     Helpers
     ---------------------------------------------------------- */
  getStatusBadgeClass(status) {
    switch (status) {
      case this.STATUSES.DRAFT:
        return "ht-badge-draft";
      case this.STATUSES.PENDING:
        return "ht-badge-pending";
      case this.STATUSES.APPROVED:
        return "ht-badge-approved";
      case this.STATUSES.REJECTED:
        return "ht-badge-rejected";
      default:
        return "ht-badge-waiting";
    }
  },

  getJudgementBadgeClass(judgement) {
    if (judgement === "OK") return "ht-badge-ok";
    if (judgement === "NG") return "ht-badge-ng";
    return "ht-badge-waiting";
  },

  _formatDateShort(dateStr) {
    if (!dateStr) return "-";
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 10);
    var day = String(d.getDate()).padStart(2, "0");
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var year = d.getFullYear();
    return day + "/" + month + "/" + year;
  },

  _formatDateLong(dateStr) {
    if (!dateStr) return "-";
    return formatDateLongFromISO
      ? formatDateLongFromISO(dateStr)
      : dateStr.slice(0, 10);
  },

  _formatDateTime(isoStr) {
    if (!isoStr) return "-";
    return formatDateLongWithTime
      ? formatDateLongWithTime(isoStr)
      : isoStr;
  },

  _escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },
};

/* ============================================================
   Auto-initialize pada DOMContentLoaded
   ============================================================ */
document.addEventListener("DOMContentLoaded", function () {
  if (!HTUI.requireAuth()) return;
  if (typeof DB !== "undefined") {
    DB.init();
    DB.migrate();
  }
  if (typeof HTDateFormat !== "undefined") {
    HTDateFormat.init();
  }
  HTInspectionReport.init();
});
