/* ============================================================
   HT-Dashboard — Dashboard monitoring for Heat Treatment system
   Handles KPI rendering, charts, table, filters, search, pagination,
   and Excel export. All data sourced from localStorage via DB.
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
    dailyPeriod: 7,
    dailyStartDate: "",
    dailyEndDate: "",
    monthlyYear: new Date().getFullYear(),
  },

  _data: null,
  _chartDaily: null,
  _chartMonthly: null,
  _autoRefreshTimer: null,

  MONTH_NAMES_ID: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  MONTH_SHORT_ID: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],

  init() {
    DB.init();
    DB.migrate();
    this._cacheElements();
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
      kpiPartNG: document.getElementById("kpiPartNG"),
      kpiPersentaseCapaian: document.getElementById("kpiPersentaseCapaian"),
      dailyChartCtx: document.getElementById("dailyChart"),
      monthlyChartCtx: document.getElementById("monthlyChart"),
      dailyChartEmpty: document.getElementById("dailyChartEmpty"),
      monthlyChartEmpty: document.getElementById("monthlyChartEmpty"),
      searchInput: document.getElementById("searchInput"),
      statusFilter: document.getElementById("statusFilter"),
      customerFilter: document.getElementById("customerFilter"),
      filterDateStart: document.getElementById("filterDateStart"),
      filterDateEnd: document.getElementById("filterDateEnd"),
      dailyPeriod: document.getElementById("dailyPeriod"),
      dailyStartDate: document.getElementById("dailyStartDate"),
      dailyEndDate: document.getElementById("dailyEndDate"),
      monthlyYear: document.getElementById("monthlyYear"),
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
    };
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

    if (this._el.dailyPeriod) {
      this._el.dailyPeriod.addEventListener("change", (e) => {
        this.state.dailyPeriod = parseInt(e.target.value);
        this.state.dailyStartDate = "";
        this.state.dailyEndDate = "";
        this.renderDailyChart();
      });
    }
    if (this._el.dailyStartDate) {
      this._el.dailyStartDate.addEventListener("change", () => {
        this.state.dailyStartDate = this._el.dailyStartDate.value;
        this.renderDailyChart();
      });
    }
    if (this._el.dailyEndDate) {
      this._el.dailyEndDate.addEventListener("change", () => {
        this.state.dailyEndDate = this._el.dailyEndDate.value;
        this.renderDailyChart();
      });
    }
    if (this._el.monthlyYear) {
      this._el.monthlyYear.addEventListener("change", (e) => {
        this.state.monthlyYear = parseInt(e.target.value);
        this.renderMonthlyChart();
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
  },

  loadDashboard() {
    this._cacheData();
    this.renderKPIs();
    this.renderDailyChart();
    this.renderMonthlyChart();
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
      prodMap[p.material_id] = p;
    });

    const qcMap = {};
    qcs.forEach(q => {
      qcMap[q.production_id] = q;
    });

    const delMap = {};
    deliveries.forEach(d => {
      delMap[d.production_id] = d;
    });

    const customers = DB.get("customers");
    const parts = DB.get("parts");

    this._data = { materials, productions, qcs, deliveries, prodMap, qcMap, delMap, customers, parts };
  },

  _getRelations(material) {
    if (!this._data) return { material, prod: null, qc: null, del: null, customer: null, part: null };
    const prod = this._data.prodMap[material.id] || null;
    const qc = prod ? (this._data.qcMap[prod.id] || null) : null;
    const del = prod ? (this._data.delMap[prod.id] || null) : null;
    const customer = this._data.customers.find(c => c.id == material.customer_id) || null;
    const part = this._data.parts.find(p => p.id == material.part_id) || null;
    return { material, prod, qc, del, customer, part };
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

  /* Chart presentation only — colors and font are read from the existing
     design tokens so no new palette is introduced. */
  _chartTheme() {
    const css = getComputedStyle(document.documentElement);
    const token = (name, fallback) => (css.getPropertyValue(name) || fallback).trim();
    const toRgba = (hex, alpha) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return hex;
      return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
    };

    return {
      primary: token("--primary", "#2563EB"),
      success: token("--success", "#10B981"),
      border: token("--border", "#E2E8F0"),
      textMuted: token("--text-tertiary", "#94A3B8"),
      textStrong: token("--text-primary", "#0F172A"),
      surface: token("--surface", "#FFFFFF"),
      font: getComputedStyle(document.body).fontFamily,
      toRgba,
    };
  },

  /* Shared axis / grid / tooltip styling so both charts look identical. */
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
    const { prod, qc, del } = this._getRelations(material);

    if (del) return "DELIVERY";

    if (!prod) {
      if (material.status_proses === "Process") return "PROSES PRODUKSI";
      return "INCOMING";
    }

    if (prod.production_status === "FINISH_NG" || prod.process_result === "NG") {
      return "PRODUKSI - NG";
    }

    if (prod.production_status === "PROCESS" || prod.status === "Process") {
      return "PROSES PRODUKSI";
    }

    if (prod.production_status === "FINISH" || prod.status === "Finish") {
      if (!qc) return "QC";
      if (!qc.hasil) return "QC";
      if (qc.hasil === "NG") return "QC - NG";
      if (qc.hasil === "OK") return "READY DELIVERY";
      return "QC";
    }

    if (prod.status === "Waiting" || prod.production_status === "WAITING") {
      return "INCOMING";
    }

    return "INCOMING";
  },

  getStatusBadgeClass(status) {
    const s = status.toLowerCase();
    if (s.includes("ng")) return "ht-badge-ng";
    if (s.includes("incoming")) return "ht-badge-waiting";
    if (s.includes("produk") && s.includes("proses")) return "ht-badge-process";
    if (s === "qc") return "ht-badge-finish";
    if (s.includes("ready")) return "ht-badge-pending";
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
    const { materials, productions, qcs, deliveries } = this._data;

    let totalInput = 0;
    let totalBeratInput = 0;
    let totalOutput = 0;
    let totalBeratOutput = 0;
    let partNG = 0;

    const prodMap = this._data.prodMap;
    const prodById = {};
    this._data.productions.forEach(p => {
      prodById[p.id] = p;
    });
    const qcMap = this._data.qcMap;
    const delMap = this._data.delMap;

    // Total Input & Total Berat Input from materials (tanggal_masuk)
    materials.forEach(m => {
      if (this._isCurrentMonth(m.tanggal_masuk)) {
        totalInput += 1; // COUNT of materials (Part count)
        totalBeratInput += parseFloat(m.berat_total_part) || 0;
      }
    });

    // Total Output & Total Berat Output from deliveries (tanggal_kirim)
    deliveries.forEach(d => {
      if (this._isCurrentMonth(d.tanggal_kirim)) {
        const prod = prodById[d.production_id];
        if (prod) {
          const material = materials.find(m => m.id == prod.material_id);
          if (material) {
            totalOutput += 1; // COUNT of deliveries (Part count)
            const beratPerPart = parseFloat(material.berat_part_snapshot) || 0;
            totalBeratOutput += (parseFloat(d.qty_kirim) || 0) * beratPerPart;
          }
        }
      }
    });

    // Part NG from qcs (tanggal_inspector)
    qcs.forEach(q => {
      if (q.hasil === "NG" && this._isCurrentMonth(q.tanggal_inspector)) {
        partNG++;
      }
    });

    // Target & Persentase Capaian
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const targetKey = `${year}-${String(month).padStart(2, '0')}`;
    let target = 0;
    try {
      const targets = DB.get("targets");
      const targetRecord = targets.find(t => t.year === year && t.month === month);
      if (targetRecord) target = parseFloat(targetRecord.target_berat_output) || 0;
    } catch (e) {
      // ignore
    }

    const persentase = target > 0 ? Math.round((totalBeratOutput / target) * 100) : null;

    if (this._el.kpiTotalInput) this._el.kpiTotalInput.textContent = totalInput;
    if (this._el.kpiTotalOutput) this._el.kpiTotalOutput.textContent = totalOutput;
    if (this._el.kpiTotalBeratInput) this._el.kpiTotalBeratInput.textContent = this._formatWeight(totalBeratInput);
    if (this._el.kpiTotalBeratOutput) this._el.kpiTotalBeratOutput.textContent = this._formatWeight(totalBeratOutput);
    if (this._el.kpiPartNG) this._el.kpiPartNG.textContent = partNG;

    // Render donut chart
    this._renderDonutChart(target, totalBeratOutput, persentase);

    // Render target info card
    this._renderTargetCard(target, totalBeratOutput, persentase);
  },

  _renderDonutChart(target, output, persentase) {
    const canvas = document.getElementById("donutChart");
    const centerValue = document.getElementById("donutValue");
    const detailEl = document.getElementById("donutDetail");
    if (!canvas || !centerValue || !detailEl) return;

    const ctx = canvas.getContext("2d");

    // Destroy existing chart if any
    if (this._donutChart) {
      this._donutChart.destroy();
    }

    if (target === 0) {
      centerValue.textContent = "—";
      detailEl.textContent = "Target bulan ini belum ditentukan";
      // Draw empty donut (gray)
      this._donutChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          datasets: [{
            data: [1],
            backgroundColor: [getComputedStyle(document.documentElement).getPropertyValue("--border") || "#E2E8F0"],
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
        }
      });
      return;
    }

    const actualPersentase = Math.round((output / target) * 100);
    const displayPersentase = Math.min(actualPersentase, 100);
    const sisa = Math.max(target - output, 0);

    centerValue.textContent = actualPersentase;
    detailEl.textContent = `Output ${this._formatWeight(output)} Kg dari Target ${this._formatWeight(target)} Kg`;

    const css = getComputedStyle(document.documentElement);
    const primaryColor = css.getPropertyValue("--primary") || "#2563EB";
    const successColor = css.getPropertyValue("--success") || "#10B981";
    const borderColor = css.getPropertyValue("--border") || "#E2E8F0";

    const isOverTarget = output >= target;

    this._donutChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        datasets: [{
          data: [displayPersentase, 100 - displayPersentase],
          backgroundColor: [isOverTarget ? successColor : primaryColor, borderColor],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 800,
          easing: "easeOutQuart",
        },
      }
    });
  },

  _renderTargetCard(target, output, persentase) {
    const targetDisplay = document.getElementById("targetDisplay");
    const targetMonthLabel = document.getElementById("targetMonthLabel");
    const targetEditBtn = document.getElementById("targetEditBtn");
    if (!targetDisplay || !targetMonthLabel || !targetEditBtn) return;

    const now = new Date();
    const monthName = this.MONTH_NAMES_ID[now.getMonth()];
    const year = now.getFullYear();

    targetMonthLabel.textContent = `${monthName} ${year}`;

    if (target === 0) {
      targetDisplay.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 w-full">
          <span class="ht-kpi-value font-bold text-slate-400">Belum Diatur</span>
        </div>
      `;
    } else {
      targetDisplay.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 w-full">
          <span class="ht-kpi-value font-bold text-primary">${this._formatWeight(target)}</span>
          <span class="text-xs text-slate-400">Kg</span>
        </div>
      `;
    }

    // Attach click handler to edit button
    targetEditBtn.onclick = () => this.openTargetModal();
  },

  openTargetModal() {
    const modal = document.getElementById("targetEditModal");
    const input = document.getElementById("targetEditInput");
    if (!modal || !input) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
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
    // Only re-render KPIs and target card, not full dashboard reload
    this._cacheData();
    this.renderKPIs();
  },

  _getProductionChartData() {
    const { materials, productions, prodMap } = this._data;

    const finishedProds = productions.filter(p => {
      return p.production_status === "FINISH" && p.process_result !== "NG";
    });

    const dateWeightMap = {};
    finishedProds.forEach(prod => {
      const material = materials.find(m => m.id == prod.material_id);
      if (!material) return;

      let dateStr = prod.tanggal_proses || "";
      if (!dateStr && prod.machine_finish_at) {
        const d = this._parseDate(prod.machine_finish_at);
        if (d) dateStr = this._toYMD(d);
      }
      if (!dateStr) return;

      const weight = this._getMaterialWeight(material);
      if (dateWeightMap[dateStr]) {
        dateWeightMap[dateStr] += weight;
      } else {
        dateWeightMap[dateStr] = weight;
      }
    });

    return dateWeightMap;
  },

  renderDailyChart() {
    const ctx = this._el.dailyChartCtx;
    const emptyEl = this._el.dailyChartEmpty;
    if (!ctx) return;

    const { dailyPeriod, dailyStartDate, dailyEndDate } = this.state;
    let startDate, endDate;

    if (dailyStartDate && dailyEndDate) {
      startDate = dailyStartDate;
      endDate = dailyEndDate;
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (dailyPeriod - 1));
      startDate = this._toYMD(start);
      endDate = this._toYMD(end);
    }

    if (this._el.dailyStartDate) this._el.dailyStartDate.value = startDate;
    if (this._el.dailyEndDate) this._el.dailyEndDate.value = endDate;

    const dateWeightMap = this._getProductionChartData();
    const dates = this._generateDateRange(startDate, endDate);
    const labels = dates.map(d => this._formatDateLabel(d));
    const data = dates.map(d => dateWeightMap[this._toYMD(d)] || 0);

    const hasData = data.some(v => v > 0);

    if (emptyEl) emptyEl.classList.toggle("hidden", hasData);

    if (this._chartDaily) {
      this._chartDaily.destroy();
    }

    const theme = this._chartTheme();
    /* Show fewer date labels on long periods so they never collide. */
    const tickLimit = dates.length <= 7 ? dates.length : dates.length <= 14 ? 7 : 10;
    const fullLabels = dates.map(d => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }));

    this._chartDaily = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Total Berat Produksi (KG)",
          data: data,
          backgroundColor: theme.toRgba(theme.primary, 0.75),
          hoverBackgroundColor: theme.primary,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 34,
        }]
      },
      options: this._chartOptions(theme, {
        tickLimit: tickLimit,
        tooltipTitle: (item) => fullLabels[item.dataIndex] || labels[item.dataIndex],
      }),
    });
  },

  renderMonthlyChart() {
    const ctx = this._el.monthlyChartCtx;
    const emptyEl = this._el.monthlyChartEmpty;
    if (!ctx) return;

    const { monthlyYear } = this.state;

    if (this._el.monthlyYear) {
      const currentYear = new Date().getFullYear();
      const options = [];
      for (let y = 2020; y <= currentYear + 2; y++) {
        options.push(`<option value="${y}" ${y === monthlyYear ? "selected" : ""}>${y}</option>`);
      }
      this._el.monthlyYear.innerHTML = options.join("");
    }

    const { materials, productions } = this._data;

    const finishedProds = productions.filter(p => {
      return p.production_status === "FINISH" && p.process_result !== "NG";
    });

    const monthWeightMap = {};
    finishedProds.forEach(prod => {
      const material = materials.find(m => m.id == prod.material_id);
      if (!material) return;

      let dateStr = prod.tanggal_proses || "";
      if (!dateStr && prod.machine_finish_at) {
        const d = this._parseDate(prod.machine_finish_at);
        if (d) dateStr = this._toYMD(d);
      }
      if (!dateStr) return;

      const year = dateStr.split("-")[0];
      const month = dateStr.split("-")[1];
      if (parseInt(year) !== monthlyYear) return;

      const weight = this._getMaterialWeight(material);
      const key = `${year}-${month}`;
      if (monthWeightMap[key]) {
        monthWeightMap[key] += weight;
      } else {
        monthWeightMap[key] = weight;
      }
    });

    const data = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${monthlyYear}-${String(m).padStart(2, '0')}`;
      data.push(monthWeightMap[key] || 0);
    }

    const hasData = data.some(v => v > 0);

    if (emptyEl) emptyEl.classList.toggle("hidden", hasData);

    if (this._chartMonthly) {
      this._chartMonthly.destroy();
    }

    const theme = this._chartTheme();

    this._chartMonthly = new Chart(ctx, {
      type: "bar",
      data: {
        /* Short month names keep the 12 ticks readable; the full name is
           used in the tooltip. Months without production stay 0. */
        labels: this.MONTH_SHORT_ID.slice(),
        datasets: [{
          label: "Total Berat Produksi (KG)",
          data: data,
          backgroundColor: theme.toRgba(theme.success, 0.75),
          hoverBackgroundColor: theme.success,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 34,
        }]
      },
      options: this._chartOptions(theme, {
        tickLimit: 12,
        tooltipTitle: (item) => this.MONTH_NAMES_ID[item.dataIndex] + " " + monthlyYear,
      }),
    });
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

const statusPart = material.status_part || "-";
      const badgeClass = this.getStatusBadgeClass(this.computePartStatus(m));

      const statusQC = qc ? (qc.hasil || "-") : "-";
      const inspectorName = qc ? (qc.inspector || "-") : "-";
      const deliveryDate = del ? (del.tanggal_kirim || "-") : "-";

      // Title helper for the columns that are allowed to ellipsize, so the
      // full value stays readable without widening the column.
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
        <td class="px-3 py-2 font-mono"${title(nomorKode)}>${nomorKode}</td>
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
        <td class="px-3 py-2">${material.tanggal_masuk || "-"}</td>
        <td class="px-3 py-2"><span class="ht-badge ${statusQC === "OK" ? "ht-badge-ok" : (statusQC === "NG" ? "ht-badge-ng" : "ht-badge-waiting")}">${statusQC}</span></td>
        <td class="px-3 py-2">${inspectorName}</td>
        <td class="px-3 py-2">${deliveryDate}</td>
        <td class="px-3 py-2">
          <div class="ht-action-group">
             <button onclick="window.location.href='tracking.html?id=${encodeURIComponent(material.id)}'" class="ht-action-btn view" title="Tracking" aria-label="Tracking"><img src="assets/icons/eye.svg" alt="Tracking" class="icon"></button>
          </div>
        </td>
      </tr>`;
    }).join("");

    if (this._el.tableBody) {
      this._el.tableBody.innerHTML =            html || '<tr><td colspan="19" class="ht-table-empty"><img src="assets/icons/inbox.svg" alt="Kosong" class="icon"><p>Data monitoring tidak ditemukan.</p><small>Coba ubah kata kunci atau filter yang dipilih.</small></td></tr>';
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

  /* Cell value helper for the export. Keeps the same "-" convention the
     monitoring table uses and makes sure a missing field can never be
     written as "undefined" or "[object Object]". */
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

    // Same source as renderTable(), so the file always matches the rows the
    // table shows for the active filters. The full filtered set is exported,
    // never only the current page.
    const exportData = filtered.map((m, idx) => {
      const relations = this._getRelations(m);
      const { material, prod, qc, del, customer, part } = relations;

      const statusPart = this.computePartStatus(m);
      const statusProduksi = prod ? (prod.production_status || prod.status || "-") : "-";
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
        // Aksi is a UI column: exported as a plain marker, never as HTML
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
        this.renderDailyChart();
        this.renderMonthlyChart();
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
 
// Expose methods for inline handlers
window.HTDashboard = HTDashboard;
 
// Global init on DOM ready
window.addEventListener("DOMContentLoaded", () => {
  if (!HTUI.requireAuth()) return;
  HTUI.initDate();
  HTDashboard.init();
});