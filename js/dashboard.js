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
      kpiTotalIncoming: document.getElementById("kpiTotalIncoming"),
      kpiTotalBerat: document.getElementById("kpiTotalBerat"),
      kpiSedangProduksi: document.getElementById("kpiSedangProduksi"),
      kpiMenungguQC: document.getElementById("kpiMenungguQC"),
      kpiSudahDelivery: document.getElementById("kpiSudahDelivery"),
      kpiPartNG: document.getElementById("kpiPartNG"),
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

  renderKPIs() {
    const { materials } = this._data;

    let totalIncoming = materials.length;
    let totalBerat = 0;
    let sedangProduksi = 0;
    let menungguQC = 0;
    let sudahDelivery = 0;
    let partNG = 0;

    materials.forEach(m => {
      const weight = this._getMaterialWeight(m);
      totalBerat += weight;

      const status = this.computePartStatus(m);

      if (status === "PROSES PRODUKSI") sedangProduksi++;
      if (status === "QC" || status === "READY DELIVERY") menungguQC++;
      if (status === "DELIVERY") sudahDelivery++;
      if (status === "PRODUKSI - NG" || status === "QC - NG") partNG++;
    });

    if (this._el.kpiTotalIncoming) this._el.kpiTotalIncoming.textContent = totalIncoming + " Part";
    if (this._el.kpiTotalBerat) this._el.kpiTotalBerat.textContent = this._formatWeight(totalBerat) + " KG";
    if (this._el.kpiSedangProduksi) this._el.kpiSedangProduksi.textContent = sedangProduksi + " Part";
    if (this._el.kpiMenungguQC) this._el.kpiMenungguQC.textContent = menungguQC + " Part";
    if (this._el.kpiSudahDelivery) this._el.kpiSudahDelivery.textContent = sudahDelivery + " Part";
    if (this._el.kpiPartNG) this._el.kpiPartNG.textContent = partNG + " Part";
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

    this._chartDaily = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Total Berat (KG)",
          data: data,
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: "#f1f5f9" }, title: { display: true, text: "Total Berat (KG)" } },
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
        },
      },
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

    const labels = this.MONTH_NAMES_ID;
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

    this._chartMonthly = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Total Berat (KG)",
          data: data,
          backgroundColor: "rgba(16, 185, 129, 0.6)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: "#f1f5f9" }, title: { display: true, text: "Total Berat (KG)" } },
          x: { grid: { display: false } },
        },
      },
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

      const statusPart = this.computePartStatus(m);
      const badgeClass = this.getStatusBadgeClass(statusPart);

      const statusProduksi = prod ? (prod.production_status || prod.status || "-") : "-";
      const statusQC = qc ? (qc.hasil || "-") : "-";
      const statusDelivery = del ? "Delivered" : "-";
      const statusTerakhir = statusPart;
      const badgeClassTerakhir = badgeClass;

      return `<tr class="hover:bg-slate-50 transition">
        <td class="px-3 py-2">${start + idx + 1}</td>
        <td class="px-3 py-2 font-mono">${material.kode || "-"}</td>
        <td class="px-3 py-2">${customer ? customer.nama_customer : "-"}</td>
        <td class="px-3 py-2 font-mono">${part ? part.nomor_part : "-"}</td>
        <td class="px-3 py-2">${part ? part.nama_part : "-"}</td>
        <td class="px-3 py-2 font-mono">${material.nomor_surat_jalan || "-"}</td>
        <td class="px-3 py-2">${material.lot_no || "-"}</td>
        <td class="px-3 py-2">${material.material_charge || "-"}</td>
        <td class="px-3 py-2"><span class="ht-badge ${badgeClass}">${statusPart}</span></td>
        <td class="px-3 py-2">${material.qty || 0}</td>
        <td class="px-3 py-2">${this._formatWeight(this._getMaterialWeight(material))} KG</td>
        <td class="px-3 py-2">${material.process_type || "-"}</td>
        <td class="px-3 py-2">${material.diinput_oleh || "-"}</td>
        <td class="px-3 py-2">${material.tanggal_masuk || "-"}</td>
        <td class="px-3 py-2"><span class="ht-badge ${statusProduksi === "PROCESS" || statusProduksi === "PROCESSES" ? "ht-badge-process" : (statusProduksi === "FINISH" ? "ht-badge-finish" : (statusProduksi === "FINISH_NG" ? "ht-badge-ng" : "ht-badge-waiting"))}">${statusProduksi}</span></td>
        <td class="px-3 py-2"><span class="ht-badge ${statusQC === "OK" ? "ht-badge-ok" : (statusQC === "NG" ? "ht-badge-ng" : "ht-badge-waiting")}">${statusQC}</span></td>
        <td class="px-3 py-2"><span class="ht-badge ${del ? "ht-badge-delivered" : "ht-badge-waiting"}">${statusDelivery}</span></td>
        <td class="px-3 py-2"><span class="ht-badge ${badgeClassTerakhir}">${statusTerakhir}</span></td>
        <td class="px-3 py-2">
          <div class="ht-action-group">
            <button onclick="window.location.href='tracking.html?id=${encodeURIComponent(material.kode || material.id)}'" class="ht-action-btn view" title="Tracking" aria-label="Tracking"><i class="fas fa-eye"></i></button>
          </div>
        </td>
      </tr>`;
    }).join("");

    if (this._el.tableBody) {
      this._el.tableBody.innerHTML = html || '<tr><td colspan="19" class="ht-table-empty"><i class="fas fa-inbox"></i><p>Tidak ada data ditemukan.</p></td></tr>';
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

  exportExcel() {
    const filtered = this._getFilteredMaterials();

    if (filtered.length === 0) {
      HTUI.toast("Tidak ada data untuk diekspor.", "warning");
      return;
    }

    const exportData = filtered.map((m, idx) => {
      const relations = this._getRelations(m);
      const { material, prod, qc, del, customer, part } = relations;

      const statusPart = this.computePartStatus(m);
      const statusProduksi = prod ? (prod.production_status || prod.status || "-") : "-";
      const statusQC = qc ? (qc.hasil || "-") : "-";
      const statusDelivery = del ? "Delivered" : "-";
      const statusTerakhir = statusPart;

      return {
        "No": idx + 1,
        "Nomor Kode": material.kode || "-",
        "Customer": customer ? customer.nama_customer : "-",
        "Nomor Part": part ? part.nomor_part : "-",
        "Nama Part": part ? part.nama_part : "-",
        "Nomor Surat Jalan": material.nomor_surat_jalan || "-",
        "Lot No": material.lot_no || "-",
        "Material Charge": material.material_charge || "-",
        "Status Part": statusPart,
        "Qty": material.qty || 0,
        "Berat Total (KG)": this._getMaterialWeight(material),
        "Jenis Proses": material.process_type || "-",
        "Diinput Oleh": material.diinput_oleh || "-",
        "Tanggal Incoming": material.tanggal_masuk || "-",
        "Status Produksi": statusProduksi,
        "Status QC": statusQC,
        "Status Delivery": statusDelivery,
        "Status Terakhir": statusTerakhir,
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
      const infoWs = XLSX.utils.json_to_sheet([{ "Filter Aktif": filterInfo.join(" | ") }]);
      XLSX.utils.book_append_sheet(wb, infoWs, "Filter Info");
    }

    const filename = `Rekap_Produksi_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    HTUI.toast("File Excel berhasil didownload.", "success");
  },

  refresh() {
    if (this._el.refreshBtn) {
      this._el.refreshBtn.disabled = true;
      this._el.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Memuat...';
    }
    setTimeout(() => {
      this.loadDashboard();
      if (this._el.refreshBtn) {
        this._el.refreshBtn.disabled = false;
        this._el.refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Refresh';
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

// Global init on DOM ready
window.addEventListener("DOMContentLoaded", () => {
  if (!HTUI.requireAuth()) return;
  HTUI.initDate();
  HTDashboard.init();
});