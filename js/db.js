const DB = {
  tables: ["customers", "parts", "materials", "productions", "qcs", "deliveries", "tracking", "targets"],
  SEED_VERSION: "2026-v2",

  /* ---- Konstanta status ternormalisasi (satu sumber kebenaran) ---- */
  STATUSES: {
    /* Status entitas (Customer / Part / Material) */
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    /* Status produksi umum (untuk field `status` dan `production_status`) */
    STATUS_WAITING: "WAITING",
    STATUS_PROCESS: "PROCESS",
    STATUS_FINISH: "FINISH",
    STATUS_FINISH_NG: "FINISH_NG",
    /* Status material (alias untuk nilai kanonis yang sama) */
    PROSES_WAITING: "WAITING",
    PROSES_PROCESS: "PROCESS",
    PROSES_FINISH: "FINISH",
    PROSES_FINISH_NG: "FINISH_NG",
    /* Status produksi (alias) */
    PROD_WAITING: "WAITING",
    PROD_PROCESS: "PROCESS",
    PROD_FINISH: "FINISH",
    PROD_FINISH_NG: "FINISH_NG",
    /* Hasil proses / QC */
    RESULT_OK: "OK",
    RESULT_NG: "NG",
    /* Status pengiriman */
    DELIVERY_DELIVERED: "Delivered",
    DELIVERY_PENDING: "Pending",
    DELIVERY_CANCELLED: "Cancelled",
  },

  /* Definisi skema per-tabel untuk validasi */
  SCHEMAS: {
    customers: ["id", "kode_customer", "nama_customer", "alamat", "pic", "phone", "email", "status", "created_at", "updated_at"],
    parts: ["id", "customer_id", "nomor_part", "nama_part", "berat_part", "satuan_berat", "target_hardness", "standard_temperature", "process_type", "standard_process_route", "status", "created_at", "updated_at"],
    materials: ["id", "kode", "customer_id", "part_id", "nomor_surat_jalan", "lot_no", "material_charge", "status_part", "qty", "berat_part_snapshot", "berat_total_part", "tanggal_masuk", "keterangan", "remarks", "process_type", "diinput_oleh", "qr_code", "status_proses", "process_route", "created_at", "updated_at"],
    productions: ["id", "material_id", "incoming_id", "tracking_id", "status", "production_status", "kode", "process_result", "visual_check_result", "visual_check_note", "visual_check_operator", "start_scan_at", "start_scan_by", "machine_start_at", "machine_start_by", "finish_scan_at", "finish_scan_by", "process_ng_note", "machine_finish_at", "machine_finish_by", "tanggal_proses", "jenis_treatment", "remarks", "created_at", "updated_at", "standard_temperature_snapshot", "temperature_tolerance_snapshot", "actual_temperature", "temperature_min", "temperature_max", "temperature_deviation", "temperature_result", "temperature_recorded_at", "temperature_recorded_by"],
    qcs: ["id", "production_id", "material_id", "hardness", "satuan_hardness", "hasil", "microstructure", "remarks", "inspector", "tanggal_inspector", "catatan", "user_id", "created_at", "updated_at"],
    deliveries: ["id", "production_id", "material_id", "customer_id", "tanggal_kirim", "qty_kirim", "nama_pengirim", "status", "catatan", "user_id", "remarks", "created_at", "updated_at"],
    tracking: ["id", "material_id", "production_id", "delivery_id", "remarks", "created_at", "updated_at"],
     targets: ["id", "year", "month", "target_berat_output", "created_at", "updated_at"],
   },

  /* ---- Daftar Jenis Proses (single source of truth) ----
     Daftar kanonis yang ditawarkan pada formulir (Master Part, Incoming).
     Nilai lama seperti "Heat Treatment", "Quenching", "Hardening",
     "Tempering" yang tidak ada di daftar ini dianggap LEGACY: tidak
     dikonversi otomatis, tetap disimpan, dan ditandai untuk ditinjau. */
  PROCESS_TYPE_OPTIONS: [
    "Quenching & Tempering",
    "Annealing",
    "Carburizing",
    "Normalizing",
    "Full Annealing",
    "Stress Relief Annealing",
    "Spheroidizing Annealing",
  ],

  isProcessTypeValid(v) {
    return this.PROCESS_TYPE_OPTIONS.indexOf(v) !== -1;
  },
  /* Legacy = nilai tak kosong yang tidak termasuk dalam daftar kanonis.
     Digunakan UI untuk menampilkan peringatan agar admin memperbarui master. */
   isProcessTypeLegacy(v) {
     if (!v) return false;
     return !this.isProcessTypeValid(v);
   },

   /* ---- Validasi Suhu Proses Heat Treatment ----
      Nilai default toleransi ±15°C. ID Part = sumber standar suhu.
      Hasil OK inklusif pada batas min/max (actual >= min && actual <= max). */
   TEMPERATURE_DEFAULT_TOLERANCE: 15,

   /* ---- Resolusi Standar Suhu dari master Part ----
      Mengembalikan nilai standard_temperature (number) atau null bila
      Part tidak ditemukan / belum di-set. */
   getPartStandardTemperature(partId) {
     const p = this.findPartById(partId);
     if (!p) return null;
     const v = p.standard_temperature;
     const n = Number(v);
     return (v !== null && v !== undefined && String(v).trim() !== "" && isFinite(n)) ? n : null;
   },

   /* Mengembalikan { result, min, max, deviation, standard, tolerance }.
      - standard null/undefined/"" -> result "NG" (standar belum di-set),
        min/max/deviation null.
      - actual kosong / bukan angka -> result "NG", deviation null
        (min/max tetap dihitung bila standard tersedia).
      - result "OK" bila actual dalam [min, max] inklusif; "NG" bila di luar.
        Toleransi default DB.TEMPERATURE_DEFAULT_TOLERANCE (±15). */
   validateTemperature(actual, standard, tolerance) {
     const tol = (typeof tolerance === "number" && isFinite(tolerance)) ? tolerance : this.TEMPERATURE_DEFAULT_TOLERANCE;
     const rawStandard = standard;
     const hasStandard = rawStandard !== null && rawStandard !== undefined && String(rawStandard).trim() !== "";
     let min = null, max = null, deviation = null, result = "NG";
     if (hasStandard) {
       const s = Number(rawStandard);
       min = s - tol;
       max = s + tol;
       const rawActual = actual;
       const actualStr = String(rawActual === null || rawActual === undefined ? "" : rawActual).trim();
       const a = Number(rawActual);
       if (actualStr !== "" && isFinite(a)) {
         deviation = a - s;
         result = (a >= min && a <= max) ? "OK" : "NG";
       }
     }
     return {
       result: result,
       min: min,
       max: max,
       deviation: deviation,
       standard: hasStandard ? Number(rawStandard) : null,
       tolerance: tol,
     };
   },

  /* Audit ringan: himpunan data dengan process_type / jenis_treatment
     legacy (tidak termasuk daftar baru). Dipakai untuk laporan "perlu
     ditinjau". Tidak mengubah data apa pun. */
  getLegacyProcessTypeReport() {
    const report = [];
    this.get("parts").forEach((p) => {
      if (this.isProcessTypeLegacy(p.process_type)) {
        report.push({ table: "parts", id: p.id, item: p.nomor_part, value: p.process_type });
      }
    });
    this.get("materials").forEach((m) => {
      if (this.isProcessTypeLegacy(m.process_type)) {
        report.push({ table: "materials", id: m.id, item: m.kode, value: m.process_type });
      }
    });
    this.get("productions").forEach((p) => {
      if (this.isProcessTypeLegacy(p.jenis_treatment)) {
        report.push({ table: "productions", id: p.id, item: p.kode, value: p.jenis_treatment });
      }
    });
    return report;
  },

  /* Referensi kunci asing: field → { tabel, kolomKunci } */
  REFERENTIAL_INTEGRITY: {
    materials: { customer_id: "customers", part_id: "parts" },
    productions: { material_id: "materials" },
    qcs: { material_id: "materials", production_id: "productions" },
    deliveries: { material_id: "materials", production_id: "productions" },
    tracking: { material_id: "materials", production_id: "productions", delivery_id: "deliveries" },
  },

  _seq: 0,

  /* ---- Penghitung ID monoton (aman dari tabrakan, persisten) ---- */
  _initIdCounter() {
    if (!localStorage.getItem("ht_id_counter")) {
      let maxId = 0;
      this.tables.forEach((t) => {
        const rows = this.get(t);
        rows.forEach((r) => {
          if (r && typeof r.id === "number" && r.id > maxId) maxId = r.id;
        });
      });
      localStorage.setItem("ht_id_counter", String(maxId));
    }
  },

  _nextId() {
    this._seq += 1;
    return Date.now() + this._seq;
  },

  KODE_YEAR_MAP: {
    2026: "M",
  },

  _KEY_INCOMING_KODE_COUNTER: "ht_incoming_kode_counter",

  _initIncomingKodeCounter() {
    if (localStorage.getItem(this._KEY_INCOMING_KODE_COUNTER)) return;
    const counter = {};
    this.get("materials").forEach((m) => {
      const parsed = this._parseIncomingKode(m.kode);
      if (parsed) {
        if (!counter[parsed.year] || parsed.seq > counter[parsed.year]) {
          counter[parsed.year] = parsed.seq;
        }
      }
    });
    localStorage.setItem(this._KEY_INCOMING_KODE_COUNTER, JSON.stringify(counter));
  },

  _getIncomingKodeCounter() {
    const raw = localStorage.getItem(this._KEY_INCOMING_KODE_COUNTER);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  },

  _setIncomingKodeCounter(counter) {
    localStorage.setItem(this._KEY_INCOMING_KODE_COUNTER, JSON.stringify(counter));
  },

  _parseIncomingKode(kode) {
    if (!kode || typeof kode !== "string") return null;
    const m = String(kode).trim().match(/^(\d+)([A-Za-z]+)$/);
    if (!m) return null;
    const yearCode = m[2];
    const year = this._yearFromCode(yearCode);
    if (year === null) return null;
    return { seq: parseInt(m[1], 10), yearCode: yearCode, year: year };
  },

  _yearFromCode(code) {
    const map = this.KODE_YEAR_MAP;
    for (const y in map) {
      if (map[y] === code) return parseInt(y, 10);
    }
    return null;
  },

  _peekNextIncomingSeq(year) {
    const counter = this._getIncomingKodeCounter();
    let seq = counter[year] || 0;
    this.get("materials").forEach((m) => {
      const parsed = this._parseIncomingKode(m.kode);
      if (parsed && parsed.year === year && parsed.seq > seq) {
        seq = parsed.seq;
      }
    });
    return seq + 1;
  },

  nextIncomingKode(tanggalMasuk) {
    const year = new Date(tanggalMasuk).getFullYear();
    const yearCode = this.KODE_YEAR_MAP[year];
    if (!yearCode) {
      throw new Error(
        "Kode tahun untuk " + year + " belum terdaftar di KODE_YEAR_MAP. " +
          "Tambahkan peta kode tahun terlebih dahulu."
      );
    }
    const seq = this._peekNextIncomingSeq(year);
    const counter = this._getIncomingKodeCounter();
    counter[year] = seq;
    this._setIncomingKodeCounter(counter);
    return seq + yearCode;
  },

  peekIncomingKode(tanggalMasuk) {
    const year = new Date(tanggalMasuk).getFullYear();
    const yearCode = this.KODE_YEAR_MAP[year];
    if (!yearCode) {
      throw new Error(
        "Kode tahun untuk " + year + " belum terdaftar di KODE_YEAR_MAP. " +
          "Tambahkan peta kode tahun terlebih dahulu."
      );
    }
    return this._peekNextIncomingSeq(year) + yearCode;
  },

  init() {
    const currentVersion = localStorage.getItem("ht_db_seed_version");
    if (currentVersion === this.SEED_VERSION) {
      this.tables.forEach((t) => {
        if (!localStorage.getItem("ht_" + t)) {
          localStorage.setItem("ht_" + t, JSON.stringify([]));
        }
      });
      this._initIdCounter();
      this._initIncomingKodeCounter();
      this.migrate(); this.migrate48Items(); return;
    }
    this.tables.forEach((t) => {
      localStorage.setItem("ht_" + t, JSON.stringify([]));
    });
    this.seedDemoData();
    localStorage.setItem("ht_db_seed_version", this.SEED_VERSION);
    this._initIdCounter();
    this._initIncomingKodeCounter();
    this.migrate();
    this.migrate48Items();
  },
  get(table) {
    return JSON.parse(localStorage.getItem("ht_" + table) || "[]");
  },
  insert(table, record) {
    const data = this.get(table);
    record.id = this._nextId();
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

  /* ---- Resolusi Jenis Proses dari master Part ---- */
  /* Sumber kebenaran jenis proses adalah master Part (diambil via part_id).
     Mengembalikan string process_type (bisa kosong "") bila Part belum
     dilengkapi, sehingga caller dapat memutuskan apakah boleh menyimpan
     Incoming baru. */
  getPartProcessType(partId) {
    const p = this.findPartById(partId);
    if (!p) return null;
    return p.process_type || "";
  },
  canPartStartIncoming(partId) {
    const pt = this.getPartProcessType(partId);
    return !!pt;
  },

  /* ---- Validasi Data ---- */
  /* Mengembalikan { errors: [], warnings: [] } — panggil di konsol
      atau dari halaman pemeliharaan untuk mengaudit integritas data. */
  validate() {
    const errors = [];
    const warnings = [];

    /* 1. ID duplikat di dalam setiap tabel */
    this.tables.forEach((table) => {
      const rows = this.get(table);
      const seen = {};
      rows.forEach((r) => {
        if (r && r.id !== undefined && r.id !== null) {
          const key = String(r.id);
          if (seen[key]) {
            errors.push("Duplicate ID " + r.id + " in table " + table);
          }
          seen[key] = true;
        }
      });
    });

    /* 2. Referensi kunci asing (deteksi data yatim) */
    Object.keys(this.REFERENTIAL_INTEGRITY).forEach((table) => {
      const refs = this.REFERENTIAL_INTEGRITY[table];
      const rows = this.get(table);
      Object.keys(refs).forEach((field) => {
        const refTable = refs[field];
        rows.forEach((r) => {
          if (r && r[field] !== undefined && r[field] !== null && r[field] !== "") {
            const refRow = this.get(refTable).find((ref) => ref.id == r[field]);
            if (!refRow) {
              errors.push(
                "Orphan reference: " + table + "." + field + " = " + r[field] +
                " has no matching " + refTable + ".id"
              );
            }
          }
        });
      });
    });

    /* 3. Field wajib yang hilang (bandingkan dengan skema) */
    this.tables.forEach((table) => {
      const schema = this.SCHEMAS[table];
      if (!schema) return;
      const rows = this.get(table);
      rows.forEach((r) => {
        schema.forEach((field) => {
          if (r && !(field in r)) {
            warnings.push("Missing field: " + table + "." + field + " (record id=" + (r ? r.id : "?") + ")");
          }
        });
      });
    });

    /* 4. Status produksi vs production_status yang tidak cocok */
    const productions = this.get("productions");
    productions.forEach((p) => {
      if (p.status !== p.production_status) {
        warnings.push(
          "Status mismatch in productions id=" + p.id +
          ": status='" + p.status + "' vs production_status='" + p.production_status + "'"
        );
      }
    });

    /* 5. Kode material duplikat */
    const materials = this.get("materials");
    const kodeSeen = {};
    materials.forEach((m) => {
      if (m.kode) {
        if (kodeSeen[m.kode]) {
          errors.push("Duplicate material kode: " + m.kode);
        }
        kodeSeen[m.kode] = true;
      }
    });

    return { errors, warnings };
  },

  /* ---- Normalisasi status (untuk migrate) ---- */
  /* Memetakan string status lama/varian ke nilai kanonis yang didefinisikan di STATUSES. */
  _normalizeStatusValue(value) {
    if (value === null || value === undefined) return value;
    var s = String(value).trim();
    var lower = s.toLowerCase();
    if (lower === "active" || lower === "aktif") return this.STATUSES.ACTIVE;
    if (lower === "inactive" || lower === "non-aktif") return this.STATUSES.INACTIVE;
    if (lower === "waiting" || lower === "proses_waiting") return this.STATUSES.PROD_WAITING;
    if (lower === "process" || lower === "processing" || lower === "proses") return this.STATUSES.PROD_PROCESS;
    if (lower === "finish" || lower === "finished") return this.STATUSES.PROD_FINISH;
    if (lower === "finish_ng" || lower === "finished_ng" || lower === "ng") return this.STATUSES.PROD_FINISH_NG;
    if (lower === "ok" || lower === "pass") return this.STATUSES.RESULT_OK;
    if (lower === "delivered") return this.STATUSES.DELIVERY_DELIVERED;
    if (lower === "pending") return this.STATUSES.DELIVERY_PENDING;
    if (lower === "cancelled" || lower === "canceled") return this.STATUSES.DELIVERY_CANCELLED;
    return s;
  },

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

  /* ---- Integrasi pintu gerbang kualitas (QC) untuk proses pasca-QC (Tahap 3B-2) ---- */
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

  /* ---- Lapisan Data Multi-Proses (Tahap 3B-3A) ---- */
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

  /* ---- Model Baca Multi-Proses (Tahap 3B-3C-1) ----
     Helper untuk tracking/dashboard/pengiriman untuk menafsirkan
     seluruh rute proses sebuah material. Semua keputusan rute
     menggunakan material.process_route (snapshot incoming). QC
     selalu berasal dari tabel `qcs`, bukan dari productions.
     Helper ini BACA-SAHAJA (tidak melakukan insert/update). */
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
        if (prod.production_status === "PROCESS" || prod.status === "PROCESS") {
          info.status = "PROCESS";
          info.completed = false;
        } else if (prod.production_status === "FINISH" || prod.status === "FINISH") {
          if (prod.process_result === "OK") {
            info.status = "FINISH";
            info.completed = true;
          } else {
            info.status = "FINISH_NG";
            info.completed = false;
          }
        } else if (prod.production_status === "FINISH_NG" || prod.process_result === "NG") {
          info.status = "FINISH_NG";
          info.completed = false;
        } else if (prod.production_status === "WAITING" || prod.status === "WAITING") {
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

    // 1) Produksi yang dalam status PROSES -> itu langkah yang sedang berjalan.
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      if (step === "QC" || step === "QC_CHECK") continue;
      var prod = this.getProcessProduction(material, step);
      if (
        prod &&
        (prod.production_status === "PROCESS" ||
          prod.status === "PROCESS")
      ) {
        return step;
      }
    }

    // 2) Tidak ada PROSES berjalan: langkah saat ini/aktif adalah langkah
    //    belum selesai berikutnya, tetapi hanya jika memang dapat dimulai (gates lulus).
    var next = this.getNextProcess(material);
    if (next) {
      if (this.canStartProcess(material, next).allowed) {
        return next;
      }
      return null;
    }

    // 3) Semua selesai.
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

    // Seluruh rute harus selesai.
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      if (!this.isProcessCompleted(material, step)) {
        var prod = this.getProcessProduction(material, step);
        if (prod) {
          if (prod.production_status === "PROCESS" || prod.status === "PROCESS") {
            return { allowed: false, reason: "Proses " + step + " sedang berjalan", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
          }
          if (prod.production_status === "FINISH_NG" || prod.process_result === "NG") {
            return { allowed: false, reason: "Proses " + step + " menghasilkan NG", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
          }
        }
        return { allowed: false, reason: "Proses " + step + " belum selesai", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false };
      }
    }

    // Tidak boleh ada proses yang tersisa dalam status PROSES / belum dimulai.
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
    const validPartFields = ["id","customer_id","nomor_part","nama_part","berat_part","satuan_berat","target_hardness","standard_temperature","process_type","standard_process_route","status","created_at","updated_at"];
    const defaultProcessRoute = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false };
    const parts = this.get("parts");
    let changed = false;
    for (const p of parts) {
      const keys = Object.keys(p);
      for (const k of keys) { if (!validPartFields.includes(k)) { delete p[k]; changed = true; } }
       if (!("target_hardness" in p)) { p.target_hardness = null; changed = true; }
      if (!("process_type" in p)) { p.process_type = ""; changed = true; }
       if (!("status" in p)) { p.status = this.STATUSES.ACTIVE; changed = true; }
       if (!("standard_temperature" in p)) { p.standard_temperature = null; changed = true; }
      /* Normalisasi status ke nilai kanonis Active/Inactive */
      const ns = this._normalizeStatusValue(p.status);
      if (ns !== p.status) { p.status = ns; changed = true; }
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
      /* Normalisasi status_proses ke nilai kanonis WAITING / PROCESS / FINISH */
      if ("status_proses" in m) {
        const nsp = this._normalizeStatusValue(m.status_proses);
        if (nsp !== m.status_proses) { m.status_proses = nsp; changed = true; }
      } else {
        m.status_proses = this.STATUSES.PROSES_WAITING;
        changed = true;
      }
    }
    if (changed) localStorage.setItem("ht_materials", JSON.stringify(materials));
    const validProductionFields = ["id","material_id","incoming_id","tracking_id","status","production_status","kode","process_result","visual_check_result","visual_check_note","visual_check_operator","start_scan_at","start_scan_by","machine_start_at","machine_start_by","finish_scan_at","finish_scan_by","process_ng_note","machine_finish_at","machine_finish_by","tanggal_proses","jenis_treatment","remarks","created_at","updated_at","standard_temperature_snapshot","temperature_tolerance_snapshot","actual_temperature","temperature_min","temperature_max","temperature_deviation","temperature_result","temperature_recorded_at","temperature_recorded_by"];
    /* Catatan: field suhu (temperature_*) disengaja TIDAK di-backfill pada
       record produksi yang sudah ada. Snapshot suhu hanya dicatat ketika
       operator menyelesaikan proses. Record lama dipertahankan apa adanya
       (tidak dimodifikasi) agar histori tidak berubah. */
    const productions = this.get("productions");
    changed = false;
    for (const p of productions) {
      const keys = Object.keys(p);
      for (const k of keys) { if (!validProductionFields.includes(k)) { delete p[k]; changed = true; } }
      const fields = ["start_scan_at","start_scan_by","visual_check_result","visual_check_note","machine_start_at","machine_start_by","finish_scan_at","finish_scan_by","process_result","process_ng_note","machine_finish_at","machine_finish_by","production_status","incoming_id","tracking_id","tanggal_proses","jenis_treatment","remarks"];
      for (const f of fields) { if (!(f in p)) { p[f] = ""; changed = true; } }
      if (!("status" in p)) { p.status = this.STATUSES.PROD_WAITING; changed = true; }
      if (!("production_status" in p)) { p.production_status = this.STATUSES.PROD_WAITING; changed = true; }
      /* Normalisasi status produksi ke nilai kanonis WAITING / PROCESS / FINISH / FINISH_NG */
      const np = this._normalizeStatusValue(p.status);
      if (np !== p.status) { p.status = np; changed = true; }
      const nps = this._normalizeStatusValue(p.production_status);
      if (nps !== p.production_status) { p.production_status = nps; changed = true; }
      /* Sinkronkan production_status agar cocok dengan status jika mereka berbeda */
      if (p.status !== p.production_status) {
        p.production_status = p.status;
        changed = true;
      }
      if (!("remarks" in p)) { p.remarks = ""; changed = true; }
      if (!("tracking_id" in p)) { p.tracking_id = ""; changed = true; }
      if (!("visual_check_operator" in p)) { p.visual_check_operator = ""; changed = true; }
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
      /* Normalisasi hasil: PASS -> OK (hasil QC menggunakan OK/NG) */
      if ("hasil" in q) {
        const hOK = String(q.hasil).toUpperCase();
        if (hOK === "PASS") { q.hasil = this.STATUSES.RESULT_OK; changed = true; }
        else if (hOK === "NG") { q.hasil = this.STATUSES.RESULT_NG; changed = true; }
        else if (hOK === "OK") { q.hasil = this.STATUSES.RESULT_OK; changed = true; }
      }
    }
    if (changed) localStorage.setItem("ht_qcs", JSON.stringify(qcs));
    const validDeliveryFields = ["id","production_id","material_id","customer_id","tanggal_kirim","qty_kirim","nama_pengirim","status","catatan","user_id","remarks","created_at","updated_at"];
    const deliveries = this.get("deliveries");
    changed = false;
    for (const d of deliveries) {
      const keys = Object.keys(d);
      for (const k of keys) { if (!validDeliveryFields.includes(k)) { delete d[k]; changed = true; } }
      if (!("remarks" in d)) { d.remarks = ""; changed = true; }
      if (!("material_id" in d)) { d.material_id = ""; changed = true; }
      if (!("customer_id" in d)) { d.customer_id = ""; changed = true; }
      if (!("nama_pengirim" in d)) { d.nama_pengirim = ""; changed = true; }
      /* Normalisasi status pengiriman */
      if ("status" in d) {
        const nds = this._normalizeStatusValue(d.status);
        if (nds !== d.status) { d.status = nds; changed = true; }
      }
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

    /* ---- Migrasi daftar Jenis Proses ke daftar kanonis v2 ----
       Aturan bisnis:
       - Heat Treatment / Quenching / Hardening / Tempering tidak
         dikonversi otomatis (tidak ada padanan yang dapat dipastikan);
         nilai lama DIRENTAHKAN dan ditandai legacy via isProcessTypeLegacy.
       - Annealing / Carburizing / Normalizing sudah ada di daftar baru
         → tidak perlu transformasi.
       - Tidak ada data yang dihapus, dikosongkan, atau ditimpa.
       Langkah ini idempotent: hanya menandai versi migrasi sekali
       (flag ht_migration_process_types_v2) agar tidak berulang. */
    if (!localStorage.getItem("ht_migration_process_types_v2")) {
      localStorage.setItem("ht_migration_process_types_v2", "1");
    }
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
      { id: 1, customer_id: 1, nomor_part: "HT-2026-001", nama_part: "Crankshaft A", berat_part: 2.5, satuan_berat: "KG", target_hardness: "58-62 HRC", standard_temperature: 580, process_type: "Heat Treatment", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true }, status: "Active", created_at: "2026-01-20T00:00:00Z", updated_at: "2026-01-20T00:00:00Z" },
      { id: 2, customer_id: 1, nomor_part: "HT-2026-002", nama_part: "Gear Housing A", berat_part: 3.2, satuan_berat: "KG", target_hardness: "60-64 HRC", standard_temperature: 850, process_type: "Hardening", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: false }, status: "Active", created_at: "2026-01-22T00:00:00Z", updated_at: "2026-01-22T00:00:00Z" },
      { id: 3, customer_id: 2, nomor_part: "HT-2026-003", nama_part: "Gear Shaft B", berat_part: 1.8, satuan_berat: "KG", target_hardness: "55-60 HRC", standard_temperature: 820, process_type: "Heat Treatment", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: true }, status: "Active", created_at: "2026-01-25T00:00:00Z", updated_at: "2026-01-25T00:00:00Z" },
      { id: 4, customer_id: 2, nomor_part: "HT-2026-004", nama_part: "Piston Ring B", berat_part: 0.5, satuan_berat: "KG", target_hardness: "700-750 HV", standard_temperature: 650, process_type: "Annealing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-01-28T00:00:00Z", updated_at: "2026-01-28T00:00:00Z" },
      { id: 5, customer_id: 3, nomor_part: "HT-2026-005", nama_part: "Camshaft Pro", berat_part: 4.0, satuan_berat: "KG", target_hardness: "45-50 HRC", standard_temperature: 870, process_type: "Heat Treatment", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-05T00:00:00Z", updated_at: "2026-02-05T00:00:00Z" },
      { id: 6, customer_id: 3, nomor_part: "HT-2026-006", nama_part: "Connecting Rod C", berat_part: 2.1, satuan_berat: "KG", target_hardness: "50-55 HRC", standard_temperature: 830, process_type: "Tempering", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-08T00:00:00Z", updated_at: "2026-02-08T00:00Z" },
      { id: 7, customer_id: 4, nomor_part: "HT-2026-007", nama_part: "Piston Rod X", berat_part: 3.5, satuan_berat: "KG", target_hardness: "58-62 HRC", standard_temperature: 860, process_type: "Carburizing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-12T00:00:00Z", updated_at: "2026-02-12T00:00:00Z" },
      { id: 8, customer_id: 4, nomor_part: "HT-2026-008", nama_part: "Gear Component X", berat_part: 2.8, satuan_berat: "KG", target_hardness: "55-60 HRC", standard_temperature: 820, process_type: "Hardening", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-15T00:00:00Z", updated_at: "2026-02-15T00:00:00Z" },
      { id: 9, customer_id: 5, nomor_part: "HT-2026-009", nama_part: "Valve Stem Z", berat_part: 1.2, satuan_berat: "KG", target_hardness: "40-45 HRC", standard_temperature: 750, process_type: "Normalizing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-18T00:00:00Z", updated_at: "2026-02-18T00:00:00Z" },
      { id: 10, customer_id: 5, nomor_part: "HT-2026-010", nama_part: "Housing Component Z", berat_part: 3.0, satuan_berat: "KG", target_hardness: "50-55 HRC", standard_temperature: 700, process_type: "Heat Treatment", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-20T00:00:00Z", updated_at: "2026-02-20T00:00:00Z" },
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
       { id: 2001, material_id: 1001, incoming_id: 1001, tracking_id: 5001, status: "FINISH", production_status: "FINISH", kode: "20260001I", process_result: "OK", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-01T08:10:00", start_scan_by: "Operator Produksi 01", machine_start_at: "2026-09-01T08:15:00", machine_start_by: "Operator Mesin 01", finish_scan_at: "2026-09-01T10:30:00", finish_scan_by: "Operator Produksi 01", machine_finish_at: "2026-09-01T10:35:00", machine_finish_by: "Operator Mesin 01", process_ng_note: "", tanggal_proses: "2026-09-01", jenis_treatment: "Heat Treatment", remarks: "Proses selesai normal", standard_temperature_snapshot: 580, temperature_tolerance_snapshot: 15, actual_temperature: 580, temperature_min: 565, temperature_max: 595, temperature_deviation: 0, temperature_result: "OK", temperature_recorded_at: "2026-09-01T10:30:00", temperature_recorded_by: "Operator Mesin 01", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
      { id: 2002, material_id: 1002, incoming_id: 1002, tracking_id: 5002, status: "FINISH", production_status: "FINISH", kode: "20260002I", process_result: "OK", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-03T08:20:00", start_scan_by: "Operator Produksi 02", machine_start_at: "2026-09-03T08:25:00", machine_start_by: "Operator Mesin 02", finish_scan_at: "2026-09-03T11:00:00", finish_scan_by: "Operator Produksi 02", machine_finish_at: "2026-09-03T11:05:00", machine_finish_by: "Operator Mesin 02", process_ng_note: "", tanggal_proses: "2026-09-03", jenis_treatment: "Hardening", remarks: "Proses selesai normal", standard_temperature_snapshot: 850, temperature_tolerance_snapshot: 15, actual_temperature: 850, temperature_min: 835, temperature_max: 865, temperature_deviation: 0, temperature_result: "OK", temperature_recorded_at: "2026-09-03T11:00:00", temperature_recorded_by: "Operator Mesin 02", created_at: "2026-09-03T00:00:00Z", updated_at: "2026-09-03T00:00:00Z" },
      { id: 2003, material_id: 1003, incoming_id: 1003, tracking_id: 5003, status: "FINISH", production_status: "FINISH", kode: "20260003I", process_result: "OK", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-05T09:00:00", start_scan_by: "Operator Produksi 01", machine_start_at: "2026-09-05T09:05:00", machine_start_by: "Operator Mesin 01", finish_scan_at: "2026-09-05T12:00:00", finish_scan_by: "Operator Produksi 01", machine_finish_at: "2026-09-05T12:05:00", machine_finish_by: "Operator Mesin 01", process_ng_note: "", tanggal_proses: "2026-09-05", jenis_treatment: "Heat Treatment", remarks: "Proses selesai normal", standard_temperature_snapshot: 820, temperature_tolerance_snapshot: 15, actual_temperature: 820, temperature_min: 805, temperature_max: 835, temperature_deviation: 0, temperature_result: "OK", temperature_recorded_at: "2026-09-05T12:00:00", temperature_recorded_by: "Operator Mesin 01", created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z" },
      { id: 2004, material_id: 1004, incoming_id: 1004, tracking_id: 5004, status: "FINISH_NG", production_status: "FINISH_NG", kode: "20260004I", process_result: "NG", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-08T08:30:00", start_scan_by: "Operator Produksi 02", machine_start_at: "2026-09-08T08:35:00", machine_start_by: "Operator Mesin 02", finish_scan_at: "2026-09-08T11:30:00", finish_scan_by: "Operator Produksi 02", machine_finish_at: "2026-09-08T11:35:00", machine_finish_by: "Operator Mesin 02", process_ng_note: "Hasil proses tidak memenuhi parameter yang ditetapkan", tanggal_proses: "2026-09-08", jenis_treatment: "Annealing", remarks: "Part NG setelah proses", standard_temperature_snapshot: 650, temperature_tolerance_snapshot: 15, actual_temperature: 700, temperature_min: 635, temperature_max: 665, temperature_deviation: 50, temperature_result: "NG", temperature_recorded_at: "2026-09-08T11:30:00", temperature_recorded_by: "Operator Mesin 02", created_at: "2026-09-08T00:00:00Z", updated_at: "2026-09-08T00:00:00Z" },
      { id: 2005, material_id: 1005, incoming_id: 1005, tracking_id: 5005, status: "FINISH", production_status: "FINISH", kode: "20260005I", process_result: "OK", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-10T08:15:00", start_scan_by: "Operator Produksi 03", machine_start_at: "2026-09-10T08:20:00", machine_start_by: "Operator Mesin 03", finish_scan_at: "2026-09-10T11:00:00", finish_scan_by: "Operator Produksi 03", machine_finish_at: "2026-09-10T11:05:00", machine_finish_by: "Operator Mesin 03", process_ng_note: "", tanggal_proses: "2026-09-10", jenis_treatment: "Heat Treatment", remarks: "Proses selesai normal", standard_temperature_snapshot: 870, temperature_tolerance_snapshot: 15, actual_temperature: 870, temperature_min: 855, temperature_max: 885, temperature_deviation: 0, temperature_result: "OK", temperature_recorded_at: "2026-09-10T11:00:00", temperature_recorded_by: "Operator Mesin 03", created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-10T00:00:00Z" },
      { id: 2006, material_id: 1006, incoming_id: 1006, tracking_id: 5006, status: "PROCESS", production_status: "PROCESS", kode: "20260006I", process_result: "", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-12T08:00:00", start_scan_by: "Operator Produksi 01", machine_start_at: "2026-09-12T08:10:00", machine_start_by: "Operator Mesin 01", finish_scan_at: "", finish_scan_by: "", machine_finish_at: "", machine_finish_by: "", process_ng_note: "", tanggal_proses: "2026-09-12", jenis_treatment: "Tempering", remarks: "Sedang dalam proses produksi", standard_temperature_snapshot: null, temperature_tolerance_snapshot: null, actual_temperature: null, temperature_min: null, temperature_max: null, temperature_deviation: null, temperature_result: null, temperature_recorded_at: null, temperature_recorded_by: null, created_at: "2026-09-12T00:00:00Z", updated_at: "2026-09-12T00:00:00Z" },
      { id: 2007, material_id: 1007, incoming_id: 1007, tracking_id: 5007, status: "WAITING", production_status: "WAITING", kode: "20260007I", process_result: "", visual_check_result: "", visual_check_note: "", start_scan_at: "", start_scan_by: "", machine_start_at: "", machine_start_by: "", finish_scan_at: "", finish_scan_by: "", machine_finish_at: "", machine_finish_by: "", process_ng_note: "", tanggal_proses: "", jenis_treatment: "Carburizing", remarks: "Menunggu proses produksi", standard_temperature_snapshot: null, temperature_tolerance_snapshot: null, actual_temperature: null, temperature_min: null, temperature_max: null, temperature_deviation: null, temperature_result: null, temperature_recorded_at: null, temperature_recorded_by: null, created_at: "2026-09-15T00:00:00Z", updated_at: "2026-09-15T00:00:00Z" },
      { id: 2008, material_id: 1008, incoming_id: 1008, tracking_id: 5008, status: "PROCESS", production_status: "PROCESS", kode: "20260008I", process_result: "", visual_check_result: "OK", visual_check_note: "", start_scan_at: "2026-09-18T08:20:00", start_scan_by: "Operator Produksi 04", machine_start_at: "2026-09-18T08:30:00", machine_start_by: "Operator Mesin 04", finish_scan_at: "", finish_scan_by: "", machine_finish_at: "", machine_finish_by: "", process_ng_note: "", tanggal_proses: "2026-09-18", jenis_treatment: "Hardening", remarks: "Sedang dalam proses produksi", standard_temperature_snapshot: null, temperature_tolerance_snapshot: null, actual_temperature: null, temperature_min: null, temperature_max: null, temperature_deviation: null, temperature_result: null, temperature_recorded_at: null, temperature_recorded_by: null, created_at: "2026-09-18T00:00:00Z", updated_at: "2026-09-18T00:00:00Z" },
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

  migrate48Items() {
    if (localStorage.getItem("ht_migration_48items_v3")) return;
    const existingKodes = this.get("materials").map(m => m.kode);
    const newMats =       [
        {
          "id": 2001,
          "kode": "1M",
          "qr_code": "1M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0001",
          "lot_no": "LOT-HT-0001",
          "material_charge": "MC-0001",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-01",
          "keterangan": "Material 1M (Quenching & Tempering)",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 02",
          "status_proses": "WAITING",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 2002,
          "kode": "2M",
          "qr_code": "2M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0002",
          "lot_no": "LOT-HT-0002",
          "material_charge": "MC-0002",
          "status_part": "Masspro",
          "qty": 60,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 150,
          "tanggal_masuk": "2026-09-03",
          "keterangan": "Material 2M (Quenching & Tempering)",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 03",
          "status_proses": "PROCESS",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z"
        },
        {
          "id": 2003,
          "kode": "3M",
          "qr_code": "3M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0003",
          "lot_no": "LOT-HT-0003",
          "material_charge": "MC-0003",
          "status_part": "Masspro",
          "qty": 70,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 175,
          "tanggal_masuk": "2026-09-05",
          "keterangan": "Material 3M (Quenching & Tempering)",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 04",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z"
        },
        {
          "id": 2004,
          "kode": "4M",
          "qr_code": "4M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0004",
          "lot_no": "LOT-HT-0004",
          "material_charge": "MC-0004",
          "status_part": "Masspro",
          "qty": 80,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 200,
          "tanggal_masuk": "2026-09-07",
          "keterangan": "Material 4M (Quenching & Tempering)",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 05",
          "status_proses": "FINISH_NG",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 2005,
          "kode": "5M",
          "qr_code": "5M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0005",
          "lot_no": "LOT-HT-0005",
          "material_charge": "MC-0005",
          "status_part": "Masspro",
          "qty": 90,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 225,
          "tanggal_masuk": "2026-09-09",
          "keterangan": "Material 5M (Quenching & Tempering)",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 2006,
          "kode": "6M",
          "qr_code": "6M",
          "customer_id": 1,
          "part_id": 2,
          "nomor_surat_jalan": "SJ-2026-0006",
          "lot_no": "LOT-HT-0006",
          "material_charge": "MC-0006",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 3.2,
          "berat_total_part": 160,
          "tanggal_masuk": "2026-09-01",
          "keterangan": "Material 6M (Annealing)",
          "remarks": "",
          "process_type": "Annealing",
          "diinput_oleh": "Operator Incoming 02",
          "status_proses": "WAITING",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 2007,
          "kode": "7M",
          "qr_code": "7M",
          "customer_id": 1,
          "part_id": 2,
          "nomor_surat_jalan": "SJ-2026-0007",
          "lot_no": "LOT-HT-0007",
          "material_charge": "MC-0007",
          "status_part": "Masspro",
          "qty": 60,
          "berat_part_snapshot": 3.2,
          "berat_total_part": 192,
          "tanggal_masuk": "2026-09-03",
          "keterangan": "Material 7M (Annealing)",
          "remarks": "",
          "process_type": "Annealing",
          "diinput_oleh": "Operator Incoming 03",
          "status_proses": "PROCESS",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z"
        },
        {
          "id": 2008,
          "kode": "8M",
          "qr_code": "8M",
          "customer_id": 1,
          "part_id": 2,
          "nomor_surat_jalan": "SJ-2026-0008",
          "lot_no": "LOT-HT-0008",
          "material_charge": "MC-0008",
          "status_part": "Masspro",
          "qty": 70,
          "berat_part_snapshot": 3.2,
          "berat_total_part": 224,
          "tanggal_masuk": "2026-09-05",
          "keterangan": "Material 8M (Annealing)",
          "remarks": "",
          "process_type": "Annealing",
          "diinput_oleh": "Operator Incoming 04",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z"
        },
        {
          "id": 2009,
          "kode": "9M",
          "qr_code": "9M",
          "customer_id": 1,
          "part_id": 2,
          "nomor_surat_jalan": "SJ-2026-0009",
          "lot_no": "LOT-HT-0009",
          "material_charge": "MC-0009",
          "status_part": "Masspro",
          "qty": 80,
          "berat_part_snapshot": 3.2,
          "berat_total_part": 256,
          "tanggal_masuk": "2026-09-07",
          "keterangan": "Material 9M (Annealing)",
          "remarks": "",
          "process_type": "Annealing",
          "diinput_oleh": "Operator Incoming 05",
          "status_proses": "FINISH_NG",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 2010,
          "kode": "10M",
          "qr_code": "10M",
          "customer_id": 1,
          "part_id": 2,
          "nomor_surat_jalan": "SJ-2026-0010",
          "lot_no": "LOT-HT-0010",
          "material_charge": "MC-0010",
          "status_part": "Masspro",
          "qty": 90,
          "berat_part_snapshot": 3.2,
          "berat_total_part": 288,
          "tanggal_masuk": "2026-09-09",
          "keterangan": "Material 10M (Annealing)",
          "remarks": "",
          "process_type": "Annealing",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 2011,
          "kode": "11M",
          "qr_code": "11M",
          "customer_id": 2,
          "part_id": 3,
          "nomor_surat_jalan": "SJ-2026-0011",
          "lot_no": "LOT-HT-0011",
          "material_charge": "MC-0011",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 1.8,
          "berat_total_part": 90,
          "tanggal_masuk": "2026-09-01",
          "keterangan": "Material 11M (Carburizing)",
          "remarks": "",
          "process_type": "Carburizing",
          "diinput_oleh": "Operator Incoming 02",
          "status_proses": "WAITING",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 2012,
          "kode": "12M",
          "qr_code": "12M",
          "customer_id": 2,
          "part_id": 3,
          "nomor_surat_jalan": "SJ-2026-0012",
          "lot_no": "LOT-HT-0012",
          "material_charge": "MC-0012",
          "status_part": "Masspro",
          "qty": 60,
          "berat_part_snapshot": 1.8,
          "berat_total_part": 108,
          "tanggal_masuk": "2026-09-03",
          "keterangan": "Material 12M (Carburizing)",
          "remarks": "",
          "process_type": "Carburizing",
          "diinput_oleh": "Operator Incoming 03",
          "status_proses": "PROCESS",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z"
        },
        {
          "id": 2013,
          "kode": "13M",
          "qr_code": "13M",
          "customer_id": 2,
          "part_id": 3,
          "nomor_surat_jalan": "SJ-2026-0013",
          "lot_no": "LOT-HT-0013",
          "material_charge": "MC-0013",
          "status_part": "Masspro",
          "qty": 70,
          "berat_part_snapshot": 1.8,
          "berat_total_part": 126,
          "tanggal_masuk": "2026-09-05",
          "keterangan": "Material 13M (Carburizing)",
          "remarks": "",
          "process_type": "Carburizing",
          "diinput_oleh": "Operator Incoming 04",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z"
        },
        {
          "id": 2014,
          "kode": "14M",
          "qr_code": "14M",
          "customer_id": 2,
          "part_id": 3,
          "nomor_surat_jalan": "SJ-2026-0014",
          "lot_no": "LOT-HT-0014",
          "material_charge": "MC-0014",
          "status_part": "Masspro",
          "qty": 80,
          "berat_part_snapshot": 1.8,
          "berat_total_part": 144,
          "tanggal_masuk": "2026-09-07",
          "keterangan": "Material 14M (Carburizing)",
          "remarks": "",
          "process_type": "Carburizing",
          "diinput_oleh": "Operator Incoming 05",
          "status_proses": "FINISH_NG",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 2015,
          "kode": "15M",
          "qr_code": "15M",
          "customer_id": 2,
          "part_id": 3,
          "nomor_surat_jalan": "SJ-2026-0015",
          "lot_no": "LOT-HT-0015",
          "material_charge": "MC-0015",
          "status_part": "Masspro",
          "qty": 90,
          "berat_part_snapshot": 1.8,
          "berat_total_part": 162,
          "tanggal_masuk": "2026-09-09",
          "keterangan": "Material 15M (Carburizing)",
          "remarks": "",
          "process_type": "Carburizing",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 2016,
          "kode": "16M",
          "qr_code": "16M",
          "customer_id": 5,
          "part_id": 9,
          "nomor_surat_jalan": "SJ-2026-0016",
          "lot_no": "LOT-HT-0016",
          "material_charge": "MC-0016",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 1.2,
          "berat_total_part": 60,
          "tanggal_masuk": "2026-09-01",
          "keterangan": "Material 16M (Normalizing)",
          "remarks": "",
          "process_type": "Normalizing",
          "diinput_oleh": "Operator Incoming 02",
          "status_proses": "WAITING",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 2017,
          "kode": "17M",
          "qr_code": "17M",
          "customer_id": 5,
          "part_id": 9,
          "nomor_surat_jalan": "SJ-2026-0017",
          "lot_no": "LOT-HT-0017",
          "material_charge": "MC-0017",
          "status_part": "Masspro",
          "qty": 60,
          "berat_part_snapshot": 1.2,
          "berat_total_part": 72,
          "tanggal_masuk": "2026-09-03",
          "keterangan": "Material 17M (Normalizing)",
          "remarks": "",
          "process_type": "Normalizing",
          "diinput_oleh": "Operator Incoming 03",
          "status_proses": "PROCESS",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z"
        },
        {
          "id": 2018,
          "kode": "18M",
          "qr_code": "18M",
          "customer_id": 5,
          "part_id": 9,
          "nomor_surat_jalan": "SJ-2026-0018",
          "lot_no": "LOT-HT-0018",
          "material_charge": "MC-0018",
          "status_part": "Masspro",
          "qty": 70,
          "berat_part_snapshot": 1.2,
          "berat_total_part": 84,
          "tanggal_masuk": "2026-09-05",
          "keterangan": "Material 18M (Normalizing)",
          "remarks": "",
          "process_type": "Normalizing",
          "diinput_oleh": "Operator Incoming 04",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z"
        },
        {
          "id": 2019,
          "kode": "19M",
          "qr_code": "19M",
          "customer_id": 5,
          "part_id": 9,
          "nomor_surat_jalan": "SJ-2026-0019",
          "lot_no": "LOT-HT-0019",
          "material_charge": "MC-0019",
          "status_part": "Masspro",
          "qty": 80,
          "berat_part_snapshot": 1.2,
          "berat_total_part": 96,
          "tanggal_masuk": "2026-09-07",
          "keterangan": "Material 19M (Normalizing)",
          "remarks": "",
          "process_type": "Normalizing",
          "diinput_oleh": "Operator Incoming 05",
          "status_proses": "FINISH_NG",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 2020,
          "kode": "20M",
          "qr_code": "20M",
          "customer_id": 5,
          "part_id": 9,
          "nomor_surat_jalan": "SJ-2026-0020",
          "lot_no": "LOT-HT-0020",
          "material_charge": "MC-0020",
          "status_part": "Masspro",
          "qty": 90,
          "berat_part_snapshot": 1.2,
          "berat_total_part": 108,
          "tanggal_masuk": "2026-09-09",
          "keterangan": "Material 20M (Normalizing)",
          "remarks": "",
          "process_type": "Normalizing",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 2021,
          "kode": "21M",
          "qr_code": "21M",
          "customer_id": 3,
          "part_id": 5,
          "nomor_surat_jalan": "SJ-2026-0021",
          "lot_no": "LOT-HT-0021",
          "material_charge": "MC-0021",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 4,
          "berat_total_part": 200,
          "tanggal_masuk": "2026-09-01",
          "keterangan": "Material 21M (Full Annealing)",
          "remarks": "",
          "process_type": "Full Annealing",
          "diinput_oleh": "Operator Incoming 02",
          "status_proses": "WAITING",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 2022,
          "kode": "22M",
          "qr_code": "22M",
          "customer_id": 3,
          "part_id": 5,
          "nomor_surat_jalan": "SJ-2026-0022",
          "lot_no": "LOT-HT-0022",
          "material_charge": "MC-0022",
          "status_part": "Masspro",
          "qty": 60,
          "berat_part_snapshot": 4,
          "berat_total_part": 240,
          "tanggal_masuk": "2026-09-03",
          "keterangan": "Material 22M (Full Annealing)",
          "remarks": "",
          "process_type": "Full Annealing",
          "diinput_oleh": "Operator Incoming 03",
          "status_proses": "PROCESS",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z"
        },
        {
          "id": 2023,
          "kode": "23M",
          "qr_code": "23M",
          "customer_id": 3,
          "part_id": 5,
          "nomor_surat_jalan": "SJ-2026-0023",
          "lot_no": "LOT-HT-0023",
          "material_charge": "MC-0023",
          "status_part": "Masspro",
          "qty": 70,
          "berat_part_snapshot": 4,
          "berat_total_part": 280,
          "tanggal_masuk": "2026-09-05",
          "keterangan": "Material 23M (Full Annealing)",
          "remarks": "",
          "process_type": "Full Annealing",
          "diinput_oleh": "Operator Incoming 04",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z"
        },
        {
          "id": 2024,
          "kode": "24M",
          "qr_code": "24M",
          "customer_id": 3,
          "part_id": 5,
          "nomor_surat_jalan": "SJ-2026-0024",
          "lot_no": "LOT-HT-0024",
          "material_charge": "MC-0024",
          "status_part": "Masspro",
          "qty": 80,
          "berat_part_snapshot": 4,
          "berat_total_part": 320,
          "tanggal_masuk": "2026-09-07",
          "keterangan": "Material 24M (Full Annealing)",
          "remarks": "",
          "process_type": "Full Annealing",
          "diinput_oleh": "Operator Incoming 05",
          "status_proses": "FINISH_NG",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 2025,
          "kode": "25M",
          "qr_code": "25M",
          "customer_id": 3,
          "part_id": 5,
          "nomor_surat_jalan": "SJ-2026-0025",
          "lot_no": "LOT-HT-0025",
          "material_charge": "MC-0025",
          "status_part": "Masspro",
          "qty": 90,
          "berat_part_snapshot": 4,
          "berat_total_part": 360,
          "tanggal_masuk": "2026-09-09",
          "keterangan": "Material 25M (Full Annealing)",
          "remarks": "",
          "process_type": "Full Annealing",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 2026,
          "kode": "26M",
          "qr_code": "26M",
          "customer_id": 3,
          "part_id": 6,
          "nomor_surat_jalan": "SJ-2026-0026",
          "lot_no": "LOT-HT-0026",
          "material_charge": "MC-0026",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.1,
          "berat_total_part": 105,
          "tanggal_masuk": "2026-09-01",
          "keterangan": "Material 26M (Stress Relief Annealing)",
          "remarks": "",
          "process_type": "Stress Relief Annealing",
          "diinput_oleh": "Operator Incoming 02",
          "status_proses": "WAITING",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 2027,
          "kode": "27M",
          "qr_code": "27M",
          "customer_id": 3,
          "part_id": 6,
          "nomor_surat_jalan": "SJ-2026-0027",
          "lot_no": "LOT-HT-0027",
          "material_charge": "MC-0027",
          "status_part": "Masspro",
          "qty": 60,
          "berat_part_snapshot": 2.1,
          "berat_total_part": 126,
          "tanggal_masuk": "2026-09-03",
          "keterangan": "Material 27M (Stress Relief Annealing)",
          "remarks": "",
          "process_type": "Stress Relief Annealing",
          "diinput_oleh": "Operator Incoming 03",
          "status_proses": "PROCESS",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z"
        },
        {
          "id": 2028,
          "kode": "28M",
          "qr_code": "28M",
          "customer_id": 3,
          "part_id": 6,
          "nomor_surat_jalan": "SJ-2026-0028",
          "lot_no": "LOT-HT-0028",
          "material_charge": "MC-0028",
          "status_part": "Masspro",
          "qty": 70,
          "berat_part_snapshot": 2.1,
          "berat_total_part": 147,
          "tanggal_masuk": "2026-09-05",
          "keterangan": "Material 28M (Stress Relief Annealing)",
          "remarks": "",
          "process_type": "Stress Relief Annealing",
          "diinput_oleh": "Operator Incoming 04",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z"
        },
        {
          "id": 2029,
          "kode": "29M",
          "qr_code": "29M",
          "customer_id": 3,
          "part_id": 6,
          "nomor_surat_jalan": "SJ-2026-0029",
          "lot_no": "LOT-HT-0029",
          "material_charge": "MC-0029",
          "status_part": "Masspro",
          "qty": 80,
          "berat_part_snapshot": 2.1,
          "berat_total_part": 168,
          "tanggal_masuk": "2026-09-07",
          "keterangan": "Material 29M (Stress Relief Annealing)",
          "remarks": "",
          "process_type": "Stress Relief Annealing",
          "diinput_oleh": "Operator Incoming 05",
          "status_proses": "FINISH_NG",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 2030,
          "kode": "30M",
          "qr_code": "30M",
          "customer_id": 3,
          "part_id": 6,
          "nomor_surat_jalan": "SJ-2026-0030",
          "lot_no": "LOT-HT-0030",
          "material_charge": "MC-0030",
          "status_part": "Masspro",
          "qty": 90,
          "berat_part_snapshot": 2.1,
          "berat_total_part": 189,
          "tanggal_masuk": "2026-09-09",
          "keterangan": "Material 30M (Stress Relief Annealing)",
          "remarks": "",
          "process_type": "Stress Relief Annealing",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 2031,
          "kode": "31M",
          "qr_code": "31M",
          "customer_id": 4,
          "part_id": 8,
          "nomor_surat_jalan": "SJ-2026-0031",
          "lot_no": "LOT-HT-0031",
          "material_charge": "MC-0031",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.8,
          "berat_total_part": 140,
          "tanggal_masuk": "2026-09-01",
          "keterangan": "Material 31M (Spheroidizing Annealing)",
          "remarks": "",
          "process_type": "Spheroidizing Annealing",
          "diinput_oleh": "Operator Incoming 02",
          "status_proses": "WAITING",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 2032,
          "kode": "32M",
          "qr_code": "32M",
          "customer_id": 4,
          "part_id": 8,
          "nomor_surat_jalan": "SJ-2026-0032",
          "lot_no": "LOT-HT-0032",
          "material_charge": "MC-0032",
          "status_part": "Masspro",
          "qty": 60,
          "berat_part_snapshot": 2.8,
          "berat_total_part": 168,
          "tanggal_masuk": "2026-09-03",
          "keterangan": "Material 32M (Spheroidizing Annealing)",
          "remarks": "",
          "process_type": "Spheroidizing Annealing",
          "diinput_oleh": "Operator Incoming 03",
          "status_proses": "PROCESS",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z"
        },
        {
          "id": 2033,
          "kode": "33M",
          "qr_code": "33M",
          "customer_id": 4,
          "part_id": 8,
          "nomor_surat_jalan": "SJ-2026-0033",
          "lot_no": "LOT-HT-0033",
          "material_charge": "MC-0033",
          "status_part": "Masspro",
          "qty": 70,
          "berat_part_snapshot": 2.8,
          "berat_total_part": 196,
          "tanggal_masuk": "2026-09-05",
          "keterangan": "Material 33M (Spheroidizing Annealing)",
          "remarks": "",
          "process_type": "Spheroidizing Annealing",
          "diinput_oleh": "Operator Incoming 04",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z"
        },
        {
          "id": 2034,
          "kode": "34M",
          "qr_code": "34M",
          "customer_id": 4,
          "part_id": 8,
          "nomor_surat_jalan": "SJ-2026-0034",
          "lot_no": "LOT-HT-0034",
          "material_charge": "MC-0034",
          "status_part": "Masspro",
          "qty": 80,
          "berat_part_snapshot": 2.8,
          "berat_total_part": 224,
          "tanggal_masuk": "2026-09-07",
          "keterangan": "Material 34M (Spheroidizing Annealing)",
          "remarks": "",
          "process_type": "Spheroidizing Annealing",
          "diinput_oleh": "Operator Incoming 05",
          "status_proses": "FINISH_NG",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 2035,
          "kode": "35M",
          "qr_code": "35M",
          "customer_id": 4,
          "part_id": 8,
          "nomor_surat_jalan": "SJ-2026-0035",
          "lot_no": "LOT-HT-0035",
          "material_charge": "MC-0035",
          "status_part": "Masspro",
          "qty": 90,
          "berat_part_snapshot": 2.8,
          "berat_total_part": 251.99999999999997,
          "tanggal_masuk": "2026-09-09",
          "keterangan": "Material 35M (Spheroidizing Annealing)",
          "remarks": "",
          "process_type": "Spheroidizing Annealing",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 2036,
          "kode": "36M",
          "qr_code": "36M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0036",
          "lot_no": "LOT-HT-26036",
          "material_charge": "MC-26036",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-28",
          "keterangan": "Material ShotBlast test",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "PROCESS",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-09-28T00:00:00Z",
          "updated_at": "2026-09-28T00:00:00Z"
        },
        {
          "id": 2037,
          "kode": "37M",
          "qr_code": "37M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0037",
          "lot_no": "LOT-HT-26037",
          "material_charge": "MC-26037",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-28",
          "keterangan": "Material Anti-Rust test",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "PROCESS",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-09-28T00:00:00Z",
          "updated_at": "2026-09-28T00:00:00Z"
        },
        {
          "id": 2038,
          "kode": "38M",
          "qr_code": "38M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0037",
          "lot_no": "LOT-HT-26037",
          "material_charge": "MC-26037",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-26",
          "keterangan": "Material QC OK 38M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-26T00:00:00Z",
          "updated_at": "2026-09-26T00:00:00Z"
        },
        {
          "id": 2039,
          "kode": "39M",
          "qr_code": "39M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0038",
          "lot_no": "LOT-HT-26038",
          "material_charge": "MC-26038",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-28",
          "keterangan": "Material QC OK 39M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-28T00:00:00Z",
          "updated_at": "2026-09-28T00:00:00Z"
        },
        {
          "id": 2040,
          "kode": "40M",
          "qr_code": "40M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-0039",
          "lot_no": "LOT-HT-26039",
          "material_charge": "MC-26039",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-30",
          "keterangan": "Material QC OK 40M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "created_at": "2026-09-30T00:00:00Z",
          "updated_at": "2026-09-30T00:00:00Z"
        },
        {
          "id": 2041,
          "kode": "41M",
          "qr_code": "41M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-040",
          "lot_no": "LOT-HT-2640",
          "material_charge": "MC-26040",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-30",
          "keterangan": "Material ready delivery 41M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-09-30T00:00:00Z",
          "updated_at": "2026-09-30T00:00:00Z"
        },
        {
          "id": 2042,
          "kode": "42M",
          "qr_code": "42M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-041",
          "lot_no": "LOT-HT-2641",
          "material_charge": "MC-26041",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-32",
          "keterangan": "Material ready delivery 42M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-09-32T00:00:00Z",
          "updated_at": "2026-09-32T00:00:00Z"
        },
        {
          "id": 2043,
          "kode": "43M",
          "qr_code": "43M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-042",
          "lot_no": "LOT-HT-2642",
          "material_charge": "MC-26042",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-34",
          "keterangan": "Material ready delivery 43M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-09-34T00:00:00Z",
          "updated_at": "2026-09-34T00:00:00Z"
        },
        {
          "id": 2044,
          "kode": "44M",
          "qr_code": "44M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-043",
          "lot_no": "LOT-HT-2643",
          "material_charge": "MC-26043",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-36",
          "keterangan": "Material ready delivery 44M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-09-36T00:00:00Z",
          "updated_at": "2026-09-36T00:00:00Z"
        },
        {
          "id": 2045,
          "kode": "45M",
          "qr_code": "45M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-044",
          "lot_no": "LOT-HT-2644",
          "material_charge": "MC-26044",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-09-38",
          "keterangan": "Material ready delivery 45M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-09-38T00:00:00Z",
          "updated_at": "2026-09-38T00:00:00Z"
        },
        {
          "id": 2046,
          "kode": "46M",
          "qr_code": "46M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-045",
          "lot_no": "LOT-HT-2645",
          "material_charge": "MC-26045",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-10-05",
          "keterangan": "Material delivered 46M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-10-05T00:00:00Z",
          "updated_at": "2026-10-05T00:00:00Z"
        },
        {
          "id": 2047,
          "kode": "47M",
          "qr_code": "47M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-046",
          "lot_no": "LOT-HT-2646",
          "material_charge": "MC-26046",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-10-07",
          "keterangan": "Material delivered 47M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-10-07T00:00:00Z",
          "updated_at": "2026-10-07T00:00:00Z"
        },
        {
          "id": 2048,
          "kode": "48M",
          "qr_code": "48M",
          "customer_id": 1,
          "part_id": 1,
          "nomor_surat_jalan": "SJ-2026-047",
          "lot_no": "LOT-HT-2647",
          "material_charge": "MC-26047",
          "status_part": "Masspro",
          "qty": 50,
          "berat_part_snapshot": 2.5,
          "berat_total_part": 125,
          "tanggal_masuk": "2026-10-09",
          "keterangan": "Material delivered 48M",
          "remarks": "",
          "process_type": "Quenching & Tempering",
          "diinput_oleh": "Operator Incoming 01",
          "status_proses": "FINISH",
          "process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "created_at": "2026-10-09T00:00:00Z",
          "updated_at": "2026-10-09T00:00:00Z"
        }
      ];
    const toAdd = newMats.filter(m => !existingKodes.includes(m.kode));
    if (toAdd.length > 0) {
      const materials = this.get("materials");
      materials.push(...toAdd);
      localStorage.setItem("ht_materials", JSON.stringify(materials));
    }
    // Update parts process_type
    const parts = this.get("parts");
    for (const upd of       [
        {
          "id": 1,
          "customer_id": 1,
          "nomor_part": "HT-2026-001",
          "nama_part": "Crankshaft A",
          "berat_part": 2.5,
          "satuan_berat": "KG",
          "target_hardness": "58-62 HRC",
          "standard_temperature": 580,
          "process_type": "Quenching & Tempering",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": true
          },
          "status": "Active",
          "created_at": "2026-01-20T00:00:00Z",
          "updated_at": "2026-01-20T00:00:00Z"
        },
        {
          "id": 2,
          "customer_id": 1,
          "nomor_part": "HT-2026-002",
          "nama_part": "Gear Housing A",
          "berat_part": 3.2,
          "satuan_berat": "KG",
          "target_hardness": "60-64 HRC",
          "standard_temperature": 850,
          "process_type": "Annealing",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": true,
            "anti_rust": false
          },
          "status": "Active",
          "created_at": "2026-01-22T00:00:00Z",
          "updated_at": "2026-01-22T00:00:00Z"
        },
        {
          "id": 3,
          "customer_id": 2,
          "nomor_part": "HT-2026-003",
          "nama_part": "Gear Shaft B",
          "berat_part": 1.8,
          "satuan_berat": "KG",
          "target_hardness": "55-60 HRC",
          "standard_temperature": 820,
          "process_type": "Carburizing",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": true
          },
          "status": "Active",
          "created_at": "2026-01-25T00:00:00Z",
          "updated_at": "2026-01-25T00:00:00Z"
        },
        {
          "id": 4,
          "customer_id": 2,
          "nomor_part": "HT-2026-004",
          "nama_part": "Piston Ring B",
          "berat_part": 0.5,
          "satuan_berat": "KG",
          "target_hardness": "700-750 HV",
          "standard_temperature": 650,
          "process_type": "Annealing",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "status": "Active",
          "created_at": "2026-01-28T00:00:00Z",
          "updated_at": "2026-01-28T00:00:00Z"
        },
        {
          "id": 5,
          "customer_id": 3,
          "nomor_part": "HT-2026-005",
          "nama_part": "Camshaft Pro",
          "berat_part": 4,
          "satuan_berat": "KG",
          "target_hardness": "45-50 HRC",
          "standard_temperature": 870,
          "process_type": "Full Annealing",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "status": "Active",
          "created_at": "2026-02-05T00:00:00Z",
          "updated_at": "2026-02-05T00:00:00Z"
        },
        {
          "id": 6,
          "customer_id": 3,
          "nomor_part": "HT-2026-006",
          "nama_part": "Connecting Rod C",
          "berat_part": 2.1,
          "satuan_berat": "KG",
          "target_hardness": "50-55 HRC",
          "standard_temperature": 830,
          "process_type": "Stress Relief Annealing",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "status": "Active",
          "created_at": "2026-02-08T00:00:00Z",
          "updated_at": "2026-02-08T00:00:00.000Z"
        },
        {
          "id": 7,
          "customer_id": 4,
          "nomor_part": "HT-2026-007",
          "nama_part": "Piston Rod X",
          "berat_part": 3.5,
          "satuan_berat": "KG",
          "target_hardness": "58-62 HRC",
          "standard_temperature": 860,
          "process_type": "Carburizing",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "status": "Active",
          "created_at": "2026-02-12T00:00:00Z",
          "updated_at": "2026-02-12T00:00:00Z"
        },
        {
          "id": 8,
          "customer_id": 4,
          "nomor_part": "HT-2026-008",
          "nama_part": "Gear Component X",
          "berat_part": 2.8,
          "satuan_berat": "KG",
          "target_hardness": "55-60 HRC",
          "standard_temperature": 820,
          "process_type": "Spheroidizing Annealing",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "status": "Active",
          "created_at": "2026-02-15T00:00:00Z",
          "updated_at": "2026-02-15T00:00:00Z"
        },
        {
          "id": 9,
          "customer_id": 5,
          "nomor_part": "HT-2026-009",
          "nama_part": "Valve Stem Z",
          "berat_part": 1.2,
          "satuan_berat": "KG",
          "target_hardness": "40-45 HRC",
          "standard_temperature": 750,
          "process_type": "Normalizing",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "status": "Active",
          "created_at": "2026-02-18T00:00:00Z",
          "updated_at": "2026-02-18T00:00:00Z"
        },
        {
          "id": 10,
          "customer_id": 5,
          "nomor_part": "HT-2026-010",
          "nama_part": "Housing Component Z",
          "berat_part": 3,
          "satuan_berat": "KG",
          "target_hardness": "50-55 HRC",
          "standard_temperature": 700,
          "process_type": "Quenching & Tempering",
          "standard_process_route": {
            "heat_treatment": true,
            "qc_check": true,
            "shotblast": false,
            "anti_rust": false
          },
          "status": "Active",
          "created_at": "2026-02-20T00:00:00Z",
          "updated_at": "2026-02-20T00:00:00Z"
        }
      ]) {
      const p = parts.find(pp => pp.id == upd.id);
      if (p) { p.process_type = upd.process_type; }
    }
    localStorage.setItem("ht_parts", JSON.stringify(parts));
    // Add new productions
    const prods = this.get("productions");
    const existingProdIds = new Set(prods.map(p => p.id));
    const newProds =       [
        {
          "id": 3001,
          "material_id": 2001,
          "incoming_id": 2001,
          "tracking_id": 3001,
          "status": "WAITING",
          "production_status": "WAITING",
          "kode": "1M",
          "process_result": "",
          "visual_check_result": "",
          "visual_check_note": "",
          "visual_check_operator": "",
          "start_scan_at": "",
          "start_scan_by": "",
          "machine_start_at": "",
          "machine_start_by": "",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "Menunggu proses produksi",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3002,
          "material_id": 2002,
          "incoming_id": 2002,
          "tracking_id": 3002,
          "status": "PROCESS",
          "production_status": "PROCESS",
          "kode": "2M",
          "process_result": "",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator QC 01",
          "start_scan_at": "2026-09-03T08:00:00",
          "start_scan_by": "Operator Produksi 02",
          "machine_start_at": "2026-09-03T08:10:00",
          "machine_start_by": "Operator Mesin 02",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "2026-09-03",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "Sedang dalam proses produksi",
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3003,
          "material_id": 2003,
          "incoming_id": 2003,
          "tracking_id": 3003,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "3M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 03",
          "start_scan_at": "2026-09-05T08:00:00",
          "start_scan_by": "Operator Produksi 03",
          "machine_start_at": "2026-09-05T08:10:00",
          "machine_start_by": "Operator Mesin 03",
          "finish_scan_at": "2026-09-05T10:30:00",
          "finish_scan_by": "Operator Produksi 03",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-05T10:35:00",
          "machine_finish_by": "Operator Mesin 03",
          "tanggal_proses": "2026-09-05",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-05T10:30:00",
          "temperature_recorded_by": "Operator Mesin 03"
        },
        {
          "id": 3004,
          "material_id": 2004,
          "incoming_id": 2004,
          "tracking_id": 3004,
          "status": "FINISH_NG",
          "production_status": "FINISH_NG",
          "kode": "4M",
          "process_result": "NG",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 04",
          "start_scan_at": "2026-09-07T08:00:00",
          "start_scan_by": "Operator Produksi 04",
          "machine_start_at": "2026-09-07T08:10:00",
          "machine_start_by": "Operator Mesin 04",
          "finish_scan_at": "2026-09-07T10:30:00",
          "finish_scan_by": "Operator Produksi 04",
          "process_ng_note": "Suhu aktual di luar toleransi (Standar: 580 °C ±15)",
          "machine_finish_at": "2026-09-07T10:35:00",
          "machine_finish_by": "Operator Mesin 04",
          "tanggal_proses": "2026-09-07",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "Part NG setelah proses",
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 680,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 100,
          "temperature_result": "NG",
          "temperature_recorded_at": "2026-09-07T10:30:00",
          "temperature_recorded_by": "Operator Mesin 04"
        },
        {
          "id": 3005,
          "material_id": 2005,
          "incoming_id": 2005,
          "tracking_id": 3005,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "5M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 05",
          "start_scan_at": "2026-09-09T08:00:00",
          "start_scan_by": "Operator Produksi 05",
          "machine_start_at": "2026-09-09T08:10:00",
          "machine_start_by": "Operator Mesin 05",
          "finish_scan_at": "2026-09-09T10:30:00",
          "finish_scan_by": "Operator Produksi 05",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-09T10:35:00",
          "machine_finish_by": "Operator Mesin 05",
          "tanggal_proses": "2026-09-09",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 570,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": -10,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-09T10:30:00",
          "temperature_recorded_by": "Operator Mesin 05"
        },
        {
          "id": 3006,
          "material_id": 2006,
          "incoming_id": 2006,
          "tracking_id": 3006,
          "status": "WAITING",
          "production_status": "WAITING",
          "kode": "6M",
          "process_result": "",
          "visual_check_result": "",
          "visual_check_note": "",
          "visual_check_operator": "",
          "start_scan_at": "",
          "start_scan_by": "",
          "machine_start_at": "",
          "machine_start_by": "",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "",
          "jenis_treatment": "Annealing",
          "remarks": "Menunggu proses produksi",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3007,
          "material_id": 2007,
          "incoming_id": 2007,
          "tracking_id": 3007,
          "status": "PROCESS",
          "production_status": "PROCESS",
          "kode": "7M",
          "process_result": "",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator QC 01",
          "start_scan_at": "2026-09-03T08:00:00",
          "start_scan_by": "Operator Produksi 02",
          "machine_start_at": "2026-09-03T08:10:00",
          "machine_start_by": "Operator Mesin 02",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "2026-09-03",
          "jenis_treatment": "Annealing",
          "remarks": "Sedang dalam proses produksi",
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3008,
          "material_id": 2008,
          "incoming_id": 2008,
          "tracking_id": 3008,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "8M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 03",
          "start_scan_at": "2026-09-05T08:00:00",
          "start_scan_by": "Operator Produksi 03",
          "machine_start_at": "2026-09-05T08:10:00",
          "machine_start_by": "Operator Mesin 03",
          "finish_scan_at": "2026-09-05T10:30:00",
          "finish_scan_by": "Operator Produksi 03",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-05T10:35:00",
          "machine_finish_by": "Operator Mesin 03",
          "tanggal_proses": "2026-09-05",
          "jenis_treatment": "Annealing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z",
          "standard_temperature_snapshot": 850,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 850,
          "temperature_min": 835,
          "temperature_max": 865,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-05T10:30:00",
          "temperature_recorded_by": "Operator Mesin 03"
        },
        {
          "id": 3009,
          "material_id": 2009,
          "incoming_id": 2009,
          "tracking_id": 3009,
          "status": "FINISH_NG",
          "production_status": "FINISH_NG",
          "kode": "9M",
          "process_result": "NG",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 04",
          "start_scan_at": "2026-09-07T08:00:00",
          "start_scan_by": "Operator Produksi 04",
          "machine_start_at": "2026-09-07T08:10:00",
          "machine_start_by": "Operator Mesin 04",
          "finish_scan_at": "2026-09-07T10:30:00",
          "finish_scan_by": "Operator Produksi 04",
          "process_ng_note": "Suhu aktual di luar toleransi (Standar: 850 °C ±15)",
          "machine_finish_at": "2026-09-07T10:35:00",
          "machine_finish_by": "Operator Mesin 04",
          "tanggal_proses": "2026-09-07",
          "jenis_treatment": "Annealing",
          "remarks": "Part NG setelah proses",
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z",
          "standard_temperature_snapshot": 850,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 950,
          "temperature_min": 835,
          "temperature_max": 865,
          "temperature_deviation": 100,
          "temperature_result": "NG",
          "temperature_recorded_at": "2026-09-07T10:30:00",
          "temperature_recorded_by": "Operator Mesin 04"
        },
        {
          "id": 3010,
          "material_id": 2010,
          "incoming_id": 2010,
          "tracking_id": 3010,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "10M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 05",
          "start_scan_at": "2026-09-09T08:00:00",
          "start_scan_by": "Operator Produksi 05",
          "machine_start_at": "2026-09-09T08:10:00",
          "machine_start_by": "Operator Mesin 05",
          "finish_scan_at": "2026-09-09T10:30:00",
          "finish_scan_by": "Operator Produksi 05",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-09T10:35:00",
          "machine_finish_by": "Operator Mesin 05",
          "tanggal_proses": "2026-09-09",
          "jenis_treatment": "Annealing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z",
          "standard_temperature_snapshot": 850,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 840,
          "temperature_min": 835,
          "temperature_max": 865,
          "temperature_deviation": -10,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-09T10:30:00",
          "temperature_recorded_by": "Operator Mesin 05"
        },
        {
          "id": 3011,
          "material_id": 2011,
          "incoming_id": 2011,
          "tracking_id": 3011,
          "status": "WAITING",
          "production_status": "WAITING",
          "kode": "11M",
          "process_result": "",
          "visual_check_result": "",
          "visual_check_note": "",
          "visual_check_operator": "",
          "start_scan_at": "",
          "start_scan_by": "",
          "machine_start_at": "",
          "machine_start_by": "",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "",
          "jenis_treatment": "Carburizing",
          "remarks": "Menunggu proses produksi",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3012,
          "material_id": 2012,
          "incoming_id": 2012,
          "tracking_id": 3012,
          "status": "PROCESS",
          "production_status": "PROCESS",
          "kode": "12M",
          "process_result": "",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator QC 01",
          "start_scan_at": "2026-09-03T08:00:00",
          "start_scan_by": "Operator Produksi 02",
          "machine_start_at": "2026-09-03T08:10:00",
          "machine_start_by": "Operator Mesin 02",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "2026-09-03",
          "jenis_treatment": "Carburizing",
          "remarks": "Sedang dalam proses produksi",
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3013,
          "material_id": 2013,
          "incoming_id": 2013,
          "tracking_id": 3013,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "13M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 03",
          "start_scan_at": "2026-09-05T08:00:00",
          "start_scan_by": "Operator Produksi 03",
          "machine_start_at": "2026-09-05T08:10:00",
          "machine_start_by": "Operator Mesin 03",
          "finish_scan_at": "2026-09-05T10:30:00",
          "finish_scan_by": "Operator Produksi 03",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-05T10:35:00",
          "machine_finish_by": "Operator Mesin 03",
          "tanggal_proses": "2026-09-05",
          "jenis_treatment": "Carburizing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z",
          "standard_temperature_snapshot": 820,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 820,
          "temperature_min": 805,
          "temperature_max": 835,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-05T10:30:00",
          "temperature_recorded_by": "Operator Mesin 03"
        },
        {
          "id": 3014,
          "material_id": 2014,
          "incoming_id": 2014,
          "tracking_id": 3014,
          "status": "FINISH_NG",
          "production_status": "FINISH_NG",
          "kode": "14M",
          "process_result": "NG",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 04",
          "start_scan_at": "2026-09-07T08:00:00",
          "start_scan_by": "Operator Produksi 04",
          "machine_start_at": "2026-09-07T08:10:00",
          "machine_start_by": "Operator Mesin 04",
          "finish_scan_at": "2026-09-07T10:30:00",
          "finish_scan_by": "Operator Produksi 04",
          "process_ng_note": "Suhu aktual di luar toleransi (Standar: 820 °C ±15)",
          "machine_finish_at": "2026-09-07T10:35:00",
          "machine_finish_by": "Operator Mesin 04",
          "tanggal_proses": "2026-09-07",
          "jenis_treatment": "Carburizing",
          "remarks": "Part NG setelah proses",
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z",
          "standard_temperature_snapshot": 820,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 920,
          "temperature_min": 805,
          "temperature_max": 835,
          "temperature_deviation": 100,
          "temperature_result": "NG",
          "temperature_recorded_at": "2026-09-07T10:30:00",
          "temperature_recorded_by": "Operator Mesin 04"
        },
        {
          "id": 3015,
          "material_id": 2015,
          "incoming_id": 2015,
          "tracking_id": 3015,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "15M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 05",
          "start_scan_at": "2026-09-09T08:00:00",
          "start_scan_by": "Operator Produksi 05",
          "machine_start_at": "2026-09-09T08:10:00",
          "machine_start_by": "Operator Mesin 05",
          "finish_scan_at": "2026-09-09T10:30:00",
          "finish_scan_by": "Operator Produksi 05",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-09T10:35:00",
          "machine_finish_by": "Operator Mesin 05",
          "tanggal_proses": "2026-09-09",
          "jenis_treatment": "Carburizing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z",
          "standard_temperature_snapshot": 820,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 810,
          "temperature_min": 805,
          "temperature_max": 835,
          "temperature_deviation": -10,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-09T10:30:00",
          "temperature_recorded_by": "Operator Mesin 05"
        },
        {
          "id": 3016,
          "material_id": 2016,
          "incoming_id": 2016,
          "tracking_id": 3016,
          "status": "WAITING",
          "production_status": "WAITING",
          "kode": "16M",
          "process_result": "",
          "visual_check_result": "",
          "visual_check_note": "",
          "visual_check_operator": "",
          "start_scan_at": "",
          "start_scan_by": "",
          "machine_start_at": "",
          "machine_start_by": "",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "",
          "jenis_treatment": "Normalizing",
          "remarks": "Menunggu proses produksi",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3017,
          "material_id": 2017,
          "incoming_id": 2017,
          "tracking_id": 3017,
          "status": "PROCESS",
          "production_status": "PROCESS",
          "kode": "17M",
          "process_result": "",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator QC 01",
          "start_scan_at": "2026-09-03T08:00:00",
          "start_scan_by": "Operator Produksi 02",
          "machine_start_at": "2026-09-03T08:10:00",
          "machine_start_by": "Operator Mesin 02",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "2026-09-03",
          "jenis_treatment": "Normalizing",
          "remarks": "Sedang dalam proses produksi",
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3018,
          "material_id": 2018,
          "incoming_id": 2018,
          "tracking_id": 3018,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "18M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 03",
          "start_scan_at": "2026-09-05T08:00:00",
          "start_scan_by": "Operator Produksi 03",
          "machine_start_at": "2026-09-05T08:10:00",
          "machine_start_by": "Operator Mesin 03",
          "finish_scan_at": "2026-09-05T10:30:00",
          "finish_scan_by": "Operator Produksi 03",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-05T10:35:00",
          "machine_finish_by": "Operator Mesin 03",
          "tanggal_proses": "2026-09-05",
          "jenis_treatment": "Normalizing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z",
          "standard_temperature_snapshot": 750,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 750,
          "temperature_min": 735,
          "temperature_max": 765,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-05T10:30:00",
          "temperature_recorded_by": "Operator Mesin 03"
        },
        {
          "id": 3019,
          "material_id": 2019,
          "incoming_id": 2019,
          "tracking_id": 3019,
          "status": "FINISH_NG",
          "production_status": "FINISH_NG",
          "kode": "19M",
          "process_result": "NG",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 04",
          "start_scan_at": "2026-09-07T08:00:00",
          "start_scan_by": "Operator Produksi 04",
          "machine_start_at": "2026-09-07T08:10:00",
          "machine_start_by": "Operator Mesin 04",
          "finish_scan_at": "2026-09-07T10:30:00",
          "finish_scan_by": "Operator Produksi 04",
          "process_ng_note": "Suhu aktual di luar toleransi (Standar: 750 °C ±15)",
          "machine_finish_at": "2026-09-07T10:35:00",
          "machine_finish_by": "Operator Mesin 04",
          "tanggal_proses": "2026-09-07",
          "jenis_treatment": "Normalizing",
          "remarks": "Part NG setelah proses",
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z",
          "standard_temperature_snapshot": 750,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 850,
          "temperature_min": 735,
          "temperature_max": 765,
          "temperature_deviation": 100,
          "temperature_result": "NG",
          "temperature_recorded_at": "2026-09-07T10:30:00",
          "temperature_recorded_by": "Operator Mesin 04"
        },
        {
          "id": 3020,
          "material_id": 2020,
          "incoming_id": 2020,
          "tracking_id": 3020,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "20M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 05",
          "start_scan_at": "2026-09-09T08:00:00",
          "start_scan_by": "Operator Produksi 05",
          "machine_start_at": "2026-09-09T08:10:00",
          "machine_start_by": "Operator Mesin 05",
          "finish_scan_at": "2026-09-09T10:30:00",
          "finish_scan_by": "Operator Produksi 05",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-09T10:35:00",
          "machine_finish_by": "Operator Mesin 05",
          "tanggal_proses": "2026-09-09",
          "jenis_treatment": "Normalizing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z",
          "standard_temperature_snapshot": 750,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 740,
          "temperature_min": 735,
          "temperature_max": 765,
          "temperature_deviation": -10,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-09T10:30:00",
          "temperature_recorded_by": "Operator Mesin 05"
        },
        {
          "id": 3021,
          "material_id": 2021,
          "incoming_id": 2021,
          "tracking_id": 3021,
          "status": "WAITING",
          "production_status": "WAITING",
          "kode": "21M",
          "process_result": "",
          "visual_check_result": "",
          "visual_check_note": "",
          "visual_check_operator": "",
          "start_scan_at": "",
          "start_scan_by": "",
          "machine_start_at": "",
          "machine_start_by": "",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "",
          "jenis_treatment": "Full Annealing",
          "remarks": "Menunggu proses produksi",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3022,
          "material_id": 2022,
          "incoming_id": 2022,
          "tracking_id": 3022,
          "status": "PROCESS",
          "production_status": "PROCESS",
          "kode": "22M",
          "process_result": "",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator QC 01",
          "start_scan_at": "2026-09-03T08:00:00",
          "start_scan_by": "Operator Produksi 02",
          "machine_start_at": "2026-09-03T08:10:00",
          "machine_start_by": "Operator Mesin 02",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "2026-09-03",
          "jenis_treatment": "Full Annealing",
          "remarks": "Sedang dalam proses produksi",
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3023,
          "material_id": 2023,
          "incoming_id": 2023,
          "tracking_id": 3023,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "23M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 03",
          "start_scan_at": "2026-09-05T08:00:00",
          "start_scan_by": "Operator Produksi 03",
          "machine_start_at": "2026-09-05T08:10:00",
          "machine_start_by": "Operator Mesin 03",
          "finish_scan_at": "2026-09-05T10:30:00",
          "finish_scan_by": "Operator Produksi 03",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-05T10:35:00",
          "machine_finish_by": "Operator Mesin 03",
          "tanggal_proses": "2026-09-05",
          "jenis_treatment": "Full Annealing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z",
          "standard_temperature_snapshot": 870,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 870,
          "temperature_min": 855,
          "temperature_max": 885,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-05T10:30:00",
          "temperature_recorded_by": "Operator Mesin 03"
        },
        {
          "id": 3024,
          "material_id": 2024,
          "incoming_id": 2024,
          "tracking_id": 3024,
          "status": "FINISH_NG",
          "production_status": "FINISH_NG",
          "kode": "24M",
          "process_result": "NG",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 04",
          "start_scan_at": "2026-09-07T08:00:00",
          "start_scan_by": "Operator Produksi 04",
          "machine_start_at": "2026-09-07T08:10:00",
          "machine_start_by": "Operator Mesin 04",
          "finish_scan_at": "2026-09-07T10:30:00",
          "finish_scan_by": "Operator Produksi 04",
          "process_ng_note": "Suhu aktual di luar toleransi (Standar: 870 °C ±15)",
          "machine_finish_at": "2026-09-07T10:35:00",
          "machine_finish_by": "Operator Mesin 04",
          "tanggal_proses": "2026-09-07",
          "jenis_treatment": "Full Annealing",
          "remarks": "Part NG setelah proses",
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z",
          "standard_temperature_snapshot": 870,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 970,
          "temperature_min": 855,
          "temperature_max": 885,
          "temperature_deviation": 100,
          "temperature_result": "NG",
          "temperature_recorded_at": "2026-09-07T10:30:00",
          "temperature_recorded_by": "Operator Mesin 04"
        },
        {
          "id": 3025,
          "material_id": 2025,
          "incoming_id": 2025,
          "tracking_id": 3025,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "25M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 05",
          "start_scan_at": "2026-09-09T08:00:00",
          "start_scan_by": "Operator Produksi 05",
          "machine_start_at": "2026-09-09T08:10:00",
          "machine_start_by": "Operator Mesin 05",
          "finish_scan_at": "2026-09-09T10:30:00",
          "finish_scan_by": "Operator Produksi 05",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-09T10:35:00",
          "machine_finish_by": "Operator Mesin 05",
          "tanggal_proses": "2026-09-09",
          "jenis_treatment": "Full Annealing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z",
          "standard_temperature_snapshot": 870,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 860,
          "temperature_min": 855,
          "temperature_max": 885,
          "temperature_deviation": -10,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-09T10:30:00",
          "temperature_recorded_by": "Operator Mesin 05"
        },
        {
          "id": 3026,
          "material_id": 2026,
          "incoming_id": 2026,
          "tracking_id": 3026,
          "status": "WAITING",
          "production_status": "WAITING",
          "kode": "26M",
          "process_result": "",
          "visual_check_result": "",
          "visual_check_note": "",
          "visual_check_operator": "",
          "start_scan_at": "",
          "start_scan_by": "",
          "machine_start_at": "",
          "machine_start_by": "",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "",
          "jenis_treatment": "Stress Relief Annealing",
          "remarks": "Menunggu proses produksi",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3027,
          "material_id": 2027,
          "incoming_id": 2027,
          "tracking_id": 3027,
          "status": "PROCESS",
          "production_status": "PROCESS",
          "kode": "27M",
          "process_result": "",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator QC 01",
          "start_scan_at": "2026-09-03T08:00:00",
          "start_scan_by": "Operator Produksi 02",
          "machine_start_at": "2026-09-03T08:10:00",
          "machine_start_by": "Operator Mesin 02",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "2026-09-03",
          "jenis_treatment": "Stress Relief Annealing",
          "remarks": "Sedang dalam proses produksi",
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3028,
          "material_id": 2028,
          "incoming_id": 2028,
          "tracking_id": 3028,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "28M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 03",
          "start_scan_at": "2026-09-05T08:00:00",
          "start_scan_by": "Operator Produksi 03",
          "machine_start_at": "2026-09-05T08:10:00",
          "machine_start_by": "Operator Mesin 03",
          "finish_scan_at": "2026-09-05T10:30:00",
          "finish_scan_by": "Operator Produksi 03",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-05T10:35:00",
          "machine_finish_by": "Operator Mesin 03",
          "tanggal_proses": "2026-09-05",
          "jenis_treatment": "Stress Relief Annealing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z",
          "standard_temperature_snapshot": 830,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 830,
          "temperature_min": 815,
          "temperature_max": 845,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-05T10:30:00",
          "temperature_recorded_by": "Operator Mesin 03"
        },
        {
          "id": 3029,
          "material_id": 2029,
          "incoming_id": 2029,
          "tracking_id": 3029,
          "status": "FINISH_NG",
          "production_status": "FINISH_NG",
          "kode": "29M",
          "process_result": "NG",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 04",
          "start_scan_at": "2026-09-07T08:00:00",
          "start_scan_by": "Operator Produksi 04",
          "machine_start_at": "2026-09-07T08:10:00",
          "machine_start_by": "Operator Mesin 04",
          "finish_scan_at": "2026-09-07T10:30:00",
          "finish_scan_by": "Operator Produksi 04",
          "process_ng_note": "Suhu aktual di luar toleransi (Standar: 830 °C ±15)",
          "machine_finish_at": "2026-09-07T10:35:00",
          "machine_finish_by": "Operator Mesin 04",
          "tanggal_proses": "2026-09-07",
          "jenis_treatment": "Stress Relief Annealing",
          "remarks": "Part NG setelah proses",
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z",
          "standard_temperature_snapshot": 830,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 930,
          "temperature_min": 815,
          "temperature_max": 845,
          "temperature_deviation": 100,
          "temperature_result": "NG",
          "temperature_recorded_at": "2026-09-07T10:30:00",
          "temperature_recorded_by": "Operator Mesin 04"
        },
        {
          "id": 3030,
          "material_id": 2030,
          "incoming_id": 2030,
          "tracking_id": 3030,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "30M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 05",
          "start_scan_at": "2026-09-09T08:00:00",
          "start_scan_by": "Operator Produksi 05",
          "machine_start_at": "2026-09-09T08:10:00",
          "machine_start_by": "Operator Mesin 05",
          "finish_scan_at": "2026-09-09T10:30:00",
          "finish_scan_by": "Operator Produksi 05",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-09T10:35:00",
          "machine_finish_by": "Operator Mesin 05",
          "tanggal_proses": "2026-09-09",
          "jenis_treatment": "Stress Relief Annealing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z",
          "standard_temperature_snapshot": 830,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 820,
          "temperature_min": 815,
          "temperature_max": 845,
          "temperature_deviation": -10,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-09T10:30:00",
          "temperature_recorded_by": "Operator Mesin 05"
        },
        {
          "id": 3031,
          "material_id": 2031,
          "incoming_id": 2031,
          "tracking_id": 3031,
          "status": "WAITING",
          "production_status": "WAITING",
          "kode": "31M",
          "process_result": "",
          "visual_check_result": "",
          "visual_check_note": "",
          "visual_check_operator": "",
          "start_scan_at": "",
          "start_scan_by": "",
          "machine_start_at": "",
          "machine_start_by": "",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "",
          "jenis_treatment": "Spheroidizing Annealing",
          "remarks": "Menunggu proses produksi",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3032,
          "material_id": 2032,
          "incoming_id": 2032,
          "tracking_id": 3032,
          "status": "PROCESS",
          "production_status": "PROCESS",
          "kode": "32M",
          "process_result": "",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator QC 01",
          "start_scan_at": "2026-09-03T08:00:00",
          "start_scan_by": "Operator Produksi 02",
          "machine_start_at": "2026-09-03T08:10:00",
          "machine_start_by": "Operator Mesin 02",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "2026-09-03",
          "jenis_treatment": "Spheroidizing Annealing",
          "remarks": "Sedang dalam proses produksi",
          "created_at": "2026-09-03T00:00:00Z",
          "updated_at": "2026-09-03T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3033,
          "material_id": 2033,
          "incoming_id": 2033,
          "tracking_id": 3033,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "33M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 03",
          "start_scan_at": "2026-09-05T08:00:00",
          "start_scan_by": "Operator Produksi 03",
          "machine_start_at": "2026-09-05T08:10:00",
          "machine_start_by": "Operator Mesin 03",
          "finish_scan_at": "2026-09-05T10:30:00",
          "finish_scan_by": "Operator Produksi 03",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-05T10:35:00",
          "machine_finish_by": "Operator Mesin 03",
          "tanggal_proses": "2026-09-05",
          "jenis_treatment": "Spheroidizing Annealing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-05T00:00:00Z",
          "updated_at": "2026-09-05T00:00:00Z",
          "standard_temperature_snapshot": 820,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 820,
          "temperature_min": 805,
          "temperature_max": 835,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-05T10:30:00",
          "temperature_recorded_by": "Operator Mesin 03"
        },
        {
          "id": 3034,
          "material_id": 2034,
          "incoming_id": 2034,
          "tracking_id": 3034,
          "status": "FINISH_NG",
          "production_status": "FINISH_NG",
          "kode": "34M",
          "process_result": "NG",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 04",
          "start_scan_at": "2026-09-07T08:00:00",
          "start_scan_by": "Operator Produksi 04",
          "machine_start_at": "2026-09-07T08:10:00",
          "machine_start_by": "Operator Mesin 04",
          "finish_scan_at": "2026-09-07T10:30:00",
          "finish_scan_by": "Operator Produksi 04",
          "process_ng_note": "Suhu aktual di luar toleransi (Standar: 820 °C ±15)",
          "machine_finish_at": "2026-09-07T10:35:00",
          "machine_finish_by": "Operator Mesin 04",
          "tanggal_proses": "2026-09-07",
          "jenis_treatment": "Spheroidizing Annealing",
          "remarks": "Part NG setelah proses",
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z",
          "standard_temperature_snapshot": 820,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 920,
          "temperature_min": 805,
          "temperature_max": 835,
          "temperature_deviation": 100,
          "temperature_result": "NG",
          "temperature_recorded_at": "2026-09-07T10:30:00",
          "temperature_recorded_by": "Operator Mesin 04"
        },
        {
          "id": 3035,
          "material_id": 2035,
          "incoming_id": 2035,
          "tracking_id": 3035,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "35M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 05",
          "start_scan_at": "2026-09-09T08:00:00",
          "start_scan_by": "Operator Produksi 05",
          "machine_start_at": "2026-09-09T08:10:00",
          "machine_start_by": "Operator Mesin 05",
          "finish_scan_at": "2026-09-09T10:30:00",
          "finish_scan_by": "Operator Produksi 05",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-09T10:35:00",
          "machine_finish_by": "Operator Mesin 05",
          "tanggal_proses": "2026-09-09",
          "jenis_treatment": "Spheroidizing Annealing",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z",
          "standard_temperature_snapshot": 820,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 810,
          "temperature_min": 805,
          "temperature_max": 835,
          "temperature_deviation": -10,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-09T10:30:00",
          "temperature_recorded_by": "Operator Mesin 05"
        },
        {
          "id": 3036,
          "material_id": 2036,
          "incoming_id": 2036,
          "tracking_id": 5036,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "36M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-28T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-28T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-28T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-28T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-28",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-09-28T00:00:00Z",
          "updated_at": "2026-09-28T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-28T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3037,
          "material_id": 2036,
          "incoming_id": 2036,
          "tracking_id": 5036,
          "status": "PROCESS",
          "production_status": "PROCESS",
          "kode": "36M",
          "process_result": "",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-29T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-29T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "2026-09-29",
          "jenis_treatment": "Shotblast",
          "remarks": "Sedang dalam proses Shotblast",
          "created_at": "2026-09-29T00:00:00Z",
          "updated_at": "2026-09-29T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3038,
          "material_id": 2037,
          "incoming_id": 2037,
          "tracking_id": 5037,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "37M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-28T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-28T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-28T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-28T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-28",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-09-28T00:00:00Z",
          "updated_at": "2026-09-28T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-28T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3039,
          "material_id": 2037,
          "incoming_id": 2037,
          "tracking_id": 5037,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "37M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-29T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-29T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-29T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-29T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-29",
          "jenis_treatment": "Shotblast",
          "remarks": "Shotblast selesai",
          "created_at": "2026-09-29T00:00:00Z",
          "updated_at": "2026-09-29T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3040,
          "material_id": 2037,
          "incoming_id": 2037,
          "tracking_id": 5037,
          "status": "PROCESS",
          "production_status": "PROCESS",
          "kode": "37M",
          "process_result": "",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-30T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-30T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "",
          "finish_scan_by": "",
          "process_ng_note": "",
          "machine_finish_at": "",
          "machine_finish_by": "",
          "tanggal_proses": "2026-09-30",
          "jenis_treatment": "Anti Rust",
          "remarks": "Sedang dalam proses Anti-Rust",
          "created_at": "2026-09-30T00:00:00Z",
          "updated_at": "2026-09-30T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3041,
          "material_id": 2038,
          "incoming_id": 2038,
          "tracking_id": 5038,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "38M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-26T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-26T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-26T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-26T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-26",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-26T00:00:00Z",
          "updated_at": "2026-09-26T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-26T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3042,
          "material_id": 2039,
          "incoming_id": 2039,
          "tracking_id": 5039,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "39M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-28T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-28T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-28T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-28T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-28",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-28T00:00:00Z",
          "updated_at": "2026-09-28T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-28T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3043,
          "material_id": 2040,
          "incoming_id": 2040,
          "tracking_id": 5040,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "40M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-30T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-30T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-30T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-30T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-30",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "Proses selesai normal",
          "created_at": "2026-09-30T00:00:00Z",
          "updated_at": "2026-09-30T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-30T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3044,
          "material_id": 2041,
          "incoming_id": 2041,
          "tracking_id": 5041,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "41M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-30T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-30T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-30T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-30T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-30",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-09-30T00:00:00Z",
          "updated_at": "2026-09-30T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-30T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3045,
          "material_id": 2041,
          "incoming_id": 2041,
          "tracking_id": 5041,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "41M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-31T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-31T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-31T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-31T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-31",
          "jenis_treatment": "Shotblast",
          "remarks": "Shotblast selesai",
          "created_at": "2026-09-31T00:00:00Z",
          "updated_at": "2026-09-31T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3046,
          "material_id": 2041,
          "incoming_id": 2041,
          "tracking_id": 5041,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "41M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-01T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-01T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-01T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-01T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-01",
          "jenis_treatment": "Anti Rust",
          "remarks": "Anti-Rust selesai",
          "created_at": "2026-10-01T00:00:00Z",
          "updated_at": "2026-10-01T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3047,
          "material_id": 2042,
          "incoming_id": 2042,
          "tracking_id": 5042,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "42M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-32T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-32T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-32T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-32T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-32",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-09-32T00:00:00Z",
          "updated_at": "2026-09-32T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-32T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3048,
          "material_id": 2042,
          "incoming_id": 2042,
          "tracking_id": 5042,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "42M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-33T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-33T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-33T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-33T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-33",
          "jenis_treatment": "Shotblast",
          "remarks": "Shotblast selesai",
          "created_at": "2026-09-33T00:00:00Z",
          "updated_at": "2026-09-33T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3049,
          "material_id": 2042,
          "incoming_id": 2042,
          "tracking_id": 5042,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "42M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-03T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-03T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-03T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-03T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-03",
          "jenis_treatment": "Anti Rust",
          "remarks": "Anti-Rust selesai",
          "created_at": "2026-10-03T00:00:00Z",
          "updated_at": "2026-10-03T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3050,
          "material_id": 2043,
          "incoming_id": 2043,
          "tracking_id": 5043,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "43M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-34T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-34T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-34T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-34T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-34",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-09-34T00:00:00Z",
          "updated_at": "2026-09-34T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-34T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3051,
          "material_id": 2043,
          "incoming_id": 2043,
          "tracking_id": 5043,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "43M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-35T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-35T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-35T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-35T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-35",
          "jenis_treatment": "Shotblast",
          "remarks": "Shotblast selesai",
          "created_at": "2026-09-35T00:00:00Z",
          "updated_at": "2026-09-35T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3052,
          "material_id": 2043,
          "incoming_id": 2043,
          "tracking_id": 5043,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "43M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-05T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-05T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-05T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-05T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-05",
          "jenis_treatment": "Anti Rust",
          "remarks": "Anti-Rust selesai",
          "created_at": "2026-10-05T00:00:00Z",
          "updated_at": "2026-10-05T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3053,
          "material_id": 2044,
          "incoming_id": 2044,
          "tracking_id": 5044,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "44M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-36T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-36T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-36T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-36T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-36",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-09-36T00:00:00Z",
          "updated_at": "2026-09-36T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-36T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3054,
          "material_id": 2044,
          "incoming_id": 2044,
          "tracking_id": 5044,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "44M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-37T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-37T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-37T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-37T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-37",
          "jenis_treatment": "Shotblast",
          "remarks": "Shotblast selesai",
          "created_at": "2026-09-37T00:00:00Z",
          "updated_at": "2026-09-37T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3055,
          "material_id": 2044,
          "incoming_id": 2044,
          "tracking_id": 5044,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "44M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-07T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-07T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-07T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-07T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-07",
          "jenis_treatment": "Anti Rust",
          "remarks": "Anti-Rust selesai",
          "created_at": "2026-10-07T00:00:00Z",
          "updated_at": "2026-10-07T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3056,
          "material_id": 2045,
          "incoming_id": 2045,
          "tracking_id": 5045,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "45M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-38T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-38T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-38T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-38T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-38",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-09-38T00:00:00Z",
          "updated_at": "2026-09-38T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-09-38T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3057,
          "material_id": 2045,
          "incoming_id": 2045,
          "tracking_id": 5045,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "45M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-09-39T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-09-39T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-09-39T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-09-39T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-09-39",
          "jenis_treatment": "Shotblast",
          "remarks": "Shotblast selesai",
          "created_at": "2026-09-39T00:00:00Z",
          "updated_at": "2026-09-39T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3058,
          "material_id": 2045,
          "incoming_id": 2045,
          "tracking_id": 5045,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "45M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-09T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-09T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-09T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-09T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-09",
          "jenis_treatment": "Anti Rust",
          "remarks": "Anti-Rust selesai",
          "created_at": "2026-10-09T00:00:00Z",
          "updated_at": "2026-10-09T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3059,
          "material_id": 2046,
          "incoming_id": 2046,
          "tracking_id": 5046,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "46M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-05T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-05T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-05T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-05T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-05",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-10-05T00:00:00Z",
          "updated_at": "2026-10-05T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-10-05T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3060,
          "material_id": 2046,
          "incoming_id": 2046,
          "tracking_id": 5046,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "46M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-06T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-06T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-06T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-06T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-06",
          "jenis_treatment": "Shotblast",
          "remarks": "Shotblast selesai",
          "created_at": "2026-10-06T00:00:00Z",
          "updated_at": "2026-10-06T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3061,
          "material_id": 2046,
          "incoming_id": 2046,
          "tracking_id": 5046,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "46M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-07T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-07T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-07T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-07T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-07",
          "jenis_treatment": "Anti Rust",
          "remarks": "Anti-Rust selesai",
          "created_at": "2026-10-07T00:00:00Z",
          "updated_at": "2026-10-07T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3062,
          "material_id": 2047,
          "incoming_id": 2047,
          "tracking_id": 5047,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "47M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-07T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-07T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-07T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-07T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-07",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-10-07T00:00:00Z",
          "updated_at": "2026-10-07T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-10-07T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3063,
          "material_id": 2047,
          "incoming_id": 2047,
          "tracking_id": 5047,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "47M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-08T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-08T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-08T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-08T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-08",
          "jenis_treatment": "Shotblast",
          "remarks": "Shotblast selesai",
          "created_at": "2026-10-08T00:00:00Z",
          "updated_at": "2026-10-08T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3064,
          "material_id": 2047,
          "incoming_id": 2047,
          "tracking_id": 5047,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "47M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-09T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-09T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-09T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-09T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-09",
          "jenis_treatment": "Anti Rust",
          "remarks": "Anti-Rust selesai",
          "created_at": "2026-10-09T00:00:00Z",
          "updated_at": "2026-10-09T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3065,
          "material_id": 2048,
          "incoming_id": 2048,
          "tracking_id": 5048,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "48M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-09T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-09T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-09T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-09T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-09",
          "jenis_treatment": "Quenching & Tempering",
          "remarks": "HT selesai normal",
          "created_at": "2026-10-09T00:00:00Z",
          "updated_at": "2026-10-09T00:00:00Z",
          "standard_temperature_snapshot": 580,
          "temperature_tolerance_snapshot": 15,
          "actual_temperature": 580,
          "temperature_min": 565,
          "temperature_max": 595,
          "temperature_deviation": 0,
          "temperature_result": "OK",
          "temperature_recorded_at": "2026-10-09T10:30:00",
          "temperature_recorded_by": "Operator Mesin 01"
        },
        {
          "id": 3066,
          "material_id": 2048,
          "incoming_id": 2048,
          "tracking_id": 5048,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "48M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-10T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-10T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-10T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-10T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-10",
          "jenis_treatment": "Shotblast",
          "remarks": "Shotblast selesai",
          "created_at": "2026-10-10T00:00:00Z",
          "updated_at": "2026-10-10T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        },
        {
          "id": 3067,
          "material_id": 2048,
          "incoming_id": 2048,
          "tracking_id": 5048,
          "status": "FINISH",
          "production_status": "FINISH",
          "kode": "48M",
          "process_result": "OK",
          "visual_check_result": "OK",
          "visual_check_note": "",
          "visual_check_operator": "Operator Produksi 01",
          "start_scan_at": "2026-10-11T08:00:00",
          "start_scan_by": "Operator Produksi 01",
          "machine_start_at": "2026-10-11T08:10:00",
          "machine_start_by": "Operator Mesin 01",
          "finish_scan_at": "2026-10-11T10:30:00",
          "finish_scan_by": "Operator Produksi 01",
          "process_ng_note": "",
          "machine_finish_at": "2026-10-11T10:35:00",
          "machine_finish_by": "Operator Mesin 01",
          "tanggal_proses": "2026-10-11",
          "jenis_treatment": "Anti Rust",
          "remarks": "Anti-Rust selesai",
          "created_at": "2026-10-11T00:00:00Z",
          "updated_at": "2026-10-11T00:00:00Z",
          "standard_temperature_snapshot": null,
          "temperature_tolerance_snapshot": null,
          "actual_temperature": null,
          "temperature_min": null,
          "temperature_max": null,
          "temperature_deviation": null,
          "temperature_result": null,
          "temperature_recorded_at": null,
          "temperature_recorded_by": null
        }
      ].filter(p => !existingProdIds.has(p.id));
    if (newProds.length > 0) { prods.push(...newProds); localStorage.setItem("ht_productions", JSON.stringify(prods)); }
    // Add new QCs
    const qcs = this.get("qcs");
    const existingQcIds = new Set(qcs.map(q => q.id));
    const newQcs =       [
        {
          "id": 4001,
          "production_id": 3003,
          "material_id": 2003,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 03",
          "tanggal_inspector": "2026-09-07",
          "catatan": "",
          "user_id": 3,
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 4002,
          "production_id": 3004,
          "material_id": 2004,
          "hardness": "680",
          "satuan_hardness": "HRC",
          "hasil": "NG",
          "microstructure": null,
          "remarks": "Hasil hardness di luar target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-09",
          "catatan": "Hardness di bawah target",
          "user_id": 1,
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 4003,
          "production_id": 3005,
          "material_id": 2005,
          "hardness": "58",
          "satuan_hardness": "HV",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 02",
          "tanggal_inspector": "2026-09-11",
          "catatan": "",
          "user_id": 2,
          "created_at": "2026-09-11T00:00:00Z",
          "updated_at": "2026-09-11T00:00:00Z"
        },
        {
          "id": 4004,
          "production_id": 3008,
          "material_id": 2008,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 03",
          "tanggal_inspector": "2026-09-07",
          "catatan": "",
          "user_id": 3,
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 4005,
          "production_id": 3009,
          "material_id": 2009,
          "hardness": "680",
          "satuan_hardness": "HRC",
          "hasil": "NG",
          "microstructure": null,
          "remarks": "Hasil hardness di luar target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-09",
          "catatan": "Hardness di bawah target",
          "user_id": 1,
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 4006,
          "production_id": 3010,
          "material_id": 2010,
          "hardness": "58",
          "satuan_hardness": "HV",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 02",
          "tanggal_inspector": "2026-09-11",
          "catatan": "",
          "user_id": 2,
          "created_at": "2026-09-11T00:00:00Z",
          "updated_at": "2026-09-11T00:00:00Z"
        },
        {
          "id": 4007,
          "production_id": 3013,
          "material_id": 2013,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 03",
          "tanggal_inspector": "2026-09-07",
          "catatan": "",
          "user_id": 3,
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 4008,
          "production_id": 3014,
          "material_id": 2014,
          "hardness": "680",
          "satuan_hardness": "HRC",
          "hasil": "NG",
          "microstructure": null,
          "remarks": "Hasil hardness di luar target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-09",
          "catatan": "Hardness di bawah target",
          "user_id": 1,
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 4009,
          "production_id": 3015,
          "material_id": 2015,
          "hardness": "58",
          "satuan_hardness": "HV",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 02",
          "tanggal_inspector": "2026-09-11",
          "catatan": "",
          "user_id": 2,
          "created_at": "2026-09-11T00:00:00Z",
          "updated_at": "2026-09-11T00:00:00Z"
        },
        {
          "id": 4010,
          "production_id": 3018,
          "material_id": 2018,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 03",
          "tanggal_inspector": "2026-09-07",
          "catatan": "",
          "user_id": 3,
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 4011,
          "production_id": 3019,
          "material_id": 2019,
          "hardness": "680",
          "satuan_hardness": "HRC",
          "hasil": "NG",
          "microstructure": null,
          "remarks": "Hasil hardness di luar target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-09",
          "catatan": "Hardness di bawah target",
          "user_id": 1,
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 4012,
          "production_id": 3020,
          "material_id": 2020,
          "hardness": "58",
          "satuan_hardness": "HV",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 02",
          "tanggal_inspector": "2026-09-11",
          "catatan": "",
          "user_id": 2,
          "created_at": "2026-09-11T00:00:00Z",
          "updated_at": "2026-09-11T00:00:00Z"
        },
        {
          "id": 4013,
          "production_id": 3023,
          "material_id": 2023,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 03",
          "tanggal_inspector": "2026-09-07",
          "catatan": "",
          "user_id": 3,
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 4014,
          "production_id": 3024,
          "material_id": 2024,
          "hardness": "680",
          "satuan_hardness": "HRC",
          "hasil": "NG",
          "microstructure": null,
          "remarks": "Hasil hardness di luar target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-09",
          "catatan": "Hardness di bawah target",
          "user_id": 1,
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 4015,
          "production_id": 3025,
          "material_id": 2025,
          "hardness": "58",
          "satuan_hardness": "HV",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 02",
          "tanggal_inspector": "2026-09-11",
          "catatan": "",
          "user_id": 2,
          "created_at": "2026-09-11T00:00:00Z",
          "updated_at": "2026-09-11T00:00:00Z"
        },
        {
          "id": 4016,
          "production_id": 3028,
          "material_id": 2028,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 03",
          "tanggal_inspector": "2026-09-07",
          "catatan": "",
          "user_id": 3,
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 4017,
          "production_id": 3029,
          "material_id": 2029,
          "hardness": "680",
          "satuan_hardness": "HRC",
          "hasil": "NG",
          "microstructure": null,
          "remarks": "Hasil hardness di luar target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-09",
          "catatan": "Hardness di bawah target",
          "user_id": 1,
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 4018,
          "production_id": 3030,
          "material_id": 2030,
          "hardness": "58",
          "satuan_hardness": "HV",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 02",
          "tanggal_inspector": "2026-09-11",
          "catatan": "",
          "user_id": 2,
          "created_at": "2026-09-11T00:00:00Z",
          "updated_at": "2026-09-11T00:00:00Z"
        },
        {
          "id": 4019,
          "production_id": 3033,
          "material_id": 2033,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 03",
          "tanggal_inspector": "2026-09-07",
          "catatan": "",
          "user_id": 3,
          "created_at": "2026-09-07T00:00:00Z",
          "updated_at": "2026-09-07T00:00:00Z"
        },
        {
          "id": 4020,
          "production_id": 3034,
          "material_id": 2034,
          "hardness": "680",
          "satuan_hardness": "HRC",
          "hasil": "NG",
          "microstructure": null,
          "remarks": "Hasil hardness di luar target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-09",
          "catatan": "Hardness di bawah target",
          "user_id": 1,
          "created_at": "2026-09-09T00:00:00Z",
          "updated_at": "2026-09-09T00:00:00Z"
        },
        {
          "id": 4021,
          "production_id": 3035,
          "material_id": 2035,
          "hardness": "58",
          "satuan_hardness": "HV",
          "hasil": "OK",
          "microstructure": null,
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 02",
          "tanggal_inspector": "2026-09-11",
          "catatan": "",
          "user_id": 2,
          "created_at": "2026-09-11T00:00:00Z",
          "updated_at": "2026-09-11T00:00:00Z"
        },
        {
          "id": 4022,
          "material_id": 2036,
          "production_id": 3036,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-29",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-09-29T00:00:00Z",
          "updated_at": "2026-09-29T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4023,
          "material_id": 2037,
          "production_id": 3038,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-29",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-09-29T00:00:00Z",
          "updated_at": "2026-09-29T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4024,
          "material_id": 2038,
          "production_id": 3041,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-26",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-09-26T00:00:00Z",
          "updated_at": "2026-09-26T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4025,
          "material_id": 2039,
          "production_id": 3042,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-28",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-09-28T00:00:00Z",
          "updated_at": "2026-09-28T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4026,
          "material_id": 2040,
          "production_id": 3043,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-09-30",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-09-30T00:00:00Z",
          "updated_at": "2026-09-30T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4027,
          "material_id": 2041,
          "production_id": 3044,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-10-01",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-10-01T00:00:00Z",
          "updated_at": "2026-10-01T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4028,
          "material_id": 2042,
          "production_id": 3047,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-10-03",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-10-03T00:00:00Z",
          "updated_at": "2026-10-03T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4029,
          "material_id": 2043,
          "production_id": 3050,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-10-05",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-10-05T00:00:00Z",
          "updated_at": "2026-10-05T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4030,
          "material_id": 2044,
          "production_id": 3053,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-10-07",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-10-07T00:00:00Z",
          "updated_at": "2026-10-07T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4031,
          "material_id": 2045,
          "production_id": 3056,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-10-09",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-10-09T00:00:00Z",
          "updated_at": "2026-10-09T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4032,
          "material_id": 2046,
          "production_id": 3059,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-10-07",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-10-07T00:00:00Z",
          "updated_at": "2026-10-07T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4033,
          "material_id": 2047,
          "production_id": 3062,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-10-09",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-10-09T00:00:00Z",
          "updated_at": "2026-10-09T00:00:00Z",
          "microstructure": null
        },
        {
          "id": 4034,
          "material_id": 2048,
          "production_id": 3065,
          "hardness": "60",
          "satuan_hardness": "HRC",
          "hasil": "OK",
          "remarks": "Hasil hardness sesuai target",
          "inspector": "Inspector QC 01",
          "tanggal_inspector": "2026-10-11",
          "catatan": "",
          "user_id": 1,
          "created_at": "2026-10-11T00:00:00Z",
          "updated_at": "2026-10-11T00:00:00Z",
          "microstructure": null
        }
      ].filter(q => !existingQcIds.has(q.id));
    if (newQcs.length > 0) { qcs.push(...newQcs); localStorage.setItem("ht_qcs", JSON.stringify(qcs)); }
    // Add new tracking
    const trks = this.get("tracking");
    const existingTrkIds = new Set(trks.map(t => t.id));
    const newTrks =       [
        {
          "id": 3001,
          "material_id": 2001,
          "production_id": 3001,
          "delivery_id": null,
          "remarks": "Tracking untuk material 1M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3002,
          "material_id": 2002,
          "production_id": 3002,
          "delivery_id": null,
          "remarks": "Tracking untuk material 2M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3003,
          "material_id": 2003,
          "production_id": 3003,
          "delivery_id": null,
          "remarks": "Tracking untuk material 3M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3004,
          "material_id": 2004,
          "production_id": 3004,
          "delivery_id": null,
          "remarks": "Tracking untuk material 4M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3005,
          "material_id": 2005,
          "production_id": 3005,
          "delivery_id": null,
          "remarks": "Tracking untuk material 5M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3006,
          "material_id": 2006,
          "production_id": 3006,
          "delivery_id": null,
          "remarks": "Tracking untuk material 6M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3007,
          "material_id": 2007,
          "production_id": 3007,
          "delivery_id": null,
          "remarks": "Tracking untuk material 7M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3008,
          "material_id": 2008,
          "production_id": 3008,
          "delivery_id": null,
          "remarks": "Tracking untuk material 8M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3009,
          "material_id": 2009,
          "production_id": 3009,
          "delivery_id": null,
          "remarks": "Tracking untuk material 9M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3010,
          "material_id": 2010,
          "production_id": 3010,
          "delivery_id": null,
          "remarks": "Tracking untuk material 10M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3011,
          "material_id": 2011,
          "production_id": 3011,
          "delivery_id": null,
          "remarks": "Tracking untuk material 11M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3012,
          "material_id": 2012,
          "production_id": 3012,
          "delivery_id": null,
          "remarks": "Tracking untuk material 12M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3013,
          "material_id": 2013,
          "production_id": 3013,
          "delivery_id": null,
          "remarks": "Tracking untuk material 13M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3014,
          "material_id": 2014,
          "production_id": 3014,
          "delivery_id": null,
          "remarks": "Tracking untuk material 14M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3015,
          "material_id": 2015,
          "production_id": 3015,
          "delivery_id": null,
          "remarks": "Tracking untuk material 15M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3016,
          "material_id": 2016,
          "production_id": 3016,
          "delivery_id": null,
          "remarks": "Tracking untuk material 16M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3017,
          "material_id": 2017,
          "production_id": 3017,
          "delivery_id": null,
          "remarks": "Tracking untuk material 17M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3018,
          "material_id": 2018,
          "production_id": 3018,
          "delivery_id": null,
          "remarks": "Tracking untuk material 18M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3019,
          "material_id": 2019,
          "production_id": 3019,
          "delivery_id": null,
          "remarks": "Tracking untuk material 19M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3020,
          "material_id": 2020,
          "production_id": 3020,
          "delivery_id": null,
          "remarks": "Tracking untuk material 20M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3021,
          "material_id": 2021,
          "production_id": 3021,
          "delivery_id": null,
          "remarks": "Tracking untuk material 21M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3022,
          "material_id": 2022,
          "production_id": 3022,
          "delivery_id": null,
          "remarks": "Tracking untuk material 22M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3023,
          "material_id": 2023,
          "production_id": 3023,
          "delivery_id": null,
          "remarks": "Tracking untuk material 23M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3024,
          "material_id": 2024,
          "production_id": 3024,
          "delivery_id": null,
          "remarks": "Tracking untuk material 24M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3025,
          "material_id": 2025,
          "production_id": 3025,
          "delivery_id": null,
          "remarks": "Tracking untuk material 25M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3026,
          "material_id": 2026,
          "production_id": 3026,
          "delivery_id": null,
          "remarks": "Tracking untuk material 26M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3027,
          "material_id": 2027,
          "production_id": 3027,
          "delivery_id": null,
          "remarks": "Tracking untuk material 27M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3028,
          "material_id": 2028,
          "production_id": 3028,
          "delivery_id": null,
          "remarks": "Tracking untuk material 28M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3029,
          "material_id": 2029,
          "production_id": 3029,
          "delivery_id": null,
          "remarks": "Tracking untuk material 29M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3030,
          "material_id": 2030,
          "production_id": 3030,
          "delivery_id": null,
          "remarks": "Tracking untuk material 30M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3031,
          "material_id": 2031,
          "production_id": 3031,
          "delivery_id": null,
          "remarks": "Tracking untuk material 31M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3032,
          "material_id": 2032,
          "production_id": 3032,
          "delivery_id": null,
          "remarks": "Tracking untuk material 32M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3033,
          "material_id": 2033,
          "production_id": 3033,
          "delivery_id": null,
          "remarks": "Tracking untuk material 33M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3034,
          "material_id": 2034,
          "production_id": 3034,
          "delivery_id": null,
          "remarks": "Tracking untuk material 34M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 3035,
          "material_id": 2035,
          "production_id": 3035,
          "delivery_id": null,
          "remarks": "Tracking untuk material 35M",
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 5036,
          "material_id": 2036,
          "production_id": 3037,
          "delivery_id": null,
          "remarks": "Tracking material 36M",
          "created_at": "2026-09-29T00:00:00Z",
          "updated_at": "2026-09-29T00:00:00Z"
        },
        {
          "id": 5037,
          "material_id": 2037,
          "production_id": 3040,
          "delivery_id": null,
          "remarks": "Tracking material 37M",
          "created_at": "2026-09-30T00:00:00Z",
          "updated_at": "2026-09-30T00:00:00Z"
        },
        {
          "id": 5038,
          "material_id": 2038,
          "production_id": 3041,
          "delivery_id": null,
          "remarks": "Tracking material 38M - QC OK",
          "created_at": "2026-09-26T00:00:00Z",
          "updated_at": "2026-09-26T00:00:00Z"
        },
        {
          "id": 5039,
          "material_id": 2039,
          "production_id": 3042,
          "delivery_id": null,
          "remarks": "Tracking material 39M - QC OK",
          "created_at": "2026-09-28T00:00:00Z",
          "updated_at": "2026-09-28T00:00:00Z"
        },
        {
          "id": 5040,
          "material_id": 2040,
          "production_id": 3043,
          "delivery_id": null,
          "remarks": "Tracking material 40M - QC OK",
          "created_at": "2026-09-30T00:00:00Z",
          "updated_at": "2026-09-30T00:00:00Z"
        },
        {
          "id": 5041,
          "material_id": 2041,
          "production_id": 3046,
          "delivery_id": null,
          "remarks": "Tracking material 41M - ready delivery",
          "created_at": "2026-10-01T00:00:00Z",
          "updated_at": "2026-10-01T00:00:00Z"
        },
        {
          "id": 5042,
          "material_id": 2042,
          "production_id": 3049,
          "delivery_id": null,
          "remarks": "Tracking material 42M - ready delivery",
          "created_at": "2026-10-03T00:00:00Z",
          "updated_at": "2026-10-03T00:00:00Z"
        },
        {
          "id": 5043,
          "material_id": 2043,
          "production_id": 3052,
          "delivery_id": null,
          "remarks": "Tracking material 43M - ready delivery",
          "created_at": "2026-10-05T00:00:00Z",
          "updated_at": "2026-10-05T00:00:00Z"
        },
        {
          "id": 5044,
          "material_id": 2044,
          "production_id": 3055,
          "delivery_id": null,
          "remarks": "Tracking material 44M - ready delivery",
          "created_at": "2026-10-07T00:00:00Z",
          "updated_at": "2026-10-07T00:00:00Z"
        },
        {
          "id": 5045,
          "material_id": 2045,
          "production_id": 3058,
          "delivery_id": null,
          "remarks": "Tracking material 45M - ready delivery",
          "created_at": "2026-10-09T00:00:00Z",
          "updated_at": "2026-10-09T00:00:00Z"
        },
        {
          "id": 5046,
          "material_id": 2046,
          "production_id": 3061,
          "delivery_id": 5001,
          "remarks": "Material 46M telah dikirim",
          "created_at": "2026-10-07T00:00:00Z",
          "updated_at": "2026-10-07T00:00:00Z"
        },
        {
          "id": 5047,
          "material_id": 2047,
          "production_id": 3064,
          "delivery_id": 5002,
          "remarks": "Material 47M telah dikirim",
          "created_at": "2026-10-09T00:00:00Z",
          "updated_at": "2026-10-09T00:00:00Z"
        },
        {
          "id": 5048,
          "material_id": 2048,
          "production_id": 3067,
          "delivery_id": 5003,
          "remarks": "Material 48M telah dikirim",
          "created_at": "2026-10-11T00:00:00Z",
          "updated_at": "2026-10-11T00:00:00Z"
        }
      ].filter(t => !existingTrkIds.has(t.id));
    if (newTrks.length > 0) { trks.push(...newTrks); localStorage.setItem("ht_tracking", JSON.stringify(trks)); }
    // Add targets
    const targets = this.get("targets");
    if (targets.length === 0 &&       [
        {
          "id": 1,
          "year": 2026,
          "month": 9,
          "target_berat_output": 5000,
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 2,
          "year": 2026,
          "month": 10,
          "target_berat_output": 6000,
          "created_at": "2026-10-01T00:00:00Z",
          "updated_at": "2026-10-01T00:00:00Z"
        }
      ].length > 0) {
      localStorage.setItem("ht_targets", JSON.stringify(      [
        {
          "id": 1,
          "year": 2026,
          "month": 9,
          "target_berat_output": 5000,
          "created_at": "2026-09-01T00:00:00Z",
          "updated_at": "2026-09-01T00:00:00Z"
        },
        {
          "id": 2,
          "year": 2026,
          "month": 10,
          "target_berat_output": 6000,
          "created_at": "2026-10-01T00:00:00Z",
          "updated_at": "2026-10-01T00:00:00Z"
        }
      ]));
    }
    // Update kode counter
    const kodeCounter = JSON.parse(localStorage.getItem("ht_incoming_kode_counter") || '{"2026":1}');
    if ((kodeCounter["2026"] || 0) < 49) { kodeCounter["2026"] = 49; localStorage.setItem("ht_incoming_kode_counter", JSON.stringify(kodeCounter)); }
    localStorage.setItem("ht_migration_48items_v3", "1");
  }
};
