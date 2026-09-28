const DB = {
  tables: ["customers", "parts", "materials", "productions", "qcs", "deliveries", "tracking", "targets"],
  SEED_VERSION: "2026-v1",
  init() {
    const currentVersion = localStorage.getItem("ht_db_seed_version");
    if (currentVersion === this.SEED_VERSION) {
      this.tables.forEach((t) => {
        if (!localStorage.getItem("ht_" + t)) {
          localStorage.setItem("ht_" + t, JSON.stringify([]));
        }
      });
      this.migrate();
      return;
    }
    this.tables.forEach((t) => {
      localStorage.setItem("ht_" + t, JSON.stringify([]));
    });
    this.seedDemoData();
    localStorage.setItem("ht_db_seed_version", this.SEED_VERSION);
  },
  get(table) {
    return JSON.parse(localStorage.getItem("ht_" + table) || "[]");
  },
  insert(table, record) {
    const data = this.get(table);
    record.id = Date.now() + Math.floor(Math.random() * 1000);
    record.created_at = new Date().toISOString();
    data.push(record);
    localStorage.setItem("ht_" + table, JSON.stringify(data));
    return record;
  },
  update(table, id, updates) {
    const data = this.get(table);
    const idx = data.findIndex((r) => r.id == id);
    if (idx !== -1) {
      data[idx] = { ...data[idx], ...updates, updated_at: new Date().toISOString() };
      localStorage.setItem("ht_" + table, JSON.stringify(data));
      return data[idx];
    }
    return null;
  },
  delete(table, id) {
    const data = this.get(table).filter((r) => r.id != id);
    localStorage.setItem("ht_" + table, JSON.stringify(data));
  },
  find(table, key, value) {
    return this.get(table).find((r) => r[key] == value);
  },
  findByKode(kode) {
    const normalizedKode = String(kode).trim();
    return this.get("materials").find(
      (m) => String(m["kode"]).trim() === normalizedKode
    );
  },
  findMaterial(idOrKode) {
    return this.get("materials").find((m) => m.id == idOrKode || m.kode === idOrKode);
  },
  findCustomerById(id) {
    return this.get("customers").find((c) => c.id == id);
  },
  findCustomerByKode(kode) {
    return this.get("customers").find((c) => c.kode_customer === kode);
  },
  findPartById(id) {
    return this.get("parts").find((p) => p.id == id);
  },
  findPartByNumber(nomorPart, customerId) {
    return this.get("parts").find((p) => p.nomor_part === nomorPart && p.customer_id == customerId);
  },
  getPartsByCustomer(customerId) {
    return this.get("parts").filter((p) => p.customer_id == customerId);
  },
  getMaterialsByCustomer(customerId) {
    return this.get("materials").filter((m) => m.customer_id == customerId);
  },

  /* ---- Quality Gate (Tahap 3B-1) ---- */
  _processRouteToSteps(route) {
    if (!route || typeof route !== "object") return [];
    var steps = [];
    if (route.heat_treatment) steps.push("HT");
    if (route.qc_check) steps.push("QC");
    if (route.shotblast) steps.push("SHOTBLAST");
    if (route.anti_rust) steps.push("ANTI_RUST");
    return steps;
  },

  _isQcPassing(hasil) {
    var h = String(hasil || "").toUpperCase();
    return h === "OK" || h === "PASS";
  },

  checkQualityGate(kodeOrMaterial) {
    var material;
    if (typeof kodeOrMaterial === "string") {
      material = this.findByKode(kodeOrMaterial) || this.findMaterial(kodeOrMaterial);
    } else {
      material = kodeOrMaterial;
    }

    if (!material) {
      return {
        allowed: false,
        reason: "Material tidak ditemukan",
        qcStatus: "NOT_FOUND",
        processRoute: null,
        processRouteSteps: [],
      };
    }

    var route = material.process_route;
    if (!route || typeof route !== "object") {
      return {
        allowed: false,
        reason: "Process route material tidak tersedia",
        qcStatus: null,
        processRoute: null,
        processRouteSteps: [],
      };
    }

    var qcs = this.get("qcs").filter(function (q) {
      return String(q.material_id) === String(material.id);
    });

    var qc = qcs.length > 0
      ? qcs.reduce(function (latest, q) {
          return !latest || (q.id || 0) > (latest.id || 0) ? q : latest;
        }, null)
      : null;

    if (!qc) {
      return {
        allowed: false,
        reason: "QC belum dilakukan",
        qcStatus: "NOT_CHECKED",
        processRoute: route,
        processRouteSteps: this._processRouteToSteps(route),
      };
    }

    var hasil = (qc.hasil || "").toUpperCase();

    if (hasil === "NG") {
      return {
        allowed: false,
        reason: "QC NG",
        qcStatus: "NG",
        processRoute: route,
        processRouteSteps: this._processRouteToSteps(route),
      };
    }

    if (this._isQcPassing(qc.hasil)) {
      return {
        allowed: true,
        reason: null,
        qcStatus: "PASS",
        processRoute: route,
        processRouteSteps: this._processRouteToSteps(route),
      };
    }

    return {
      allowed: false,
      reason: "QC belum dilakukan",
      qcStatus: "NOT_CHECKED",
      processRoute: route,
      processRouteSteps: this._processRouteToSteps(route),
    };
  },

  /* ---- Quality Gate integration for post-QC processes (Tahap 3B-2) ---- */
  _normalizeProcessName(name) {
    if (!name) return "";
    return String(name).toUpperCase().replace(/\s+/g, "_").replace("-", "_");
  },

  canProceedToProcess(kodeOrMaterial, processName) {
    var material;
    if (typeof kodeOrMaterial === "string") {
      material = this.findByKode(kodeOrMaterial) || this.findMaterial(kodeOrMaterial);
    } else {
      material = kodeOrMaterial;
    }

    if (!material) {
      return {
        allowed: false,
        reason: "Material tidak ditemukan",
        qcStatus: "NOT_FOUND",
        processRoute: null,
        processRouteSteps: [],
        processName: null,
      };
    }

    var qcResult = this.checkQualityGate(material);

    if (!qcResult.allowed) {
      return {
        allowed: false,
        reason: qcResult.reason,
        qcStatus: qcResult.qcStatus,
        processRoute: qcResult.processRoute,
        processRouteSteps: qcResult.processRouteSteps,
        processName: null,
      };
    }

    var steps = qcResult.processRouteSteps || [];
    var route = qcResult.processRoute;
    var proc = this._normalizeProcessName(processName);
    var isInRoute = steps.indexOf(proc) !== -1;

    if (!route) {
      return {
        allowed: false,
        reason: "Process route material tidak tersedia",
        qcStatus: qcResult.qcStatus,
        processRoute: null,
        processRouteSteps: [],
        processName: null,
      };
    }

    if (!isInRoute) {
      return {
        allowed: false,
        allowedRoute: false,
        reason:
          proc + " tidak termasuk dalam process route material",
        qcStatus: qcResult.qcStatus,
        processRoute: route,
        processRouteSteps: steps,
        processName: proc,
      };
    }

    return {
      allowed: true,
      allowedRoute: true,
      reason: null,
      qcStatus: qcResult.qcStatus,
      processRoute: route,
      processRouteSteps: steps,
      processName: proc,
    };
  },

  /* ---- Multi-Process Data Layer (Tahap 3B-3A) ---- */
  _PROCESS_KEY_MAP: {
    "HEAT_TREATMENT": "HT",
    "HT": "HT",
    "HEAT_TREATMENT_PROCESS": "HT",
    "QC": "QC",
    "QC_CHECK": "QC",
    "SHOTBLAST": "SHOTBLAST",
    "SHOT_BLAST": "SHOTBLAST",
    "ANTI_RUST": "ANTI_RUST",
    "ANTIRUST": "ANTI_RUST",
    "ANTI RUST": "ANTI_RUST",
  },

  _PROCESS_ORDER: ["HT", "QC", "SHOTBLAST", "ANTI_RUST"],

  _normalizeProcessKey(name) {
    if (!name) return "";
    var norm = String(name).toUpperCase().replace(/[\s\-_]+/g, "_").replace(/^_+|_+$/g, "");
    return this._PROCESS_KEY_MAP[norm] || norm;
  },

  _resolveMaterial(materialOrKode) {
    if (typeof materialOrKode === "string") {
      return this.findByKode(materialOrKode) || this.findMaterial(materialOrKode);
    }
    return materialOrKode;
  },

  getProcessProduction(material, processName) {
    if (!material) return null;
    var key = this._normalizeProcessKey(processName);
    var productions = this.get("productions").filter(function (p) {
      return String(p.material_id) === String(material.id);
    });

    if (key === "HT") {
      return (
        productions.find(function (p) {
          var tKey = this._normalizeProcessKey(p.jenis_treatment);
          return tKey !== "SHOTBLAST" && tKey !== "ANTI_RUST";
        }, this) || null
      );
    }

    var norm = this._normalizeProcessKey(processName);
    return (
      productions.find(function (p) {
        return this._normalizeProcessKey(p.jenis_treatment) === norm;
      }, this) || null
    );
  },

  isProcessCompleted(material, processName) {
    var key = this._normalizeProcessKey(processName);

    if (key === "QC" || key === "QC_CHECK") {
      var gate = this.checkQualityGate(material);
      return gate.qcStatus === "PASS";
    }

    var prod = this.getProcessProduction(material, processName);
    if (!prod) return false;
    return (
      prod.production_status === "FINISH" && prod.process_result === "OK"
    );
  },

  _getRouteSteps(material) {
    if (!material || !material.process_route) return [];
    return this._processRouteToSteps(material.process_route);
  },

  getNextProcess(material) {
    if (!material) return null;
    var steps = this._getRouteSteps(material);
    if (steps.length === 0) return null;

    for (var i = 0; i < steps.length; i++) {
      if (!this.isProcessCompleted(material, steps[i])) {
        return steps[i];
      }
    }
    return null;
  },

  canStartProcess(kodeOrMaterial, processName) {
    var material =
      typeof kodeOrMaterial === "string"
        ? this._resolveMaterial(kodeOrMaterial)
        : kodeOrMaterial;

    if (!material) {
      return {
        allowed: false,
        reason: "Material tidak ditemukan",
        qcStatus: "NOT_FOUND",
        processRoute: null,
        processRouteSteps: [],
        processName: null,
      };
    }

    var proceedResult = this.canProceedToProcess(material, processName);
    if (!proceedResult.allowed) {
      return {
        allowed: false,
        reason: proceedResult.reason,
        qcStatus: proceedResult.qcStatus,
        processRoute: proceedResult.processRoute,
        processRouteSteps: proceedResult.processRouteSteps,
        processName: proceedResult.processName,
      };
    }

    var targetKey = this._normalizeProcessKey(processName);
    var steps = proceedResult.processRouteSteps;
    var targetIndex = steps.indexOf(targetKey);

    if (targetIndex === -1) {
      return {
        allowed: false,
        reason: targetKey + " tidak termasuk dalam process route material",
        qcStatus: proceedResult.qcStatus,
        processRoute: proceedResult.processRoute,
        processRouteSteps: steps,
        processName: targetKey,
      };
    }

    for (var i = 0; i < targetIndex; i++) {
      if (!this.isProcessCompleted(material, steps[i])) {
        return {
          allowed: false,
          allowedRoute: true,
          reason:
            "Proses " + steps[i] + " belum selesai (harus FINISH + OK)",
          qcStatus: proceedResult.qcStatus,
          processRoute: proceedResult.processRoute,
          processRouteSteps: steps,
          processName: targetKey,
        };
      }
    }

    return {
      allowed: true,
      allowedRoute: true,
      reason: null,
      qcStatus: proceedResult.qcStatus,
      processRoute: proceedResult.processRoute,
      processRouteSteps: steps,
      processName: targetKey,
    };
  },

  /* ---- Multi-Process Read Model (Tahap 3B-3C-1) ----
     Helpers for tracking/dashboard/delivery to interpret a material's
     full process route. All route decisions use material.process_route
     (incoming snapshot). QC always comes from the `qcs` table, never
     from productions. These helpers are READ-ONLY (no insert/update). */
  _qcStatusFor(material) {
    return this.checkQualityGate(material).qcStatus;
  },

  getProcessHistory(materialOrKode) {
    var material = this._resolveMaterial(materialOrKode);
    if (!material) return [];
    var steps = this._getRouteSteps(material);
    if (steps.length === 0) return [];
    var qcStatus = this._qcStatusFor(material);

    return steps.map(function (step) {
      if (step === "QC" || step === "QC_CHECK") {
        var qcEntry = {
          process: step,
          status: qcStatus,
          completed: qcStatus === "PASS",
          production: null,
        };
        return qcEntry;
      }

      var prod = this.getProcessProduction(material, step);
      var info = { process: step, status: "NOT_STARTED", completed: false, production: null };

      if (prod) {
        if (prod.production_status === "PROCESS" || prod.production_status === "PROCESSING" || prod.status === "Process") {
          info.status = "PROCESS";
          info.completed = false;
        } else if (prod.production_status === "FINISH" || prod.status === "Finish") {
          if (prod.process_result === "OK") {
            info.status = "FINISH";
            info.completed = true;
          } else {
            info.status = "FINISH_NG";
            info.completed = false;
          }
        } else if (prod.production_status === "FINISH_NG" || prod.production_status === "NG") {
          info.status = "FINISH_NG";
          info.completed = false;
        } else if (prod.production_status === "WAITING" || prod.status === "Waiting") {
          info.status = "WAITING";
          info.completed = false;
        }
        info.production = prod;
      }
      return info;
    }, this);
  },

  getCurrentProcess(materialOrKode) {
    var material = this._resolveMaterial(materialOrKode);
    if (!material) return null;
    var steps = this._getRouteSteps(material);
    if (steps.length === 0) return null;

    // 1) A production that is in PROCESS state -> that step is the current one.
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      if (step === "QC" || step === "QC_CHECK") continue;
      var prod = this.getProcessProduction(material, step);
      if (
        prod &&
        (prod.production_status === "PROCESS" ||
          prod.production_status === "PROCESSING" ||
          prod.status === "Process")
      ) {
        return step;
      }
    }

    // 2) No PROCESS running: the current/active step is the next unfinished one,
    //    but only if it is actually startable (gate passes).
    var next = this.getNextProcess(material);
    if (next) {
      if (this.canStartProcess(material, next).allowed) {
        return next;
      }
      return null;
    }

    // 3) Everything completed.
    return null;
  },

  isRouteCompleted(materialOrKode) {
    var material = this._resolveMaterial(materialOrKode);
    if (!material) return false;
    var steps = this._getRouteSteps(material);
    if (steps.length === 0) return false;
    for (var i = 0; i < steps.length; i++) {
      if (!this.isProcessCompleted(material, steps[i])) {
        return false;
      }
    }
    return true;
  },

  canDeliver(materialOrKode) {
    var material = this._resolveMaterial(materialOrKode);
    if (!material) {
      return { allowed: false, reason: "Material tidak ditemukan", qcStatus: "NOT_FOUND", processRoute: null, processRouteSteps: [] };
    }

    var steps = this._getRouteSteps(material);
    var gate = this.checkQualityGate(material);

    if (gate.qcStatus === "NG") {
      return { allowed: false, reason: "QC NG", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
    }
    if (gate.qcStatus !== "PASS") {
      return { allowed: false, reason: "QC belum dilakukan", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
    }

    // Entire route must be completed.
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      if (!this.isProcessCompleted(material, step)) {
        var prod = this.getProcessProduction(material, step);
        if (prod) {
          if (prod.production_status === "PROCESS" || prod.production_status === "PROCESSING" || prod.status === "Process") {
            return { allowed: false, reason: "Proses " + step + " sedang berjalan", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
          }
          if (prod.production_status === "FINISH_NG" || prod.process_result === "NG") {
            return { allowed: false, reason: "Proses " + step + " menghasilkan NG", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
          }
        }
        return { allowed: false, reason: "Proses " + step + " belum selesai", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
      }
    }

    // No process may be left in PROCESS / not started.
    var current = this.getCurrentProcess(material);
    if (current) {
      return { allowed: false, reason: "Route belum selesai (ada proses berjalan)", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
    }

    var existingDelivery = this.get("deliveries").find(function (d) {
      return String(d.material_id) === String(material.id);
    });
    if (existingDelivery) {
      return { allowed: false, reason: "Material sudah dikirim", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
    }

    return { allowed: true, reason: null, qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: true };
  },
  migrate() {
    const validPartFields = ["id","customer_id","nomor_part","nama_part","berat_part","satuan_berat","target_hardness","standard_process_route","status","created_at","updated_at"];
    const defaultProcessRoute = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false };
    const parts = this.get("parts");
    let changed = false;
    for (const p of parts) {
      const keys = Object.keys(p);
      for (const k of keys) { if (!validPartFields.includes(k)) { delete p[k]; changed = true; } }
      if (!("target_hardness" in p)) { p.target_hardness = null; changed = true; }
      if (!("status" in p)) { p.status = "Active"; changed = true; }
      if (!("standard_process_route" in p)) { p.standard_process_route = { ...defaultProcessRoute }; changed = true; }
      else {
        const r = p.standard_process_route;
        if (typeof r !== "object" || r === null) { p.standard_process_route = { ...defaultProcessRoute }; changed = true; }
        else {
          if (r.heat_treatment !== true) { r.heat_treatment = true; changed = true; }
          if (r.qc_check !== true) { r.qc_check = true; changed = true; }
          if (!("shotblast" in r)) { r.shotblast = false; changed = true; }
          if (!("anti_rust" in r)) { r.anti_rust = false; changed = true; }
        }
      }
    }
    if (changed) localStorage.setItem("ht_parts", JSON.stringify(parts));
    const validMaterialFields = ["id","kode","customer_id","part_id","nomor_surat_jalan","lot_no","material_charge","status_part","qty","berat_part_snapshot","berat_total_part","tanggal_masuk","keterangan","remarks","process_type","diinput_oleh","qr_code","status_proses","process_route","created_at","updated_at"];
    const defaultMaterialRoute = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false };
    const materials = this.get("materials");
    changed = false;
    for (const m of materials) {
      const keys = Object.keys(m);
      for (const k of keys) { if (!validMaterialFields.includes(k)) { delete m[k]; changed = true; } }
      if (!("remarks" in m)) { m.remarks = ""; changed = true; }
      if (!("qr_code" in m)) { m.qr_code = ""; changed = true; }
      if (!("process_route" in m)) { m.process_route = { ...defaultMaterialRoute }; changed = true; }
      else {
        const r = m.process_route;
        if (typeof r !== "object" || r === null) { m.process_route = { ...defaultMaterialRoute }; changed = true; }
        else {
          if (r.heat_treatment !== true) { r.heat_treatment = true; changed = true; }
          if (r.qc_check !== true) { r.qc_check = true; changed = true; }
          if (!("shotblast" in r)) { r.shotblast = false; changed = true; }
          if (!("anti_rust" in r)) { r.anti_rust = false; changed = true; }
        }
      }
    }
    if (changed) localStorage.setItem("ht_materials", JSON.stringify(materials));
    const validProductionFields = ["id","material_id","incoming_id","tracking_id","status","production_status","start_scan_at","start_scan_by","visual_check_result","visual_check_note","machine_start_at","machine_start_by","finish_scan_at","finish_scan_by","process_result","process_ng_note","machine_finish_at","machine_finish_by","tanggal_proses","jenis_treatment","remarks","created_at","updated_at"];
    const productions = this.get("productions");
    changed = false;
    for (const p of productions) {
      const keys = Object.keys(p);
      for (const k of keys) { if (!validProductionFields.includes(k)) { delete p[k]; changed = true; } }
      const fields = ["start_scan_at","start_scan_by","visual_check_result","visual_check_note","machine_start_at","machine_start_by","finish_scan_at","finish_scan_by","process_result","process_ng_note","machine_finish_at","machine_finish_by","production_status","incoming_id","tracking_id","tanggal_proses","jenis_treatment","remarks"];
      for (const f of fields) { if (!(f in p)) { p[f] = ""; changed = true; } }
      if (!("status" in p)) { p.status = "Waiting"; changed = true; }
      if (!("remarks" in p)) { p.remarks = ""; changed = true; }
      if (!("tracking_id" in p)) { p.tracking_id = ""; changed = true; }
    }
    if (changed) localStorage.setItem("ht_productions", JSON.stringify(productions));
    const validQCFields = ["id","production_id","material_id","hardness","satuan_hardness","hasil","microstructure","remarks","inspector","tanggal_inspector","catatan","user_id","created_at","updated_at"];
    const qcs = this.get("qcs");
    changed = false;
    for (const q of qcs) {
      const keys = Object.keys(q);
      for (const k of keys) { if (!validQCFields.includes(k)) { delete q[k]; changed = true; } }
      if (!("remarks" in q)) { q.remarks = ""; changed = true; }
      if (!("material_id" in q)) { q.material_id = ""; changed = true; }
      if (!("microstructure" in q)) { q.microstructure = null; changed = true; }
    }
    if (changed) localStorage.setItem("ht_qcs", JSON.stringify(qcs));
    const validDeliveryFields = ["id","production_id","material_id","tanggal_kirim","qty_kirim","status","catatan","user_id","remarks","created_at","updated_at"];
    const deliveries = this.get("deliveries");
    changed = false;
    for (const d of deliveries) {
      const keys = Object.keys(d);
      for (const k of keys) { if (!validDeliveryFields.includes(k)) { delete d[k]; changed = true; } }
      if (!("remarks" in d)) { d.remarks = ""; changed = true; }
      if (!("material_id" in d)) { d.material_id = ""; changed = true; }
      if (!("customer_id" in d)) { d.customer_id = ""; changed = true; }
    }
    if (changed) localStorage.setItem("ht_deliveries", JSON.stringify(deliveries));
    const validTrackingFields = ["id","material_id","production_id","delivery_id","remarks","created_at","updated_at"];
    const tracking = this.get("tracking");
    changed = false;
    for (const t of tracking) {
      const keys = Object.keys(t);
      for (const k of keys) { if (!validTrackingFields.includes(k)) { delete t[k]; changed = true; } }
      if (!("remarks" in t)) { t.remarks = ""; changed = true; }
    }
    if (changed) localStorage.setItem("ht_tracking", JSON.stringify(tracking));
    const validTargetFields = ["id","year","month","target_berat_output","created_at","updated_at"];
    const targets = this.get("targets");
    changed = false;
    for (const t of targets) {
      const keys = Object.keys(t);
      for (const k of keys) { if (!validTargetFields.includes(k)) { delete t[k]; changed = true; } }
    }
    if (changed) localStorage.setItem("ht_targets", JSON.stringify(targets));
  },
  seedDemoData() {
    if (this.get("customers").length > 0) return;
    const customers = [
      { id: 1, kode_customer: "CUST-2026-001", nama_customer: "PT Toyota Motor Manufacturing Indonesia", alamat: "Jl. Raya Jakarta-Bogor KM 42, Cibinong", pic: "Budi Santoso", phone: "021-8791234", email: "budi.santoso@toyota-indonesia.co.id", status: "Active", created_at: "2026-01-15T00:00:00Z", updated_at: "2026-01-15T00:00:00Z" },
      { id: 2, kode_customer: "CUST-2026-002", nama_customer: "PT Astra Honda Motor", alamat: "Jl. Laksda Yos Sudarso KM 7, Sunter", pic: "Andi Wijaya", phone: "021-6534567", email: "andi.wijaya@astra-honda.co.id", status: "Active", created_at: "2026-01-20T00:00:00Z", updated_at: "2026-01-20T00:00:00Z" },
      { id: 3, kode_customer: "CUST-2026-003", nama_customer: "PT Yamaha Motor Manufacturing Indonesia", alamat: "Jl. Siliwangi No.88, Bandung", pic: "Citra Dewi", phone: "022-7812345", email: "citra.dewi@yamaha-indonesia.co.id", status: "Active", created_at: "2026-02-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z" },
      { id: 4, kode_customer: "CUST-2026-004", nama_customer: "PT Mitsubishi Motors Indonesia", alamat: "Jl. Gatot Subroto KM 12, Cakung", pic: "Dewi Lestari", phone: "021-4678901", email: "dewi.lestari@mitsubishi-indonesia.co.id", status: "Active", created_at: "2026-02-10T00:00:00Z", updated_at: "2026-02-10T00:00:00Z" },
      { id: 5, kode_customer: "CUST-2026-005", nama_customer: "PT Suzuki Indomobil Motor", alamat: "Jl. Raya Serpong KM 9, Cikupa", pic: "Eka Putra", phone: "021-5987654", email: "eka.putra@suzuki-indomobil.co.id", status: "Active", created_at: "2026-02-15T00:00:00Z", updated_at: "2026-02-15T00:00:00Z" },
    ];
    localStorage.setItem("ht_customers", JSON.stringify(customers));
    const parts = [
      { id: 1, customer_id: 1, nomor_part: "HT-2026-001", nama_part: "Crankshaft A", berat_part: 2.5, satuan_berat: "KG", target_hardness: "58-62 HRC", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true }, status: "Active", created_at: "2026-01-20T00:00:00Z", updated_at: "2026-01-20T00:00:00Z" },
      { id: 2, customer_id: 1, nomor_part: "HT-2026-002", nama_part: "Gear Housing A", berat_part: 3.2, satuan_berat: "KG", target_hardness: "60-64 HRC", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: false }, status: "Active", created_at: "2026-01-22T00:00:00Z", updated_at: "2026-01-22T00:00:00Z" },
      { id: 3, customer_id: 2, nomor_part: "HT-2026-003", nama_part: "Gear Shaft B", berat_part: 1.8, satuan_berat: "KG", target_hardness: "55-60 HRC", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: true }, status: "Active", created_at: "2026-01-25T00:00:00Z", updated_at: "2026-01-25T00:00:00Z" },
      { id: 4, customer_id: 2, nomor_part: "HT-2026-004", nama_part: "Piston Ring B", berat_part: 0.5, satuan_berat: "KG", target_hardness: "700-750 HV", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-01-28T00:00:00Z", updated_at: "2026-01-28T00:00:00Z" },
      { id: 5, customer_id: 3, nomor_part: "HT-2026-005", nama_part: "Camshaft Pro", berat_part: 4.0, satuan_berat: "KG", target_hardness: "45-50 HRC", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-05T00:00:00Z", updated_at: "2026-02-05T00:00:00Z" },
      { id: 6, customer_id: 3, nomor_part: "HT-2026-006", nama_part: "Connecting Rod C", berat_part: 2.1, satuan_berat: "KG", target_hardness: "50-55 HRC", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-08T00:00:00Z", updated_at: "2026-02-08T00:00:00Z" },
      { id: 7, customer_id: 4, nomor_part: "HT-2026-007", nama_part: "Piston Rod X", berat_part: 3.5, satuan_berat: "KG", target_hardness: "58-62 HRC", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-12T00:00:00Z", updated_at: "2026-02-12T00:00:00Z" },
      { id: 8, customer_id: 4, nomor_part: "HT-2026-008", nama_part: "Gear Component X", berat_part: 2.8, satuan_berat: "KG", target_hardness: "55-60 HRC", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-15T00:00:00Z", updated_at: "2026-02-15T00:00:00Z" },
      { id: 9, customer_id: 5, nomor_part: "HT-2026-009", nama_part: "Valve Stem Z", berat_part: 1.2, satuan_berat: "KG", target_hardness: "40-45 HRC", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-18T00:00:00Z", updated_at: "2026-02-18T00:00:00Z" },
      { id: 10, customer_id: 5, nomor_part: "HT-2026-010", nama_part: "Housing Component Z", berat_part: 3.0, satuan_berat: "KG", target_hardness: "50-55 HRC", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-20T00:00:00Z", updated_at: "2026-02-20T00:00:00Z" },
    ];
    localStorage.setItem("ht_parts", JSON.stringify(parts));
    const materials = [
      { id: 1001, kode: "20260001I", customer_id: 1, part_id: 1, nomor_surat_jalan: "SJ-2026-0001", lot_no: "LOT-HT-26001", material_charge: "MC-26001", status_part: "Masspro", qty: 50, berat_part_snapshot: 2.5, berat_total_part: 125, tanggal_masuk: "2026-09-01", keterangan: "Material incoming Toyota", process_type: "Heat Treatment", diinput_oleh: "Operator Incoming 01", qr_code: "20260001I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true }, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
      { id: 1002, kode: "20260002I", customer_id: 1, part_id: 2, nomor_surat_jalan: "SJ-2026-0002", lot_no: "LOT-HT-26002", material_charge: "MC-26002", status_part: "Trial", qty: 30, berat_part_snapshot: 3.2, berat_total_part: 96, tanggal_masuk: "2026-09-03", keterangan: "Material trial Toyota", process_type: "Hardening", diinput_oleh: "Operator Incoming 01", qr_code: "20260002I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: false }, created_at: "2026-09-03T00:00:00Z", updated_at: "2026-09-03T00:00:00Z" },
      { id: 1003, kode: "20260003I", customer_id: 2, part_id: 3, nomor_surat_jalan: "SJ-2026-0003", lot_no: "LOT-HT-26003", material_charge: "MC-26003", status_part: "Masspro", qty: 80, berat_part_snapshot: 1.8, berat_total_part: 144, tanggal_masuk: "2026-09-05", keterangan: "Material incoming Honda", process_type: "Heat Treatment", diinput_oleh: "Operator Incoming 02", qr_code: "20260003I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: true }, created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z" },
      { id: 1004, kode: "20260004I", customer_id: 2, part_id: 4, nomor_surat_jalan: "SJ-2026-0004", lot_no: "LOT-HT-26004", material_charge: "MC-26004", status_part: "Part Awal 1", qty: 100, berat_part_snapshot: 0.5, berat_total_part: 50, tanggal_masuk: "2026-09-08", keterangan: "Part awal Honda", process_type: "Annealing", diinput_oleh: "Operator Incoming 02", qr_code: "20260004I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, created_at: "2026-09-08T00:00:00Z", updated_at: "2026-09-08T00:00:00Z" },
      { id: 1005, kode: "20260005I", customer_id: 3, part_id: 5, nomor_surat_jalan: "SJ-2026-0005", lot_no: "LOT-HT-26005", material_charge: "MC-26005", status_part: "Masspro", qty: 40, berat_part_snapshot: 4.0, berat_total_part: 160, tanggal_masuk: "2026-09-10", keterangan: "Material incoming Yamaha", process_type: "Heat Treatment", diinput_oleh: "Operator Incoming 03", qr_code: "20260005I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-10T00:00:00Z" },
      { id: 1006, kode: "20260006I", customer_id: 3, part_id: 6, nomor_surat_jalan: "SJ-2026-0006", lot_no: "LOT-HT-26006", material_charge: "MC-26006", status_part: "Trial", qty: 60, berat_part_snapshot: 2.1, berat_total_part: 126, tanggal_masuk: "2026-09-12", keterangan: "Material trial Yamaha", process_type: "Tempering", diinput_oleh: "Operator Incoming 03", qr_code: "20260006I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, created_at: "2026-09-12T00:00:00Z", updated_at: "2026-09-12T00:00:00Z" },
      { id: 1007, kode: "20260007I", customer_id: 4, part_id: 7, nomor_surat_jalan: "SJ-2026-0007", lot_no: "LOT-HT-26007", material_charge: "MC-26007", status_part: "Part Awal 2", qty: 35, berat_part_snapshot: 3.5, berat_total_part: 122.5, tanggal_masuk: "2026-09-15", keterangan: "Part awal Mitsubishi", process_type: "Carburizing", diinput_oleh: "Operator Incoming 04", qr_code: "20260007I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, created_at: "2026-09-15T00:00:00Z", updated_at: "2026-09-15T00:00:00Z" },
      { id: 1008, kode: "20260008I", customer_id: 4, part_id: 8, nomor_surat_jalan: "SJ-2026-0008", lot_no: "LOT-HT-26008", material_charge: "MC-26008", status_part: "Masspro", qty: 45, berat_part_snapshot: 2.8, berat_total_part: 126, tanggal_masuk: "2026-09-18", keterangan: "Material incoming Mitsubishi", process_type: "Hardening", diinput_oleh: "Operator Incoming 04", qr_code: "20260008I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, created_at: "2026-09-18T00:00:00Z", updated_at: "2026-09-18T00:00:00Z" },
      { id: 1009, kode: "20260009I", customer_id: 5, part_id: 9, nomor_surat_jalan: "SJ-2026-0009", lot_no: "LOT-HT-26009", material_charge: "MC-26009", status_part: "Part Awal 3", qty: 70, berat_part_snapshot: 1.2, berat_total_part: 84, tanggal_masuk: "2026-09-22", keterangan: "Part awal Suzuki", process_type: "Normalizing", diinput_oleh: "Operator Incoming 05", qr_code: "20260009I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, created_at: "2026-09-22T00:00:00Z", updated_at: "2026-09-22T00:00:00Z" },
      { id: 1010, kode: "20260010I", customer_id: 5, part_id: 10, nomor_surat_jalan: "SJ-2026-0010", lot_no: "LOT-HT-26010", material_charge: "MC-26010", status_part: "Masspro", qty: 25, berat_part_snapshot: 3.0, berat_total_part: 75, tanggal_masuk: "2026-09-25", keterangan: "Material incoming Suzuki", process_type: "Heat Treatment", diinput_oleh: "Operator Incoming 05", qr_code: "20260010I", status_proses: "WAITING", process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, created_at: "2026-09-25T00:00:00Z", updated_at: "2026-09-25T00:00:00Z" },
    ];
    localStorage.setItem("ht_materials", JSON.stringify(materials));
    const productions = [
      { id: 2001, material_id: 1001, incoming_id: 1001, tracking_id: 5001, status: "Finish", production_status: "FINISH", kode: "20260001I", process_result: "OK", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-01T08:10:00", start_scan_by: "Operator Produksi 01", machine_start_at: "2026-09-01T08:15:00", machine_start_by: "Operator Mesin 01", finish_scan_at: "2026-09-01T10:30:00", finish_scan_by: "Operator Produksi 01", machine_finish_at: "2026-09-01T10:35:00", machine_finish_by: "Operator Mesin 01", process_ng_note: "", tanggal_proses: "2026-09-01", jenis_treatment: "Heat Treatment", remarks: "Proses selesai normal", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
      { id: 2002, material_id: 1002, incoming_id: 1002, tracking_id: 5002, status: "Finish", production_status: "FINISH", kode: "20260002I", process_result: "OK", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-03T08:20:00", start_scan_by: "Operator Produksi 02", machine_start_at: "2026-09-03T08:25:00", machine_start_by: "Operator Mesin 02", finish_scan_at: "2026-09-03T11:00:00", finish_scan_by: "Operator Produksi 02", machine_finish_at: "2026-09-03T11:05:00", machine_finish_by: "Operator Mesin 02", process_ng_note: "", tanggal_proses: "2026-09-03", jenis_treatment: "Hardening", remarks: "Proses selesai normal", created_at: "2026-09-03T00:00:00Z", updated_at: "2026-09-03T00:00:00Z" },
      { id: 2003, material_id: 1003, incoming_id: 1003, tracking_id: 5003, status: "Finish", production_status: "FINISH", kode: "20260003I", process_result: "OK", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-05T09:00:00", start_scan_by: "Operator Produksi 01", machine_start_at: "2026-09-05T09:05:00", machine_start_by: "Operator Mesin 01", finish_scan_at: "2026-09-05T12:00:00", finish_scan_by: "Operator Produksi 01", machine_finish_at: "2026-09-05T12:05:00", machine_finish_by: "Operator Mesin 01", process_ng_note: "", tanggal_proses: "2026-09-05", jenis_treatment: "Heat Treatment", remarks: "Proses selesai normal", created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z" },
      { id: 2004, material_id: 1004, incoming_id: 1004, tracking_id: 5004, status: "Finish", production_status: "FINISH_NG", kode: "20260004I", process_result: "NG", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-08T08:30:00", start_scan_by: "Operator Produksi 02", machine_start_at: "2026-09-08T08:35:00", machine_start_by: "Operator Mesin 02", finish_scan_at: "2026-09-08T11:30:00", finish_scan_by: "Operator Produksi 02", machine_finish_at: "2026-09-08T11:35:00", machine_finish_by: "Operator Mesin 02", process_ng_note: "Hasil proses tidak memenuhi parameter yang ditetapkan", tanggal_proses: "2026-09-08", jenis_treatment: "Annealing", remarks: "Part NG setelah proses", created_at: "2026-09-08T00:00:00Z", updated_at: "2026-09-08T00:00:00Z" },
      { id: 2005, material_id: 1005, incoming_id: 1005, tracking_id: 5005, status: "Finish", production_status: "FINISH", kode: "20260005I", process_result: "OK", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-10T08:15:00", start_scan_by: "Operator Produksi 03", machine_start_at: "2026-09-10T08:20:00", machine_start_by: "Operator Mesin 03", finish_scan_at: "2026-09-10T11:00:00", finish_scan_by: "Operator Produksi 03", machine_finish_at: "2026-09-10T11:05:00", machine_finish_by: "Operator Mesin 03", process_ng_note: "", tanggal_proses: "2026-09-10", jenis_treatment: "Heat Treatment", remarks: "Proses selesai normal", created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-10T00:00:00Z" },
      { id: 2006, material_id: 1006, incoming_id: 1006, tracking_id: 5006, status: "Process", production_status: "PROCESS", kode: "20260006I", process_result: "", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-12T08:00:00", start_scan_by: "Operator Produksi 01", machine_start_at: "2026-09-12T08:10:00", machine_start_by: "Operator Mesin 01", finish_scan_at: "", finish_scan_by: "", machine_finish_at: "", machine_finish_by: "", process_ng_note: "", tanggal_proses: "2026-09-12", jenis_treatment: "Tempering", remarks: "Sedang dalam proses produksi", created_at: "2026-09-12T00:00:00Z", updated_at: "2026-09-12T00:00:00Z" },
      { id: 2007, material_id: 1007, incoming_id: 1007, tracking_id: 5007, status: "Waiting", production_status: "WAITING", kode: "20260007I", process_result: "", visual_check_result: "", visual_check_note: "", start_scan_at: "", start_scan_by: "", machine_start_at: "", machine_start_by: "", finish_scan_at: "", finish_scan_by: "", machine_finish_at: "", machine_finish_by: "", process_ng_note: "", tanggal_proses: "", jenis_treatment: "Carburizing", remarks: "Menunggu proses produksi", created_at: "2026-09-15T00:00:00Z", updated_at: "2026-09-15T00:00:00Z" },
      { id: 2008, material_id: 1008, incoming_id: 1008, tracking_id: 5008, status: "Process", production_status: "PROCESS", kode: "20260008I", process_result: "", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-18T08:20:00", start_scan_by: "Operator Produksi 04", machine_start_at: "2026-09-18T08:30:00", machine_start_by: "Operator Mesin 04", finish_scan_at: "", finish_scan_by: "", machine_finish_at: "", machine_finish_by: "", process_ng_note: "", tanggal_proses: "2026-09-18", jenis_treatment: "Hardening", remarks: "Sedang dalam proses produksi", created_at: "2026-09-18T00:00:00Z", updated_at: "2026-09-18T00:00:00Z" },
    ];
    localStorage.setItem("ht_productions", JSON.stringify(productions));
    const qcs = [
      { id: 3001, production_id: 2001, material_id: 1001, hardness: "60", satuan_hardness: "HRC", hasil: "OK", microstructure: null, remarks: "Hasil hardness sesuai target", inspector: "Inspector QC 01", tanggal_inspector: "2026-09-03", catatan: "", user_id: 1, created_at: "2026-09-03T00:00:00Z", updated_at: "2026-09-03T00:00:00Z" },
      { id: 3002, production_id: 2002, material_id: 1002, hardness: "62", satuan_hardness: "HRC", hasil: "OK", microstructure: null, remarks: "Hasil hardness sesuai target", inspector: "Inspector QC 01", tanggal_inspector: "2026-09-05", catatan: "", user_id: 1, created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z" },
      { id: 3003, production_id: 2003, material_id: 1003, hardness: "57", satuan_hardness: "HRC", hasil: "OK", microstructure: null, remarks: "Hasil hardness sesuai target", inspector: "Inspector QC 02", tanggal_inspector: "2026-09-07", catatan: "", user_id: 2, created_at: "2026-09-07T00:00:00Z", updated_at: "2026-09-07T00:00:00Z" },
      { id: 3004, production_id: 2005, material_id: 1005, hardness: "48", satuan_hardness: "HRC", hasil: "OK", microstructure: null, remarks: "Hasil hardness sesuai target", inspector: "Inspector QC 02", tanggal_inspector: "2026-09-12", catatan: "", user_id: 2, created_at: "2026-09-12T00:00:00Z", updated_at: "2026-09-12T00:00:00Z" },
      { id: 3005, production_id: 2004, material_id: 1004, hardness: "680", satuan_hardness: "HV", hasil: "NG", microstructure: null, remarks: "Hasil hardness di luar target", inspector: "Inspector QC 03", tanggal_inspector: "2026-09-10", catatan: "Hardness di bawah target", user_id: 3, created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-10T00:00:00Z" },
    ];
    localStorage.setItem("ht_qcs", JSON.stringify(qcs));
    const tracking = [
      { id: 5001, material_id: 1001, production_id: 2001, delivery_id: 4001, remarks: "Tracking selesai sampai delivery", created_at: "2026-09-04T00:00:00Z", updated_at: "2026-09-04T00:00:00Z" },
      { id: 5002, material_id: 1002, production_id: 2002, delivery_id: 4002, remarks: "Tracking selesai sampai delivery", created_at: "2026-09-06T00:00:00Z", updated_at: "2026-09-06T00:00:00Z" },
      { id: 5003, material_id: 1003, production_id: 2003, delivery_id: 4003, remarks: "Tracking selesai sampai delivery", created_at: "2026-09-08T00:00:00Z", updated_at: "2026-09-08T00:00:00Z" },
      { id: 5004, material_id: 1004, production_id: 2004, delivery_id: null, remarks: "Part NG pada proses dan QC, belum delivery", created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-10T00:00:00Z" },
      { id: 5005, material_id: 1005, production_id: 2005, delivery_id: null, remarks: "Production selesai, menunggu proses delivery", created_at: "2026-09-12T00:00:00Z", updated_at: "2026-09-12T00:00:00Z" },
    ];
    localStorage.setItem("ht_tracking", JSON.stringify(tracking));
    const deliveries = [
      { id: 4001, production_id: 2001, material_id: 1001, tanggal_kirim: "2026-09-04", qty_kirim: 50, status: "Delivered", catatan: "Delivery customer berhasil", user_id: 1, remarks: "", created_at: "2026-09-04T00:00:00Z", updated_at: "2026-09-04T00:00:00Z" },
      { id: 4002, production_id: 2002, material_id: 1002, tanggal_kirim: "2026-09-06", qty_kirim: 30, status: "Delivered", catatan: "Delivery customer berhasil", user_id: 1, remarks: "", created_at: "2026-09-06T00:00:00Z", updated_at: "2026-09-06T00:00:00Z" },
      { id: 4003, production_id: 2003, material_id: 1003, tanggal_kirim: "2026-09-08", qty_kirim: 80, status: "Delivered", catatan: "Delivery customer berhasil", user_id: 2, remarks: "", created_at: "2026-09-08T00:00:00Z", updated_at: "2026-09-08T00:00:00Z" },
    ];
    localStorage.setItem("ht_deliveries", JSON.stringify(deliveries));
  },
};
