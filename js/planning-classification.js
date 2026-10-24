/* ============================================================
   HT Planning Classification — Klasifikasi Incoming Siap HT
   Menampilkan Incoming yang siap diproses Heat Treatment,
   dikelompokkan berdasarkan jenis proses dan temperatur standar.
   Didukung oleh filter jenis proses tunggal dan tabel
   Rencana Perintah Produksi dengan drag & drop.
   ============================================================ */
const HTPlanningClassification = {
  _activeFilter: "",
  _totalReady: 0,
  _workspace: [],
  _orderChanged: false,
  _searchQuery: "",

  DRAFT_KEY: "ht_production_drafts",
  ORDER_KEY: "ht_production_orders",

  init() {
    this._activeFilter = "";
    this._workspace = [];
    this._orderChanged = false;
    this._populateFilterDropdown();

    var select = document.getElementById("htProcessFilter");
    if (select) {
      select.value = "";
      select.addEventListener("change", function (e) {
        HTPlanningClassification._onFilterChange(e.target.value);
      });
    }

    var saveBtn = document.getElementById("htSaveProductionOrder");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        HTPlanningClassification._onSaveOrderClick();
      });
    }

    var searchInput = document.getElementById("htIncomingSearch");
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        HTPlanningClassification._onSearchInput(e.target.value);
      });
    }
  },

  _onFilterChange(newFilter) {
    if (this._activeFilter && this._workspace.length > 0) {
      this._saveDraft(this._workspace, this._activeFilter);
    }

    this._activeFilter = newFilter;
    var select = document.getElementById("htProcessFilter");
    if (select) select.value = newFilter;

    this._workspace = this._loadDraft(newFilter);
    this._orderChanged = this._workspace.length > 0;

    this._render();
  },

  _onSearchInput(query) {
    this._searchQuery = query || "";
    this._renderIncomingTable();
  },

  _render() {
    this._renderIncomingTable();
    this._renderProductionOrder();
  },

  render(filter) {
    if (filter !== undefined && filter !== this._activeFilter) {
      this._onFilterChange(filter);
      return;
    }

    try {
      var allReady = this._getReadyIncoming();
      this._totalReady = allReady.length;
      this._updateCountDisplay(allReady);
      this._renderIncomingTable();
      this._renderProductionOrder();
    } catch (e) {
      console.error("HTPlanningClassification render error:", e);
      var tableContainer = document.getElementById("htClassificationTable");
      if (tableContainer) {
        tableContainer.innerHTML = '<div class="ht-table-empty">Gagal memuat data. Silakan muat ulang halaman.</div>';
      }
    }
  },

  addToWorkspace(material) {
    var exists = this._workspace.some(function (w) { return w.kode === material.kode; });
    if (exists) {
      this._flashCount("Item sudah ada di rencana");
      return false;
    }

    if (!this._activeFilter) {
      this._flashCount("Pilih jenis proses terlebih dahulu untuk membuat rencana produksi.");
      return false;
    }

    var info = this._getPartInfo(material);
    var part = info.part;
    var customer = info.customer;
    var stdTemp = part ? DB.getPartStandardTemperature(part.id) : null;

    if (!part || part.process_type !== this._activeFilter) {
      this._flashCount("Part tidak dapat ditambahkan karena jenis prosesnya tidak sesuai dengan filter aktif.");
      return false;
    }

    var item = {
      kode: material.kode,
      customer: customer ? customer.nama_customer : "-",
      partName: part ? part.nama_part : "-",
      partNo: part ? part.nomor_part : "-",
      qty: material.qty,
      beratTotal: material.berat_total_part,
      processType: part ? (part.process_type || "") : "",
      stdTemp: stdTemp,
      material: material
    };

    if (!this._orderChanged) {
      this._insertSorted(item);
    } else {
      this._workspace.push(item);
    }

    if (this._activeFilter) {
      this._saveDraft(this._workspace, this._activeFilter);
    }
    this._renderProductionOrder();
    this._renderIncomingTable();
    this._updateCountDisplay(this._getReadyIncoming());
    this._updateProductionTotal();
    return true;
  },

  _insertSorted(item) {
    var num = this._extractKodeNumber(item.kode);
    var pos = 0;
    for (var i = 0; i < this._workspace.length; i++) {
      if (this._extractKodeNumber(this._workspace[i].kode) < num) {
        pos = i + 1;
      } else {
        break;
      }
    }
    this._workspace.splice(pos, 0, item);
  },

  _renderIncomingTable() {
    var tableContainer = document.getElementById("htClassificationTable");
    if (!tableContainer) return;

    var allReady = this._getReadyIncoming();
    var readyMaterials = this._applyFilter(allReady);

    if (this._searchQuery) {
      readyMaterials = this._applySearch(readyMaterials);
    }

    if (readyMaterials.length === 0) {
      tableContainer.innerHTML = '<div class="ht-table-empty">' +
        (this._activeFilter
          ? 'Tidak ada Incoming dengan jenis proses "' + this._activeFilter + '" yang siap diproses.'
          : "Tidak ada Incoming yang siap diproses Heat Treatment.") +
        "</div>";
      return;
    }

    var grouped = this._groupByProcessAndTemp(readyMaterials);

    if (grouped.missingProcessType.length > 0 || grouped.missingTemperature.length > 0) {
      this._renderWithWarnings(tableContainer, grouped);
    } else {
      this._renderTable(tableContainer, grouped);
    }
  },

  _applySearch(materials) {
    var query = this._searchQuery.toLowerCase().trim();
    if (!query) return materials;

    var self = this;
    return materials.filter(function (m) {
      var info = self._getPartInfo(m);
      var part = info.part;
      var customer = info.customer;
      var customerName = customer ? customer.nama_customer : "-";
      var partName = part ? part.nama_part : "-";
      var partNo = part ? part.nomor_part : "-";
      return (
        m.kode.toLowerCase().indexOf(query) !== -1 ||
        customerName.toLowerCase().indexOf(query) !== -1 ||
        partName.toLowerCase().indexOf(query) !== -1 ||
        partNo.toLowerCase().indexOf(query) !== -1
      );
    });
  },

  removeFromWorkspace(kode) {
    this._workspace = this._workspace.filter(function (w) {
      return w.kode !== kode;
    });
    if (this._activeFilter) {
      this._saveDraft(this._workspace, this._activeFilter);
    }
    this._renderProductionOrder();
    this._updateCountDisplay(this._getReadyIncoming());
    this._updateProductionTotal();
  },

  moveInWorkspace(fromIdx, toIdx) {
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= this._workspace.length || toIdx >= this._workspace.length) return;
    var item = this._workspace.splice(fromIdx, 1)[0];
    this._workspace.splice(toIdx, 0, item);
    this._orderChanged = true;
    if (this._activeFilter) {
      this._saveDraft(this._workspace, this._activeFilter);
    }
    this._renderProductionOrder();
    this._updateProductionTotal();
  },

  isInWorkspace(kode) {
    return this._workspace.some(function (w) { return w.kode === kode; });
  },

  _updateCountDisplay(allReady) {
    var self = this;
    var filteredCount = 0;
    if (this._activeFilter) {
      filteredCount = allReady.filter(function (m) {
        var part = HTPlanningClassification._getPartInfo(m).part;
        return part && part.process_type === HTPlanningClassification._activeFilter;
      }).length;
    } else {
      filteredCount = allReady.length;
    }

    var inWorkspaceCount = this._workspace.filter(function (w) {
      if (!self._activeFilter) {
        return w.processType === "";
      }
      return w.processType === self._activeFilter;
    }).length;

    var availableCount = Math.max(0, filteredCount - inWorkspaceCount);

    var countEl = document.getElementById("htClassificationCount");
    if (countEl) {
      countEl.textContent = availableCount + " Incoming siap";
    }

    this._updateSummaryCards(availableCount);
    this._updateIncomingSubtitle();
    this._updateProductionTotal();
  },

  _updateSummaryCards(incomingCount) {
    var incomingEl = document.getElementById("htIncomingSummaryCount");
    if (incomingEl) {
      incomingEl.textContent = incomingCount;
    }

    var productionEl = document.getElementById("htProductionSummaryCount");
    if (productionEl) {
      productionEl.textContent = this._workspace.length;
    }
  },

  _updateIncomingSubtitle() {
    var subtitleEl = document.getElementById("htIncomingSubtitle");
    if (subtitleEl) {
      subtitleEl.textContent = this._activeFilter
        ? "Pilih part yang memenuhi syarat untuk proses " + this._activeFilter
        : "Pilih part yang memenuhi syarat untuk proses";
    }
  },

  _updateProductionTotal() {
    var totalEl = document.getElementById("htTotalPart");
    if (totalEl) {
      totalEl.textContent = this._workspace.length;
    }
  },

  _getGroupKey(item) {
    var hasTemp = item.stdTemp !== null && item.stdTemp !== undefined && isFinite(item.stdTemp);
    if (!hasTemp) return "PENDING";
    return String(item.processType || "") + "|" + String(item.stdTemp);
  },

  _getReadyIncoming() {
    var materials = DB.get("materials");
    return materials.filter(function (m) {
      return (
        m.status_proses === DB.STATUSES.PROSES_WAITING &&
        m.process_route &&
        m.process_route.heat_treatment === true &&
        m.part_id != null
      );
    });
  },

  _applyFilter(materials) {
    if (!this._activeFilter) return materials;

    var self = this;
    return materials.filter(function (m) {
      var info = self._getPartInfo(m);
      var part = info.part;
      return part && part.process_type === self._activeFilter;
    });
  },

  _getPartInfo(material) {
    var part = DB.findPartById(material.part_id);
    var customer = part ? DB.findCustomerById(part.customer_id) : null;
    return { part: part, customer: customer };
  },

  _extractKodeNumber(kode) {
    var m = String(kode).match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  },

  _groupByProcessAndTemp(materials) {
    var groups = {};
    var missingProcessType = [];
    var missingTemperature = [];

    materials.forEach(function (m) {
      var info = HTPlanningClassification._getPartInfo(m);
      var part = info.part;

      if (!part) {
        missingProcessType.push({ kode: m.kode, reason: "Part tidak ditemukan" });
        return;
      }

      var processType = part.process_type || "";
      var stdTemp = DB.getPartStandardTemperature(part.id);

      if (!processType) {
        missingProcessType.push({ kode: m.kode, reason: "process_type kosong", part: part });
        return;
      }

      if (stdTemp === null) {
        missingTemperature.push({ kode: m.kode, reason: "standard_temperature kosong", part: part });
        return;
      }

      if (!groups[processType]) {
        groups[processType] = {};
      }
      if (!groups[processType][stdTemp]) {
        groups[processType][stdTemp] = [];
      }
      groups[processType][stdTemp].push(m);
    });

    return { groups: groups, missingProcessType: missingProcessType, missingTemperature: missingTemperature };
  },

  _renderTable(container, grouped) {
    var processTypes = Object.keys(grouped.groups);
    var html = "";

    processTypes.forEach(function (processType) {
      var temps = grouped.groups[processType];
      var tempKeys = Object.keys(temps).map(Number).sort(function (a, b) { return a - b; });

      html += '<div class="ht-classification-process">';
      html += '<div class="ht-classification-process-title">' + HTPlanningClassification._escapeHtml(processType) + "</div>";

      tempKeys.forEach(function (temp) {
        var items = temps[temp];
        items.sort(function (a, b) {
          return HTPlanningClassification._extractKodeNumber(a.kode) - HTPlanningClassification._extractKodeNumber(b.kode);
        });

        html += '<div class="ht-classification-temp-group">';
        html += '<div class="ht-classification-temp-label">' + temp + "°C</div>";
        html += '<div class="ht-table-wrapper">';
        html += '<table class="ht-table">';
        html += "<thead><tr>" +
          "<th>No.</th>" +
           "<th>Control Number</th>" +
          "<th>Customer</th>" +
          "<th>Part Name / Part No.</th>" +
          "<th>Qty</th>" +
          "<th>Berat (kg)</th>" +
          "<th>Suhu Standar</th>" +
          "<th>Aksi</th>" +
          "</tr></thead>";
        html += "<tbody>";

        items.forEach(function (m, idx) {
          var info = HTPlanningClassification._getPartInfo(m);
          var part = info.part;
          var customer = info.customer;
          var qty = typeof m.qty === "number" ? m.qty.toLocaleString("id-ID") : m.qty;
          var berat = typeof m.berat_total_part === "number" ? m.berat_total_part.toLocaleString("id-ID") : m.berat_total_part;
          var partName = part ? part.nama_part : "-";
          var partNo = part ? part.nomor_part : "-";
          var customerName = customer ? customer.nama_customer : "-";
          var added = HTPlanningClassification.isInWorkspace(m.kode);

          html += '<tr class="ht-incoming-row' + (added ? ' ht-incoming-added' : '') + '" draggable="true"';
          html += ' data-kode="' + HTPlanningClassification._escapeHtml(m.kode) + '"';
          html += ' ondragstart="HTPlanningClassification._onDragStartIncoming(event, \'' + m.kode + '\')"';
          html += ' ondragend="HTPlanningClassification._onDragEndIncoming(event)">';
          html += "<td>" + (idx + 1) + "</td>";
          html += "<td>" + HTPlanningClassification._escapeHtml(m.kode) + "</td>";
          html += "<td>" + HTPlanningClassification._escapeHtml(customerName) + "</td>";
          html += '<td class="ht-part-name-cell">';
          html += '<div class="ht-part-main">' + HTPlanningClassification._escapeHtml(partName) + "</div>";
          html += '<div class="ht-part-sub">' + HTPlanningClassification._escapeHtml(partNo) + "</div>";
          html += "</td>";
          html += "<td>" + qty + " PCS</td>";
          html += "<td>" + berat + " Kg</td>";
          html += "<td>" + temp + "°C</td>";
          html += '<td class="ht-action-cell">';
          html += '<button type="button" class="ht-action-btn ht-add-btn" title="Tambah ke Rencana" aria-label="Tambah ke Rencana" draggable="false" onclick="HTPlanningClassification._onAddIncomingClick(\'' + m.kode + '\')">';
          html += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.75v14.5"/><path d="M4.75 12h14.5"/></svg>';
          html += "</button>";
          html += "</td>";
          html += "</tr>";
        });

        html += "</tbody></table></div></div>";
        html += "</div>";
      });
    });

    container.innerHTML = html;
  },

  _renderWithWarnings(container, grouped) {
    var html = "";

    if (grouped.missingProcessType.length > 0) {
      html += '<div class="ht-classification-warning">';
      html += '<h4 class="ht-warning-title">Data yang memerlukan pemeriksaan — process_type kosong/belum lengkap</h4>';
      html += '<div class="ht-table-wrapper">';
      html += '<table class="ht-table">';
      html += '<thead><tr><th>Kode Incoming</th><th>Alasan</th><th>Part No</th></tr></thead><tbody>';
      grouped.missingProcessType.forEach(function (item) {
        html += "<tr>";
        html += "<td>" + HTPlanningClassification._escapeHtml(item.kode) + "</td>";
        html += "<td>" + HTPlanningClassification._escapeHtml(item.reason) + "</td>";
        html += "<td>" + (item.part ? HTPlanningClassification._escapeHtml(item.part.nomor_part) : '-') + "</td>";
        html += "</tr>";
      });
      html += "</tbody></table></div></div>";
    }

    if (grouped.missingTemperature.length > 0) {
      html += '<div class="ht-classification-warning">';
      html += '<h4 class="ht-warning-title">Data yang memerlukan pemeriksaan — standard_temperature kosong</h4>';
      html += '<div class="ht-table-wrapper">';
      html += '<table class="ht-table">';
      html += '<thead><tr><th>Kode Incoming</th><th>Alasan</th><th>Part No</th><th>Jenis Proses</th></tr></thead><tbody>';
      grouped.missingTemperature.forEach(function (item) {
        html += "<tr>";
        html += "<td>" + HTPlanningClassification._escapeHtml(item.kode) + "</td>";
        html += "<td>" + HTPlanningClassification._escapeHtml(item.reason) + "</td>";
        html += "<td>" + (item.part ? HTPlanningClassification._escapeHtml(item.part.nomor_part) : '-') + "</td>";
        html += "<td>" + (item.part ? HTPlanningClassification._escapeHtml(item.part.process_type || '-') : '-') + "</td>";
        html += "</tr>";
      });
      html += "</tbody></table></div></div>";
    }

    if (Object.keys(grouped.groups).length > 0) {
      html += this._renderTableHtml(grouped);
      container.innerHTML = html;
    } else {
      container.innerHTML = html;
    }
  },

  _renderTableHtml(grouped) {
    var processTypes = Object.keys(grouped.groups);
    var html = "";

    processTypes.forEach(function (processType) {
      var temps = grouped.groups[processType];
      var tempKeys = Object.keys(temps).map(Number).sort(function (a, b) { return a - b; });

      html += '<div class="ht-classification-process">';
      html += '<div class="ht-classification-process-title">' + HTPlanningClassification._escapeHtml(processType) + "</div>";

      tempKeys.forEach(function (temp) {
        var items = temps[temp];
        items.sort(function (a, b) {
          return HTPlanningClassification._extractKodeNumber(a.kode) - HTPlanningClassification._extractKodeNumber(b.kode);
        });

        html += '<div class="ht-classification-temp-group">';
        html += '<div class="ht-classification-temp-label">' + temp + "°C</div>";
        html += '<div class="ht-table-wrapper">';
        html += '<table class="ht-table">';
        html += "<thead><tr>" +
          "<th>No.</th>" +
           "<th>Control Number</th>" +
          "<th>Customer</th>" +
          "<th>Part Name / Part No.</th>" +
          "<th>Qty</th>" +
          "<th>Berat (kg)</th>" +
          "<th>Suhu Standar</th>" +
          "<th>Aksi</th>" +
          "</tr></thead>";
        html += "<tbody>";

        items.forEach(function (m, idx) {
          var info = HTPlanningClassification._getPartInfo(m);
          var part = info.part;
          var customer = info.customer;
          var qty = typeof m.qty === "number" ? m.qty.toLocaleString("id-ID") : m.qty;
          var berat = typeof m.berat_total_part === "number" ? m.berat_total_part.toLocaleString("id-ID") : m.berat_total_part;
          var partName = part ? part.nama_part : "-";
          var partNo = part ? part.nomor_part : "-";
          var customerName = customer ? customer.nama_customer : "-";
          var added = HTPlanningClassification.isInWorkspace(m.kode);

          html += '<tr class="ht-incoming-row' + (added ? ' ht-incoming-added' : '') + '" draggable="true"';
          html += ' data-kode="' + HTPlanningClassification._escapeHtml(m.kode) + '"';
          html += ' ondragstart="HTPlanningClassification._onDragStartIncoming(event, \'' + m.kode + '\')"';
          html += ' ondragend="HTPlanningClassification._onDragEndIncoming(event)">';
          html += "<td>" + (idx + 1) + "</td>";
          html += "<td>" + HTPlanningClassification._escapeHtml(m.kode) + "</td>";
          html += "<td>" + HTPlanningClassification._escapeHtml(customerName) + "</td>";
          html += '<td class="ht-part-name-cell">';
          html += '<div class="ht-part-main">' + HTPlanningClassification._escapeHtml(partName) + "</div>";
          html += '<div class="ht-part-sub">' + HTPlanningClassification._escapeHtml(partNo) + "</div>";
          html += "</td>";
          html += "<td>" + qty + " PCS</td>";
          html += "<td>" + berat + " Kg</td>";
          html += "<td>" + temp + "°C</td>";
          html += '<td class="ht-action-cell">';
          html += '<button type="button" class="ht-action-btn ht-add-btn" title="Tambah ke Rencana" aria-label="Tambah ke Rencana" draggable="false" onclick="HTPlanningClassification._onAddIncomingClick(\'' + m.kode + '\')">';
          html += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.75v14.5"/><path d="M4.75 12h14.5"/></svg>';
          html += "</button>";
          html += "</td>";
          html += "</tr>";
        });

        html += "</tbody></table></div></div>";
        html += "</div>";
      });
    });

    return html;
  },

  _renderTable(container, grouped) {
    var html = this._renderTableHtml(grouped);
    container.innerHTML = html;
  },

  _onDragStartIncoming(e, kode) {
    e.dataTransfer.setData("text/plain", kode);
    var el = e.target.closest(".ht-incoming-row");
    if (el) el.classList.add("ht-incoming-row-dragging");
  },

  _onDragEndIncoming(e) {
    var el = e.target.closest(".ht-incoming-row");
    if (el) el.classList.remove("ht-incoming-row-dragging");
  },

  _onAddIncomingClick(kode) {
    var materials = this._getReadyIncoming();
    var material = materials.find(function (m) { return m.kode === kode; });
    if (!material) return;

    this.addToWorkspace(material);
  },

  _flashCount(message) {
    var countEl = document.getElementById("htClassificationCount");
    if (countEl) {
      var original = countEl.textContent;
      countEl.textContent = message;
      var self = this;
      setTimeout(function () {
        if (countEl) countEl.textContent = original;
      }, 2000);
    }
  },

  /* ---- Production Order table ---- */

  _renderProductionOrder() {
    var container = document.getElementById("htProductionOrderTable");
    if (!container) return;

    var items = this._workspace;

    var self = this;
    var html = "";
    html += '<table class="ht-table ht-production-table"';
    html += ' ondragover="HTPlanningClassification._onDragOverOrder(event)"';
    html += ' ondrop="HTPlanningClassification._onDropToOrder(event)">';
    html += "<thead><tr>";
    html += "<th>No.</th>";
    html += "<th>Control Number</th>";
    html += "<th>Customer</th>";
    html += "<th>Part Name / Part No.</th>";
    html += "<th>Qty</th>";
    html += "<th>Berat (kg)</th>";
    html += "<th>Suhu Standar</th>";
    html += "<th>Keterangan</th>";
    html += "<th>Aksi</th>";
    html += "</tr></thead>";
    html += '<tbody class="ht-production-tbody">';

    if (items.length === 0) {
      html += '<tr class="ht-production-empty-row">';
      html += '<td colspan="9" class="ht-text-center">';
      html += !this._activeFilter
        ? "Pilih jenis proses terlebih dahulu untuk membuat rencana produksi."
        : "Tambahkan Incoming " + this._activeFilter + " ke rencana produksi.";
      html += "</td></tr>";
    }

    if (items.length > 0) {
      var prevTemp = null;
      var rowNum = 0;

      items.forEach(function (item, idx) {
        var qty = typeof item.qty === "number" ? item.qty.toLocaleString("id-ID") : item.qty;
        var berat = typeof item.beratTotal === "number" ? item.beratTotal.toLocaleString("id-ID") : item.beratTotal;
        var currentTemp = item.stdTemp !== null && item.stdTemp !== undefined ? item.stdTemp : null;

        if (prevTemp !== null && currentTemp !== null && prevTemp !== currentTemp) {
          html += '<tr class="ht-jeda-suhu" data-no-action="true">';
          html += '<td colspan="9"><span class="ht-jeda-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5V10"/><path d="M8.5 6h7"/><path d="M2 14a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/></svg></span> <strong>Jeda Ganti Suhu</strong> &mdash; ';
          html += prevTemp + "°C &rarr; " + currentTemp + "°C</td>";
          html += "</tr>";
        }

        if (currentTemp === null) {
          html += '<tr class="ht-pending-row">';
          html += '<td colspan="9"><strong>Data Perlu Diperiksa</strong></td>';
          html += "</tr>";
        }

        rowNum++;

        html += '<tr class="ht-production-row" draggable="true"';
        html += ' data-idx="' + idx + '"';
        html += ' data-group-key="' + self._escapeHtml(self._getGroupKey(item)) + '"';
        html += ' ondragstart="HTPlanningClassification._onDragStartOrderRow(event, ' + idx + ', \'' + item.kode + '\')"';
        html += ' ondragend="HTPlanningClassification._onDragEndOrderRow(event)">';
        html += '<td class="ht-production-row-no">' + rowNum + "</td>";
        html += "<td>" + self._escapeHtml(item.kode) + "</td>";
        html += "<td>" + self._escapeHtml(item.customer || "-") + "</td>";
        html += '<td class="ht-part-name">';
        html += '<div class="ht-part-main">' + self._escapeHtml(item.partName || "-") + "</div>";
        html += '<div class="ht-part-sub">' + self._escapeHtml(item.partNo || "-") + "</div>";
        html += "</td>";
        html += "<td>" + qty + " PCS</td>";
        html += "<td>" + berat + " Kg</td>";
        html += "<td>" + (currentTemp !== null ? currentTemp + "°C" : "-") + "</td>";
        html += "<td>" + self._escapeHtml(item.processType || "-") + "</td>";
        html += '<td class="ht-action-cell">';
        html += '<button type="button" class="ht-action-btn ht-action-delete" title="Keluarkan dari rencana" aria-label="Keluarkan dari rencana" draggable="false" onclick="HTPlanningClassification.removeFromWorkspace(\'' + item.kode + '\')" data-kode="' + item.kode + '">';
        html += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M4 6h16"/></svg>';
        html += "</button>";
        html += "</td>";
        html += "</tr>";

        prevTemp = currentTemp;
      });
    }

    html += "</tbody></table>";
    container.innerHTML = html;
    this._updateProductionTotal();
  },

  _onDragOverOrder(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    var table = e.target.closest("table");
    if (table) table.classList.add("ht-production-drop-target");
  },

  _onDropToOrder(e) {
    e.preventDefault();
    var table = e.target.closest("table");
    if (table) table.classList.remove("ht-production-drop-target");

    var sourceType = e.dataTransfer.getData("text/x-source");
    if (sourceType === "order-row") {
      this._handleReorderDrop(e);
      return;
    }

    if (!this._activeFilter) {
      this._flashCount("Pilih jenis proses terlebih dahulu untuk membuat rencana produksi.");
      return;
    }

    var kode = e.dataTransfer.getData("text/plain");
    if (!kode) return;

    var materials = this._getReadyIncoming();
    var material = materials.find(function (m) { return m.kode === kode; });
    if (!material) return;

    if (this.isInWorkspace(kode)) {
      this._flashCount("Item sudah ada di rencana");
      return;
    }

    var part = this._getPartInfo(material).part;
    if (!part || part.process_type !== this._activeFilter) {
      this._flashCount("Part tidak dapat ditambahkan karena jenis prosesnya tidak sesuai dengan filter aktif.");
      return;
    }

    this.addToWorkspace(material);
  },

  _moveUp(idx) {
    if (idx > 0) {
      this.moveInWorkspace(idx, idx - 1);
    }
  },

  _moveDown(idx) {
    if (idx < this._workspace.length - 1) {
      this.moveInWorkspace(idx, idx + 1);
    }
  },

  _onDragStartOrderRow(e, idx, kode) {
    e.dataTransfer.setData("text/plain", kode);
    e.dataTransfer.setData("text/x-source", "order-row");
    e.dataTransfer.setData("text/x-idx", String(idx));
    e.dataTransfer.effectAllowed = "move";
    var el = e.target.closest("tr");
    if (el) el.classList.add("ht-production-row-dragging");
  },

  _onDragEndOrderRow(e) {
    var el = e.target.closest("tr");
    if (el) el.classList.remove("ht-production-row-dragging");
  },

  _handleReorderDrop(e) {
    var sourceIdx = parseInt(e.dataTransfer.getData("text/x-idx"), 10);
    if (isNaN(sourceIdx)) return;

    var targetRow = e.target.closest("tr");
    var targetIdx;
    if (targetRow) {
      targetIdx = parseInt(targetRow.getAttribute("data-idx"), 10);
      if (isNaN(targetIdx)) {
        targetIdx = this._workspace.length - 1;
      }
    } else {
      targetIdx = this._workspace.length - 1;
    }

    if (sourceIdx === targetIdx) return;

    this._orderChanged = true;
    var item = this._workspace.splice(sourceIdx, 1)[0];
    var insertIdx;
    if (targetIdx < sourceIdx) {
      insertIdx = targetIdx + 1;
    } else {
      insertIdx = targetIdx;
    }
    this._workspace.splice(insertIdx, 0, item);

    if (this._activeFilter) {
      this._saveDraft(this._workspace, this._activeFilter);
    }
    this._renderProductionOrder();
    this._updateProductionTotal();
  },

  /* ---- Filter dropdown ---- */

  _populateFilterDropdown() {
    var select = document.getElementById("htProcessFilter");
    if (!select) return;

    select.innerHTML = "";

    var allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "Semua Jenis Proses";
    select.appendChild(allOption);

    var processTypes = DB.PROCESS_TYPE_OPTIONS || [];
    processTypes.forEach(function (pt) {
      var opt = document.createElement("option");
      opt.value = pt;
      opt.textContent = pt;
      select.appendChild(opt);
    });
  },

  /* ---- Draft storage ---- */

  _getDrafts() {
    var raw = localStorage.getItem(this.DRAFT_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  },

  _saveDrafts(drafts) {
    localStorage.setItem(this.DRAFT_KEY, JSON.stringify(drafts));
  },

  _saveDraft(items, processType) {
    var drafts = this._getDrafts();
    var savedItems = items.map(function (item) {
      return {
        kode: item.kode,
        customer: item.customer,
        partName: item.partName,
        partNo: item.partNo,
        qty: item.qty,
        beratTotal: item.beratTotal,
        processType: item.processType,
        stdTemp: item.stdTemp,
        material_id: item.material ? item.material.id : null,
        part_id: item.material ? item.material.part_id : null,
      };
    });
    drafts[processType] = savedItems;
    this._saveDrafts(drafts);
  },

  _loadDraft(processType) {
    var drafts = this._getDrafts();
    var items = drafts[processType] || [];
    return items.map(function (item) {
      return {
        kode: item.kode,
        customer: item.customer,
        partName: item.partName,
        partNo: item.partNo,
        qty: item.qty,
        beratTotal: item.beratTotal,
        processType: item.processType,
        stdTemp: item.stdTemp,
        material: null,
      };
    });
  },

  _getOrders() {
    var raw = localStorage.getItem(this.ORDER_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  },

  _saveOrders(orders) {
    localStorage.setItem(this.ORDER_KEY, JSON.stringify(orders));
  },

  readProductionOrders(processType) {
    var orders = this._getOrders();
    return orders[processType] || [];
  },

  saveProductionOrder() {
    if (!this._activeFilter || this._workspace.length === 0) return false;

    var orders = this._getOrders();
    var now = new Date().toISOString();

    var savedItems = this._workspace.map(function (item) {
      return {
        kode: item.kode,
        customer: item.customer,
        partName: item.partName,
        partNo: item.partNo,
        qty: item.qty,
        beratTotal: item.beratTotal,
        processType: item.processType,
        stdTemp: item.stdTemp,
        material_id: item.material ? item.material.id : null,
        part_id: item.material ? item.material.part_id : null,
        saved_at: now,
        order_status: "ACTIVE",
      };
    });

    orders[this._activeFilter] = savedItems;
    this._saveOrders(orders);

    this._saveDraft(this._workspace, this._activeFilter);

    return true;
  },

  _onSaveOrderClick() {
    var success = this.saveProductionOrder();
    var btn = document.getElementById("htSaveProductionOrder");
    if (btn) {
      if (success) {
        btn.textContent = "Tersimpan";
        setTimeout(function () {
          btn.textContent = "Simpan";
        }, 1500);
      } else {
        btn.textContent = "Tidak Ada Item";
        setTimeout(function () {
          btn.textContent = "Simpan";
        }, 1500);
      }
    }
  },

  _escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};
