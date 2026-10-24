/* ============================================================
   HT-Dashboard — Dashboard pemantauan untuk sistem Heat Treatment
   Menangani rendering KPI, grafik, tabel, filter, pencarian, paginasi,
   dan ekspor Excel. Seluruh data berasal dari localStorage melalui DB.
   ============================================================ */

const HTDashboard = {
  state: {
    searchQuery: "",
    statusFilter: "all",
    customerFilter: "all",
    dateStart: "",
    dateEnd: "",
    pageSize: 25,
    currentPage: 1,
    chartMode: "monthly",
    selectedMonth: new Date().getMonth() + 1,
    selectedYear: new Date().getFullYear(),
  },

  _data: null,
  _chartProduction: null,
  _processDonutChart: null,
  _autoRefreshTimer: null,

  MONTH_NAMES_ID: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  MONTH_SHORT_ID: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],

  init() {
    DB.init();
    DB.migrate();
    this._cacheElements();
    this._renderMonthSelectors();
    this._bindEvents();
    this.loadDashboard();
    this._startAutoRefresh();
  },

  _cacheElements() {
    this._el = {
      kpiTotalInput: document.getElementById("kpiTotalInput"),
      kpiTotalOutput: document.getElementById("kpiTotalOutput"),
      kpiTotalBeratInput: document.getElementById("kpiTotalBeratInput"),
      kpiTotalBeratOutput: document.getElementById("kpiTotalBeratOutput"),
      dailyChartCtx: document.getElementById("productionChart"),
      dailyChartEmpty: document.getElementById("productionChartEmpty"),
      monthlyChartCtx: document.getElementById("processDonutChart"),
      searchInput: document.getElementById("searchInput"),
      statusFilter: document.getElementById("statusFilter"),
      customerFilter: document.getElementById("customerFilter"),
      filterDateStart: document.getElementById("filterDateStart"),
      filterDateEnd: document.getElementById("filterDateEnd"),
      chartModeToggle: document.getElementById("chartModeToggle"),
      processDonutTotal: document.getElementById("processDonutTotal"),
      processDonutCenter: document.getElementById("processDonutCenter"),
      processDonutLegend: document.getElementById("processDonutLegend"),
      tableBody: document.getElementById("monitoringTableBody"),
      pagination: document.getElementById("pagination"),
      pageInfo: document.getElementById("pageInfo"),
      totalItems: document.getElementById("totalItems"),
      prevPage: document.getElementById("prevPage"),
      nextPage: document.getElementById("nextPage"),
      pageNumbers: document.getElementById("pageNumbers"),
      pageSizeSelect: document.getElementById("pageSizeSelect"),
      exportBtn: document.getElementById("exportBtn"),
      refreshBtn: document.getElementById("refreshBtn"),
      kpiMonthSelect: document.getElementById("kpiMonthSelect"),
      kpiYearSelect: document.getElementById("kpiYearSelect"),
    };
  },

  _renderMonthSelectors() {
    if (!this._el.kpiMonthSelect || !this._el.kpiYearSelect) return;

    const now = new Date();
    const currentYear = now.getFullYear();

    let monthHtml = "";
    for (let m = 1; m <= 12; m++) {
      monthHtml += `<option value="${m}">${this.MONTH_NAMES_ID[m - 1]}</option>`;
    }
    this._el.kpiMonthSelect.innerHTML = monthHtml;

    let yearHtml = "";
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      yearHtml += `<option value="${y}">${y}</option>`;
    }
    this._el.kpiYearSelect.innerHTML = yearHtml;

    this._el.kpiMonthSelect.value = String(this.state.selectedMonth);
    this._el.kpiYearSelect.value = String(this.state.selectedYear);
  },

  _bindEvents() {
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

    if (this._el.customerFilter) {
      this._el.customerFilter.addEventListener("change", (e) => {
        this.state.customerFilter = e.target.value;
        this.state.currentPage = 1;
        this.renderTable();
      });
    }

    if (this._el.filterDateStart) {
      this._el.filterDateStart.addEventListener("change", () => {
        this.state.dateStart = this._el.filterDateStart.value;
        this.loadDashboard();
      });
    }
    if (this._el.filterDateEnd) {
      this._el.filterDateEnd.addEventListener("change", () => {
        this.state.dateEnd = this._el.filterDateEnd.value;
        this.loadDashboard();
      });
    }

    if (this._el.chartModeToggle) {
      this._el.chartModeToggle.addEventListener("change", (e) => {
        this.state.chartMode = e.target.value;
        this.renderProductionChart();
      });
    }

    if (this._el.pageSizeSelect) {
      this._el.pageSizeSelect.addEventListener("change", (e) => {
        this.state.pageSize = parseInt(e.target.value);
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
        const totalPages = Math.ceil(this._getFilteredMaterials().length / this.state.pageSize);
        if (this.state.currentPage < totalPages) {
          this.state.currentPage++;
          this.renderTable();
        }
      });
    }

    if (this._el.exportBtn) {
      this._el.exportBtn.addEventListener("click", () => this.exportExcel());
    }
    if (this._el.refreshBtn) {
      this._el.refreshBtn.addEventListener("click", () => this.refresh());
    }

    if (this._el.kpiMonthSelect) {
      this._el.kpiMonthSelect.addEventListener("change", () => {
        this.state.selectedMonth = parseInt(this._el.kpiMonthSelect.value);
        this._cacheData();
        this.renderKPIs();
        this.renderProductionChart();
        this.renderProcessDonutChart();
      });
    }
    if (this._el.kpiYearSelect) {
      this._el.kpiYearSelect.addEventListener("change", () => {
        this.state.selectedYear = parseInt(this._el.kpiYearSelect.value);
        this._cacheData();
        this.renderKPIs();
        this.renderProductionChart();
        this.renderProcessDonutChart();
       });
    }
  },

  loadDashboard() {
    this._cacheData();
    this.renderKPIs();
    this.renderProductionChart();
    this.renderProcessDonutChart();
    this.renderCustomerFilter();
    this.renderTable();
  },

  _cacheData() {
    const materials = DB.get("materials").slice().reverse();
    const productions = DB.get("productions");
    const qcs = DB.get("qcs");
    const deliveries = DB.get("deliveries");

    const prodMap = {};
    productions.forEach(p => {
      if (!prodMap[p.material_id]) prodMap[p.material_id] = [];
      prodMap[p.material_id].push(p);
    });

    const qcMap = {};
    qcs.forEach(q => {
      if (q.material_id !== undefined && q.material_id !== null && q.material_id !== "") {
        qcMap[q.material_id] = q;
      }
    });

    const delMap = {};
    deliveries.forEach(d => {
      if (d.material_id !== undefined && d.material_id !== null && d.material_id !== "") {
        delMap[d.material_id] = d;
      }
    });

    const customers = DB.get("customers");
    const parts = DB.get("parts");

    this._data = { materials, productions, qcs, deliveries, prodMap, qcMap, delMap, customers, parts };
  },

  _hasRoute(material) {
    return !!(material && material.process_route && typeof material.process_route === "object");
  },

  _isMaterialProductionComplete(material) {
    if (this._hasRoute(material)) {
      return DB.isRouteCompleted(material) && DB.checkQualityGate(material).qcStatus === "PASS";
    }
    const prods = this._data.prodMap[material.id] || [];
    return prods.some(p => p.production_status === "FINISH" && p.process_result !== "NG");
  },

  _getRelations(material) {
    if (!this._data) return { material, prod: null, qc: null, del: null, customer: null, part: null, history: [], routeCompleted: false, currentProcess: null };
    const customer = this._data.customers.find(c => c.id == material.customer_id) || null;
    const part = this._data.parts.find(p => p.id == material.part_id) || null;

    const qc = this._data.qcMap[material.id] || null;
    const del = this._data.delMap[material.id] || null;

    let history = [];
    let routeCompleted = false;
    let currentProcess = null;

    if (this._hasRoute(material)) {
      history = DB.getProcessHistory(material);
      routeCompleted = DB.isRouteCompleted(material);
      currentProcess = DB.getCurrentProcess(material);
    }

    let prod = null;
    if (currentProcess) {
      prod = DB.getProcessProduction(material, currentProcess);
    }
    if (!prod) {
      const prods = this._data.prodMap[material.id] || [];
      if (prods.length > 0) {
        prod = prods[prods.length - 1];
      }
    }

    return { material, prod, qc, del, customer, part, history, routeCompleted, currentProcess };
  },

  _parseDate(str) {
    if (!str || str.trim() === "") return null;
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      d = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  },

  _toYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  _formatDateLabel(d) {
    return `${String(d.getDate()).padStart(2, '0')} ${this.MONTH_SHORT_ID[d.getMonth()]}`;
  },

  _generateDateRange(startDate, endDate) {
    const dates = [];
    const s = new Date(startDate);
    const e = new Date(endDate);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  },

  _formatWeight(kg) {
    if (!kg || kg === 0) return "0";
    return kg.toLocaleString("id-ID");
  },

  /* Hanya presentasi grafik — warna dan font dibaca dari token desain
     yang sudah ada sehingga tidak ada palet baru yang diperkenalkan. */
  _chartTheme() {
    const css = getComputedStyle(document.documentElement);
    const token = (name, fallback) => (css.getPropertyValue(name) || fallback).trim();
    const toRgba = (hex, alpha) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return hex;
      return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
    };

    return {
      primary: token("--primary", "#2563eb"),
      success: token("--success", "#10B981"),
      info: token("--info", "#9BACD8"),
      border: token("--border", "#DAD1C8"),
      textMuted: token("--text-tertiary", "#9BACD8"),
      textStrong: token("--text-primary", "#111144"),
      surface: token("--surface", "#F4F1EC"),
      font: getComputedStyle(document.body).fontFamily,
      toRgba,
    };
  },

  /* Gaya sumbu / grid / tooltip yang sama untuk kedua grafik agar terlihat identik. */
  _chartOptions(theme, { tickLimit, tooltipTitle }) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      animation: { duration: 250 },
      layout: { padding: { top: 4, right: 4, bottom: 0, left: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.textStrong,
          titleColor: theme.surface,
          bodyColor: theme.surface,
          titleFont: { family: theme.font, size: 12, weight: "600" },
          bodyFont: { family: theme.font, size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: (items) => (items.length ? tooltipTitle(items[0]) : ""),
            label: (item) => "Berat: " + this._formatWeight(item.parsed.y) + " KG",
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: theme.border, drawTicks: false },
          title: {
            display: true,
            text: "KG",
            color: theme.textMuted,
            font: { family: theme.font, size: 11, weight: "600" },
          },
          ticks: {
            color: theme.textMuted,
            padding: 8,
            font: { family: theme.font, size: 11 },
            callback: (value) => this._formatWeight(value),
          },
        },
        x: {
          border: { color: theme.border },
          grid: { display: false },
          ticks: {
            color: theme.textMuted,
            padding: 6,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: tickLimit,
            font: { family: theme.font, size: 11 },
          },
        },
      },
    };
  },

  computePartStatus(material) {
    const { prod, qc, del, history, routeCompleted, currentProcess } = this._getRelations(material);

    if (del) return "DELIVERY";

    if (this._hasRoute(material)) {
      const qcGate = DB.checkQualityGate(material);
      const qcStatus = qcGate.qcStatus;

      for (const step of history) {
        if (step.process !== "QC" && step.process !== "QC_CHECK") {
          if (step.status === "FINISH_NG") return "PRODUKSI - NG";
        }
      }

      if (qcStatus === "NG") return "QC - NG";

      // Material belum memulai proses produksi sama sekali → INCOMING
      const hasStartedProcess = history.some((h) =>
        !["QC", "QC_CHECK"].includes(h.process) &&
        h.status !== "NOT_STARTED" && h.status !== "WAITING"
      );
      if (!hasStartedProcess) return "INCOMING";

      if (currentProcess && !routeCompleted) return "PROSES PRODUKSI";

      if (qcStatus === "NOT_CHECKED" || qcStatus === null) return "QC";

      if (routeCompleted && qcStatus === "PASS") return "READY DELIVERY";

      return "PROSES PRODUKSI";
    }

    if (!prod) {
      if (material.status_proses === "PROCESS") return "PROSES PRODUKSI";
      return "INCOMING";
    }

    if (prod.production_status === "FINISH_NG" || prod.process_result === "NG") {
      return "PRODUKSI - NG";
    }

    if (prod.production_status === "PROCESS" || prod.status === "PROCESS") {
      return "PROSES PRODUKSI";
    }

    if (prod.production_status === "FINISH" || prod.status === "FINISH") {
      if (!qc) return "QC";
      if (!qc.hasil) return "QC";
      if (qc.hasil === "NG") return "QC - NG";
      if (DB._isQcPassing(qc.hasil)) return "READY DELIVERY";
      return "QC";
    }

    if (prod.status === "WAITING" || prod.production_status === "WAITING") {
      return "INCOMING";
    }

    return "INCOMING";
  },

  getStatusBadgeClass(status) {
    const s = status.toLowerCase();
    if (s.includes("ng")) return "ht-badge-ng";
    if (s.includes("incoming")) return "ht-badge-incoming";
    if (s.includes("produk") && s.includes("proses")) return "ht-badge-process";
    if (s === "qc") return "ht-badge-qc";
    if (s.includes("ready")) return "ht-badge-ready";
    if (s.includes("delivery")) return "ht-badge-delivered";
    return "ht-badge-waiting";
  },

  _getMaterialWeight(material) {
    if (material.berat_total_part) return parseFloat(material.berat_total_part) || 0;
    const qty = parseFloat(material.qty) || 0;
    const berat = parseFloat(material.berat_part_snapshot) || 0;
    return qty * berat;
  },

  _isCurrentMonth(dateStr) {
    if (!dateStr) return false;
    const d = this._parseDate(dateStr);
    if (!d) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  },

  renderKPIs() {
    const { materials, productions, deliveries } = this._data;

    let totalInput = 0;
    let totalBeratInput = 0;
    let totalOutput = 0;
    let totalBeratOutput = 0;

    const prodMap = this._data.prodMap;
    const prodById = {};
    this._data.productions.forEach(p => {
      prodById[p.id] = p;
    });
    const qcMap = this._data.qcMap;
    const delMap = this._data.delMap;

    // Total Input & Total Berat Input dari materials (semua rekaman)
    materials.forEach(m => {
      totalInput += 1;
      totalBeratInput += parseFloat(m.berat_total_part) || 0;
    });

    // Total Output & Total Berat Output dari deliveries (semua rekaman)
    deliveries.forEach(d => {
      const prod = prodById[d.production_id];
      if (prod) {
        const material = materials.find(m => m.id == prod.material_id);
        if (material) {
          totalOutput += 1;
          const beratPerPart = parseFloat(material.berat_part_snapshot) || 0;
          totalBeratOutput += (parseFloat(d.qty_kirim) || 0) * beratPerPart;
        }
      }
    });

    // Target & Persentase Capaian — berdasarkan bulan yang dipilih
    const year = this.state.selectedYear;
    const month = this.state.selectedMonth;
    const targetKey = `${year}-${String(month).padStart(2, '0')}`;
    let target = 0;
    try {
      const targets = DB.get("targets");
      const targetRecord = targets.find(t => t.year === year && t.month === month);
      if (targetRecord) target = parseFloat(targetRecord.target_berat_output) || 0;
    } catch (e) {
      // abaikan
    }

    const monthlyOutput = this._getMonthlyDeliveryWeight(year, month);
    const persentase = target > 0 ? Math.round((monthlyOutput / target) * 100) : null;

    if (this._el.kpiTotalInput) this._el.kpiTotalInput.textContent = totalInput;
    if (this._el.kpiTotalOutput) this._el.kpiTotalOutput.textContent = totalOutput;
    if (this._el.kpiTotalBeratInput) this._el.kpiTotalBeratInput.textContent = this._formatWeight(totalBeratInput);
    if (this._el.kpiTotalBeratOutput) this._el.kpiTotalBeratOutput.textContent = this._formatWeight(totalBeratOutput);

    // Render kartu info target
    this._renderTargetCard(target, monthlyOutput, persentase);
  },

  renderProcessDonutChart() {
    const canvas = this._el.monthlyChartCtx;
    const totalEl = this._el.processDonutTotal;
    const legendEl = this._el.processDonutLegend;
    const centerContainer = this._el.processDonutCenter;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (this._processDonutChart) {
      this._processDonutChart.destroy();
    }

    const { materials } = this._data;

    const processWeights = {};
    let totalWeight = 0;

    materials.forEach(material => {
      if (!this._isHeatTreatmentComplete(material)) return;

      const processType = material.process_type || "Lainnya";
      const weight = this._getMaterialWeight(material);

      if (!processWeights[processType]) processWeights[processType] = 0;
      processWeights[processType] += weight;
      totalWeight += weight;
    });

    const sortedTypes = Object.keys(processWeights).sort((a, b) => processWeights[b] - processWeights[a]);
    const data = sortedTypes.map(t => processWeights[t]);
    const labels = sortedTypes;

    if (totalEl) {
      totalEl.textContent = this._formatWeight(totalWeight);
    }

    const donutColors = [
      "#2563eb",
      "#0891b2",
      "#7c3aed",
      "#059669",
      "#d97706",
      "#64748b",
      "#93c5fd",
    ];
    const backgroundColors = labels.map((_, i) => donutColors[i % donutColors.length]);

    if (totalWeight === 0) {
      canvas.style.display = "none";
      if (totalEl) {
        totalEl.textContent = "—";
      }
      if (centerContainer) {
        centerContainer.style.display = "flex";
      }
      if (legendEl) {
        legendEl.innerHTML = '<div class="ht-donut-empty"><p>Belum ada data produksi yang selesai pada periode ini.</p></div>';
      }
      return;
    }

    canvas.style.display = "block";
    if (centerContainer) {
      centerContainer.style.display = "flex";
    }

    this._processDonutChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderColor: "white",
          borderWidth: 2,
          hoverOffset: 4,
          hoverBorderSaturation: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const val = item.parsed;
                const pct = totalWeight > 0 ? Math.round((val / totalWeight) * 100) : 0;
                return `${item.label}: ${this._formatWeight(val)} KG (${pct}%)`;
              }
            }
          },
        },
        animation: {
          animateRotate: false,
          animateScale: true,
          duration: 500,
          easing: "easeOutQuart",
        },
      }
    });

    if (legendEl) {
      let legendHtml = "";
      labels.forEach((label, i) => {
        const val = data[i];
        const pct = totalWeight > 0 ? Math.round((val / totalWeight) * 100) : 0;
        legendHtml += `<div class="ht-donut-legend-item">
          <span class="ht-donut-legend-swatch" style="background-color:${backgroundColors[i]}"></span>
          <span class="ht-donut-legend-name">${label}</span>
          <span class="ht-donut-legend-value">${this._formatWeight(val)} KG</span>
          <span class="ht-donut-legend-percent">${pct}%</span>
        </div>`;
      });
      legendEl.innerHTML = legendHtml;
    }
  },

  _renderTargetCard(target, output, persentase) {
    const targetDisplay = document.getElementById("targetDisplay");
    const targetMonthLabel = document.getElementById("targetMonthLabel");
    const targetEditBtn = document.getElementById("targetEditBtn");
    if (!targetDisplay || !targetMonthLabel || !targetEditBtn) return;

    const monthName = this.MONTH_NAMES_ID[(this.state.selectedMonth || 1) - 1];
    const year = this.state.selectedYear || new Date().getFullYear();
    targetMonthLabel.textContent = `${monthName} ${year}`;

    if (target === 0) {
      targetDisplay.textContent = "—";
      targetDisplay.classList.add("muted");
    } else {
      targetDisplay.textContent = this._formatWeight(target);
      targetDisplay.classList.remove("muted");
    }

    // Lampirkan handler klik pada tombol edit
    targetEditBtn.onclick = () => this.openTargetModal();
  },

  openTargetModal() {
    const modal = document.getElementById("targetEditModal");
    const input = document.getElementById("targetEditInput");
    if (!modal || !input) return;

    const year = this.state.selectedYear;
    const month = this.state.selectedMonth;
    const targets = DB.get("targets");
    const targetRecord = targets.find(t => t.year === year && t.month === month);
    input.value = targetRecord ? targetRecord.target_berat_output : "";
    HTUI.openModal("targetEditModal");
    setTimeout(() => input.focus(), 100);
  },

  closeTargetModal() {
    const modal = document.getElementById("targetEditModal");
    if (modal) HTUI.closeModal("targetEditModal");
  },

  saveTargetFromModal() {
    const input = document.getElementById("targetEditInput");
    if (!input || !input.value) return;
    const value = parseFloat(input.value);
    if (isNaN(value) || value <= 0) {
      HTUI.toast("Target harus berupa angka positif.", "error");
      return;
    }
    const year = this.state.selectedYear;
    const month = this.state.selectedMonth;
    const targets = DB.get("targets");
    const existingIdx = targets.findIndex(t => t.year === year && t.month === month);
    const record = {
      year,
      month,
      target_berat_output: value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      DB.update("targets", targets[existingIdx].id, record);
    } else {
      DB.insert("targets", record);
    }
    HTUI.toast("Target berhasil disimpan.", "success");
    this.closeTargetModal();
    // Hanya render ulang KPI dan kartu target, bukan seluruh dashboard
    this._cacheData();
    this.renderKPIs();
  },

   _getHeatTreatmentProduction(material) {
    const prods = this._data.prodMap[material.id] || [];
    const htProds = prods.filter(p => {
      const tKey = DB._normalizeProcessKey(p.jenis_treatment);
      return tKey !== "SHOTBLAST" && tKey !== "ANTI_RUST" && tKey !== "QC" && tKey !== "QC_CHECK";
    });
    if (htProds.length > 0) {
      return htProds[htProds.length - 1];
    }
    return null;
  },

  _isHeatTreatmentComplete(material) {
    const prod = this._getHeatTreatmentProduction(material);
    if (!prod) return false;
    return prod.production_status === "FINISH" && prod.process_result !== "NG";
  },

  _getDeliveryChartData() {
    const { deliveries, materials } = this._data;

    const dateWeightMap = {};

    const materialById = {};
    materials.forEach(m => { materialById[m.id] = m; });

    deliveries.forEach(d => {
      if (d.status !== DB.STATUSES.DELIVERY_DELIVERED) return;

      const dateStr = d.tanggal_kirim;
      if (!dateStr) return;

      const material = materialById[d.material_id];
      if (!material) return;

      const beratPerPart = parseFloat(material.berat_part_snapshot) || 0;
      const qtyKirim = parseFloat(d.qty_kirim) || 0;
      const weight = qtyKirim * beratPerPart;

      if (dateWeightMap[dateStr]) {
        dateWeightMap[dateStr] += weight;
      } else {
        dateWeightMap[dateStr] = weight;
      }
    });

    return dateWeightMap;
  },

  _getMonthlyDeliveryWeight(year, month) {
    const { deliveries, materials } = this._data;
    const materialById = {};
    materials.forEach(m => { materialById[m.id] = m; });

    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    let totalWeight = 0;

    deliveries.forEach(d => {
      if (d.status !== DB.STATUSES.DELIVERY_DELIVERED) return;
      const dateStr = d.tanggal_kirim;
      if (!dateStr || !dateStr.startsWith(monthPrefix)) return;

      const material = materialById[d.material_id];
      if (!material) return;

      const beratPerPart = parseFloat(material.berat_part_snapshot) || 0;
      const qtyKirim = parseFloat(d.qty_kirim) || 0;
      totalWeight += qtyKirim * beratPerPart;
    });

    return totalWeight;
  },

  renderProductionChart() {
    const ctx = this._el.dailyChartCtx;
    const emptyEl = this._el.dailyChartEmpty;
    if (!ctx) return;

    const { chartMode, selectedYear, selectedMonth } = this.state;

    const dateWeightMap = this._getDeliveryChartData();

    if (this._chartProduction) {
      this._chartProduction.destroy();
    }

    const theme = this._chartTheme();
    const targets = DB.get("targets");
    let data = [];
    let labels = [];

    const year = selectedYear || new Date().getFullYear();
    const month = selectedMonth || 1;

    if (chartMode === "daily") {
      const dates = this._generateMonthDates(year, month);
      data = dates.map(d => dateWeightMap[this._toYMD(d)] || 0);
      labels = dates.map(d => String(d.getDate()).padStart(2, '0'));

      const hasData = data.some(v => v > 0);
      if (emptyEl) emptyEl.classList.toggle("hidden", hasData);

      const tickLimit = dates.length <= 7 ? dates.length : dates.length <= 14 ? 7 : 10;
      const fullLabels = dates.map(d => HTDateFormat.formatLongDate(d));

      this._chartProduction = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Output Delivery (KG)",
            data: data,
            backgroundColor: theme.toRgba(theme.primary, 0.75),
            hoverBackgroundColor: theme.primary,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 34,
          }]
        },
        options: this._productionChartOptions(theme, {
          tickLimit: tickLimit,
          tooltipTitle: (item) => fullLabels[item.dataIndex] || labels[item.dataIndex],
          showTargetLine: false,
        }),
      });
    } else {
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        let monthTotal = 0;
        for (const dateKey of Object.keys(dateWeightMap)) {
          if (dateKey.startsWith(key)) {
            monthTotal += dateWeightMap[dateKey];
          }
        }
        data.push(monthTotal);
      }
      labels = this.MONTH_SHORT_ID.slice();

      const actualHasData = data.some(v => v > 0);
      if (emptyEl) emptyEl.classList.toggle("hidden", actualHasData);

      const targetData = this.MONTH_NAMES_ID.map((_, m) => {
        const targetRecord = targets.find(t => t.year === year && t.month === m + 1);
        return targetRecord ? parseFloat(targetRecord.target_berat_output) || 0 : 0;
      });

      const monthNames = this.MONTH_NAMES_ID.slice();
      this._chartProduction = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Output Delivery (KG)",
              data: data,
              backgroundColor: theme.primary,
              hoverBackgroundColor: theme.primary,
              borderRadius: 4,
              borderSkipped: false,
              maxBarThickness: 34,
            },
            {
              label: "Target (KG)",
              data: targetData,
              type: "line",
              borderColor: "#bfdbfe",
              borderDash: [5, 5],
              borderWidth: 2,
              backgroundColor: "transparent",
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.3,
            }
          ]
        },
        options: this._productionChartOptions(theme, {
          tickLimit: 12,
          tooltipTitle: (item) => monthNames[item.datasetIndex === 0 ? item.dataIndex : 0] + " " + year,
          showTargetLine: true,
          targetData: targetData,
          actualData: data,
        }),
      });
    }
  },

  _generateMonthDates(year, month) {
    const dates = [];
    const lastDay = new Date(year, month, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      dates.push(new Date(year, month - 1, d));
    }
    return dates;
  },

  _productionChartOptions(theme, opts) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      animation: { duration: 250 },
      layout: { padding: { top: 4, right: 4, bottom: 0, left: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.textStrong,
          titleColor: theme.surface,
          bodyColor: theme.surface,
          titleFont: { family: theme.font, size: 12, weight: "600" },
          bodyFont: { family: theme.font, size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: (items) => (items.length ? opts.tooltipTitle(items[0]) : ""),
            label: (item) => {
              const val = item.parsed.y;
              if (item.dataset.label === "Target (KG)") {
                return "Target: " + this._formatWeight(val) + " KG";
              }
              return "Output: " + this._formatWeight(val) + " KG";
            }
          }
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: theme.border, drawTicks: false },
          title: {
            display: true,
            text: "KG",
            color: theme.textMuted,
            font: { family: theme.font, size: 11, weight: "600" },
          },
          ticks: {
            color: theme.textMuted,
            padding: 8,
            font: { family: theme.font, size: 11 },
            callback: (value) => this._formatWeight(value),
          },
        },
        x: {
          border: { color: theme.border },
          grid: { display: false },
          ticks: {
            color: theme.textMuted,
            padding: 6,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: opts.tickLimit,
            font: { family: theme.font, size: 11 },
          },
        },
      },
    };
  },

  _getFilteredMaterials() {
    const { materials } = this._data;
    const { searchQuery, statusFilter, customerFilter, dateStart, dateEnd } = this.state;

    return materials.filter(m => {
      const relations = this._getRelations(m);
      const { material, customer, part } = relations;

      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const customerName = customer ? customer.nama_customer.toLowerCase() : "";
        const partNo = part ? part.nomor_part.toLowerCase() : "";
        const partName = part ? part.nama_part.toLowerCase() : "";
        const kode = (material.kode || "").toLowerCase();
        const sj = (material.nomor_surat_jalan || "").toLowerCase();
        const lot = (material.lot_no || "").toLowerCase();
        const charge = (material.material_charge || "").toLowerCase();

        if (!kode.includes(search) &&
            !customerName.includes(search) &&
            !partNo.includes(search) &&
            !partName.includes(search) &&
            !sj.includes(search) &&
            !lot.includes(search) &&
            !charge.includes(search)) {
          return false;
        }
      }

      if (statusFilter !== "all") {
        const status = this.computePartStatus(m);
        if (statusFilter === "NG") {
          if (status !== "PRODUKSI - NG" && status !== "QC - NG") return false;
        } else if (statusFilter === "INCOMING") {
          if (status !== "INCOMING") return false;
        } else if (statusFilter === "PROSES PRODUKSI") {
          if (status !== "PROSES PRODUKSI") return false;
        } else if (statusFilter === "QC") {
          if (status !== "QC") return false;
        } else if (statusFilter === "READY DELIVERY") {
          if (status !== "READY DELIVERY") return false;
        } else if (statusFilter === "DELIVERY") {
          if (status !== "DELIVERY") return false;
        } else {
          if (status !== statusFilter) return false;
        }
      }

      if (customerFilter !== "all") {
        if (String(material.customer_id) !== String(customerFilter)) return false;
      }

      if (dateStart && material.tanggal_masuk && material.tanggal_masuk < dateStart) return false;
      if (dateEnd && material.tanggal_masuk && material.tanggal_masuk > dateEnd) return false;

      return true;
    });
  },

  renderTable() {
    const filtered = this._getFilteredMaterials();
    const totalItems = filtered.length;
    const start = (this.state.currentPage - 1) * this.state.pageSize;
    const end = start + this.state.pageSize;
    const pageData = filtered.slice(start, end);

    if (this._el.totalItems) this._el.totalItems.textContent = totalItems;
    const showingStart = totalItems > 0 ? start + 1 : 0;
    const showingEnd = Math.min(end, totalItems);
    if (this._el.pageInfo) this._el.pageInfo.textContent = `${showingStart}-${showingEnd}`;

    const totalPages = Math.ceil(totalItems / this.state.pageSize) || 1;
    if (this._el.prevPage) this._el.prevPage.disabled = this.state.currentPage === 1;
    if (this._el.nextPage) this._el.nextPage.disabled = this.state.currentPage >= totalPages;

    if (this._el.pageNumbers) {
      let pagesHtml = "";
      const maxVisible = 5;
      let startPage = Math.max(1, this.state.currentPage - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);

      if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pagesHtml += `<button class="ht-btn ht-btn-sm ${i === this.state.currentPage ? "ht-btn-primary" : "ht-btn-ghost"}" data-page="${i}">${i}</button>`;
      }
      this._el.pageNumbers.innerHTML = pagesHtml;
      this._el.pageNumbers.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          this.state.currentPage = parseInt(btn.dataset.page);
          this.renderTable();
        });
      });
    }

    const html = pageData.map((m, idx) => {
      const relations = this._getRelations(m);
      const { material, prod, qc, del, customer, part } = relations;

      const statusPart = this.computePartStatus(m);
      const badgeClass = this.getStatusBadgeClass(statusPart);

      const statusQC = qc ? (qc.hasil || "-") : "-";
      const inspectorName = qc ? (qc.inspector || "-") : "-";
      const deliveryDate = del ? (del.tanggal_kirim || "-") : "-";

      // Helper judul untuk kolom yang diizinkan memotong, sehingga
      // nilai lengkap tetap dapat dibaca tanpa memperlebar kolom.
      const title = (v) => ` title="${String(v ?? "-").replace(/"/g, "&quot;")}"`;
      const customerName = customer ? customer.nama_customer : "-";
      const nomorPart = part ? part.nomor_part : "-";
      const namaPart = part ? part.nama_part : "-";
      const suratJalan = material.nomor_surat_jalan || "-";
      const lotNo = material.lot_no || "-";
      const charge = material.material_charge || "-";
      const proses = material.process_type || "-";
      const diinputOleh = material.diinput_oleh || "-";
      const nomorKode = material.kode || "-";

      return `<tr class="hover:bg-slate-50 transition">
        <td class="px-3 py-2">${start + idx + 1}</td>
        <td class="px-3 py-2 font-mono" style="color: var(--primary);"${title(nomorKode)}>${nomorKode}</td>
        <td class="px-3 py-2"${title(customerName)}>${customerName}</td>
        <td class="px-3 py-2 font-mono"${title(nomorPart)}>${nomorPart}</td>
        <td class="px-3 py-2"${title(namaPart)}>${namaPart}</td>
        <td class="px-3 py-2"><span class="ht-badge ${badgeClass}">${statusPart}</span></td>
        <td class="px-3 py-2 font-mono"${title(suratJalan)}>${suratJalan}</td>
        <td class="px-3 py-2"${title(lotNo)}>${lotNo}</td>
        <td class="px-3 py-2"${title(charge)}>${charge}</td>
        <td class="px-3 py-2">${material.qty || 0}</td>
        <td class="px-3 py-2">${this._formatWeight(this._getMaterialWeight(material))} KG</td>
        <td class="px-3 py-2"${title(proses)}>${proses}</td>
        <td class="px-3 py-2"${title(diinputOleh)}>${diinputOleh}</td>
        <td class="px-3 py-2">${HTDateFormat.formatLongDateFromISO(material.tanggal_masuk)}</td>
        <td class="px-3 py-2"><span class="ht-badge ${statusQC === "OK" ? "ht-badge-ok" : (statusQC === "NG" ? "ht-badge-ng" : "ht-badge-waiting")}">${statusQC}</span></td>
        <td class="px-3 py-2"${title(inspectorName)}>${inspectorName}</td>
        <td class="px-3 py-2"${title(deliveryDate)}>${deliveryDate}</td>
        <td class="px-3 py-2">
          <div class="ht-action-group">
             <button onclick="window.location.href='tracking.html?id=${encodeURIComponent(material.id)}'" class="ht-action-btn view" title="Tracking" aria-label="Tracking"><img src="assets/icons/eye.svg" alt="Tracking" class="icon"></button>
          </div>
        </td>
      </tr>`;
    }).join("");

      if (this._el.tableBody) {
        this._el.tableBody.innerHTML = html || '<tr><td colspan="18" class="ht-table-empty"><img src="assets/icons/inbox.svg" alt="Kosong" class="icon"><p>Data monitoring tidak ditemukan.</p><small>Coba ubah kata kunci atau filter yang dipilih.</small></td></tr>';
      }
  },

  renderCustomerFilter() {
    if (!this._el.customerFilter) return;
    const { customers } = this._data;
    let options = '<option value="all">Semua Customer</option>';
    customers.forEach(c => {
      options += `<option value="${c.id}">${c.nama_customer}</option>`;
    });
    this._el.customerFilter.innerHTML = options;
    this._el.customerFilter.value = this.state.customerFilter;
  },

  /* Helper nilai sel untuk ekspor. Mempertahankan konvensi "-" yang
     sama dengan tabel monitoring dan memastikan field yang hilang
     tidak pernah ditulis sebagai "undefined" atau "[object Object]". */
  _exportCell(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "object") return "-";
    return value;
  },

  exportExcel() {
    const filtered = this._getFilteredMaterials();

    if (filtered.length === 0) {
      HTUI.toast("Data tidak tersedia untuk diekspor.", "warning");
      return;
    }

    // Sumber yang sama dengan renderTable(), sehingga file selalu
    // mencocokkan baris yang ditampilkan untuk filter aktif.
    // Seluruh data yang terfilter diekspor, bukan hanya halaman saat ini.
    const exportData = filtered.map((m, idx) => {
      const relations = this._getRelations(m);
      const { material, prod, qc, del, customer, part, history, routeCompleted, currentProcess } = relations;

      const statusPart = this.computePartStatus(m);
      let statusProduksi;
      if (this._hasRoute(material)) {
        if (routeCompleted) {
          statusProduksi = "FINISH";
        } else if (currentProcess) {
          const gate = DB.checkQualityGate(material);
          if (gate.qcStatus === "NG") {
            statusProduksi = "QC NG";
          } else {
            statusProduksi = "PROCESS";
          }
        } else {
          statusProduksi = "INCOMING";
        }
      } else {
        statusProduksi = prod ? (prod.production_status || prod.status || "-") : "-";
      }
      const statusQC = qc ? (qc.hasil || "-") : "-";
      const statusDelivery = del ? "Delivered" : "-";
      const statusTerakhir = statusPart;

      const cell = (v) => this._exportCell(v);

      return {
        "No": idx + 1,
        "Nomor Kode": cell(material.kode),
        "Customer": cell(customer ? customer.nama_customer : null),
        "Nomor Part": cell(part ? part.nomor_part : null),
        "Nama Part": cell(part ? part.nama_part : null),
        "No Surat Jalan": cell(material.nomor_surat_jalan),
        "Lot No": cell(material.lot_no),
        "Material Charge": cell(material.material_charge),
        "Status Part": cell(statusPart),
        "Qty": Number(material.qty) || 0,
        "Berat Total (KG)": Number(this._getMaterialWeight(material)) || 0,
        "Jenis Proses": cell(material.process_type),
        "Diinput Oleh": cell(material.diinput_oleh),
        "Tanggal Incoming": cell(material.tanggal_masuk),
        "Status Produksi": cell(statusProduksi),
        "Status QC": cell(statusQC),
        "Status Delivery": cell(statusDelivery),
        "Status Terakhir": cell(statusTerakhir),
        // Kolom Aksi bersifat UI: diekspor sebagai penanda sederhana, bukan HTML
        "Aksi": "-",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monitoring Produksi");

    const filterInfo = [];
    if (this.state.searchQuery) filterInfo.push(`Search: ${this.state.searchQuery}`);
    if (this.state.statusFilter !== "all") filterInfo.push(`Status: ${this.state.statusFilter}`);
    if (this.state.customerFilter !== "all") {
      const cust = this._data.customers.find(c => c.id == this.state.customerFilter);
      filterInfo.push(`Customer: ${cust ? cust.nama_customer : this.state.customerFilter}`);
    }
    if (this.state.dateStart || this.state.dateEnd) {
      filterInfo.push(`Tanggal: ${this.state.dateStart || "Awal"} - ${this.state.dateEnd || "Akhir"}`);
    }
    if (filterInfo.length > 0) {
      const infoWs = XLSX.utils.json_to_sheet([
        { "Filter Aktif": filterInfo.join(" | "), "Jumlah Data": exportData.length },
      ]);
      XLSX.utils.book_append_sheet(wb, infoWs, "Filter Info");
    }

    const filename = `Rekap_Produksi_${new Date().toISOString().split("T")[0]}.xlsx`;

    if (this._el.exportBtn) this._el.exportBtn.disabled = true;
    try {
      XLSX.writeFile(wb, filename);
      HTUI.toast(`File Excel berhasil didownload (${exportData.length} data).`, "success");
    } catch (e) {
      console.error("[Dashboard] Export error:", e);
      HTUI.toast("Export gagal. Silakan coba lagi.", "error");
    } finally {
      if (this._el.exportBtn) this._el.exportBtn.disabled = false;
    }
  },

  refresh() {
    if (this._el.refreshBtn) {
      this._el.refreshBtn.disabled = true;
      this._el.refreshBtn.innerHTML = '<img src="assets/icons/refresh.svg" alt="Loading" class="icon mr-1 icon-spin"> Memuat...';
    }
    setTimeout(() => {
      this.loadDashboard();
      if (this._el.refreshBtn) {
        this._el.refreshBtn.disabled = false;
        this._el.refreshBtn.innerHTML = '<img src="assets/icons/refresh.svg" alt="Refresh" class="icon mr-1"> Refresh';
      }
      HTUI.toast("Dashboard diperbarui.", "success");
    }, 200);
  },

  _startAutoRefresh() {
    if (this._autoRefreshTimer) clearInterval(this._autoRefreshTimer);
    this._autoRefreshTimer = setInterval(() => {
      try {
        this._cacheData();
        this.renderKPIs();
        this.renderProductionChart();
        this.renderProcessDonutChart();
        this.renderTable();
      } catch (e) {
        console.error("[Dashboard] Auto-refresh error:", e);
      }
    }, 60000);
  },

  _stopAutoRefresh() {
    if (this._autoRefreshTimer) {
      clearInterval(this._autoRefreshTimer);
      this._autoRefreshTimer = null;
    }
  },
};
 
  // Ter ekspor metode untuk handler inline
  window.HTDashboard = HTDashboard;

  // Inisialisasi global saat DOM siap
window.addEventListener("DOMContentLoaded", () => {
  if (!HTUI.requireAuth()) return;
  HTDashboard.init();
});