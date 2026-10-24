const DB = {
  tables: ["customers", "parts", "materials", "productions", "qcs", "deliveries", "tracking", "targets"],
  SEED_VERSION: "2026-v4",

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
    qcs: ["id", "production_id", "material_id", "hardness", "satuan_hardness", "hasil", "microstructure", "remarks", "inspector", "tanggal_inspector", "catatan", "user_id", "created_at", "updated_at", "leader_judgement", "leader_name", "leader_date", "leader_signature", "supervisor_judgement", "supervisor_name", "supervisor_date", "supervisor_signature", "supervisor_notes"],
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
      this.migrate(); return;
    }
    this._resetDatabase();
    this.seedData();
    localStorage.setItem("ht_db_seed_version", this.SEED_VERSION);
    this._initIdCounter();
    this._initIncomingKodeCounter();
    this.migrate();
  },

  _resetDatabase() {
    this.tables.forEach((t) => {
      localStorage.setItem("ht_" + t, JSON.stringify([]));
    });
    localStorage.removeItem("ht_id_counter");
    localStorage.removeItem(this._KEY_INCOMING_KODE_COUNTER);
    localStorage.removeItem("ht_migration_process_types_v2");
    localStorage.removeItem("ht_migration_48items_v3");
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

  /* ---- Helper untuk parse QC remarks JSON ----
     remarks berisi stage, surface_values, core_values, signature.
     Data lama (string biasa) diperlakukan sebagai stage "after". */
  _parseQCRemarks(qc) {
    if (!qc || !qc.remarks) return null;
    try {
      var parsed = JSON.parse(qc.remarks);
      if (parsed && typeof parsed === "object" && parsed.stage !== undefined) {
        return parsed;
      }
    } catch (e) { /* plain string — legacy */ }
    return null;
  },

  /* ---- Dapatkan QC record "after" untuk sebuah material ----
     Leader dan Supervisor judgment selalu merujuk ke laporan
     inspeksi akhir (setelah Heat Treatment). Record lama tanpa
     stage dianggap "after". */
  _getAfterQc(material) {
    if (!material) return null;
    var qcs = this.get("qcs").filter(function (q) {
      return String(q.material_id) === String(material.id);
    });
    var afterQc = null;
    for (var i = 0; i < qcs.length; i++) {
      var q = qcs[i];
      var ext = this._parseQCRemarks(q);
      var stage = (ext && ext.stage) || "after";
      if (stage === "after") {
        if (!afterQc || (q.id || 0) > (afterQc.id || 0)) {
          afterQc = q;
        }
      }
    }
    return afterQc;
  },

  /* ---- QC judgement lengkap: Inspector + Leader + Supervisor ---- */
  getQCJudgement(material) {
    var qc = this._getAfterQc(material);
    if (!qc) {
      return {
        hasInspector: false,
        inspectorHasil: null,
        leaderApproved: false,
        supervisorApproved: false,
      };
    }
    var ext = this._parseQCRemarks(qc);
    var hasil = (qc.hasil || "").toUpperCase();
    return {
      qc: qc,
      hasInspector: true,
      inspectorHasil: hasil,
      leaderJudgement: qc.leader_judgement || null,
      leaderName: qc.leader_name || "",
      leaderDate: qc.leader_date || "",
      leaderSignature: qc.leader_signature || null,
      supervisorJudgement: qc.supervisor_judgement || null,
      supervisorName: qc.supervisor_name || "",
      supervisorDate: qc.supervisor_date || "",
      supervisorSignature: qc.supervisor_signature || null,
      surfaceValues: (ext && ext.surface_values) || [],
      coreValues: (ext && ext.core_values) || [],
      inspectorSignature: (ext && ext.signature) || null,
      inspectorName: qc.inspector || "",
      inspectionDate: qc.tanggal_inspector || "",
    };
  },

  isLeaderApproved(material) {
    var j = this.getQCJudgement(material);
    return j.hasInspector &&
           j.inspectorHasil === "OK" &&
           j.leaderJudgement === "OK" &&
           !!j.leaderName &&
           !!j.leaderSignature;
  },

  isSupervisorApproved(material) {
    var j = this.getQCJudgement(material);
    return j.hasInspector &&
           j.inspectorHasil === "OK" &&
           j.leaderJudgement === "OK" &&
           j.supervisorJudgement === "OK" &&
           !!j.supervisorName &&
           !!j.supervisorSignature;
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

    /* ---- Leader QC judgement gate ----
       Untuk proses Shotblast / Anti Rust, Leader QC harus persetujuan.
       Jika Leader belum approve, proses tidak boleh dimulai. */
    if (targetKey === "SHOTBLAST" || targetKey === "ANTI_RUST") {
      var judge = this.getQCJudgement(material);
      if (!judge.hasInspector) {
        return {
          allowed: false,
          allowedRoute: true,
          reason: "QC belum dilakukan oleh Inspector.",
          qcStatus: "NOT_CHECKED",
          processRoute: proceedResult.processRoute,
          processRouteSteps: steps,
          processName: targetKey,
          leaderApproved: false,
        };
      }
      if (judge.inspectorHasil === "NG") {
        return {
          allowed: false,
          allowedRoute: true,
          reason: "Hasil QC NG. Hubungi QC Supervisor.",
          qcStatus: "NG",
          processRoute: proceedResult.processRoute,
          processRouteSteps: steps,
          processName: targetKey,
          leaderApproved: false,
        };
      }
      if (judge.inspectorHasil !== "OK") {
        return {
          allowed: false,
          allowedRoute: true,
          reason: "Hasil QC belum dapat ditentukan.",
          qcStatus: "NOT_CHECKED",
          processRoute: proceedResult.processRoute,
          processRouteSteps: steps,
          processName: targetKey,
          leaderApproved: false,
        };
      }
      if (!this.isLeaderApproved(material)) {
        return {
          allowed: false,
          allowedRoute: true,
          reason: "Part belum dapat diproses: menunggu judgement Leader QC.",
          qcStatus: proceedResult.qcStatus,
          processRoute: proceedResult.processRoute,
          processRouteSteps: steps,
          processName: targetKey,
          leaderApproved: false,
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
      leaderApproved: true,
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

    /* ---- Supervisor QC judgement gate ----
       Delivery membutuhkan persetujuan akhir dari Supervisor QC. */
    var judge = this.getQCJudgement(material);
    if (!judge.hasInspector) {
      return { allowed: false, reason: "QC belum dilakukan oleh Inspector.", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false, supervisorApproved: false };
    }
    if (judge.inspectorHasil === "NG") {
      return { allowed: false, reason: "Hasil QC NG.", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false, supervisorApproved: false };
    }
    if (judge.inspectorHasil !== "OK") {
      return { allowed: false, reason: "Hasil QC belum dapat ditentukan.", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false, supervisorApproved: false };
    }
    if (!this.isLeaderApproved(material)) {
      return { allowed: false, reason: "Part belum dapat dikirim: menunggu judgement Leader QC.", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false, supervisorApproved: false };
    }
    if (judge.supervisorJudgement !== "OK" || !judge.supervisorName || !judge.supervisorSignature) {
      return { allowed: false, reason: "Part belum dapat dikirim: menunggu judgement Supervisor QC.", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false, supervisorApproved: false };
    }
    if (judge.supervisorJudgement === "NG") {
      return { allowed: false, reason: "Delivery ditolak: judgement Supervisor QC NG.", qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: false, supervisorApproved: false };
    }

    return { allowed: true, reason: null, qcStatus: gate.qcStatus, processRoute: gate.processRoute, processRouteSteps: steps, canDeliver: true, supervisorApproved: true };
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
    const validQCFields = ["id","production_id","material_id","hardness","satuan_hardness","hasil","microstructure","remarks","inspector","tanggal_inspector","catatan","user_id","created_at","updated_at","leader_judgement","leader_name","leader_date","leader_signature","supervisor_judgement","supervisor_name","supervisor_date","supervisor_signature","supervisor_notes"];
    const qcs = this.get("qcs");
    changed = false;
    for (const q of qcs) {
      const keys = Object.keys(q);
      for (const k of keys) { if (!validQCFields.includes(k)) { delete q[k]; changed = true; } }
      if (!("remarks" in q)) { q.remarks = ""; changed = true; }
      if (!("material_id" in q)) { q.material_id = ""; changed = true; }
      if (!("microstructure" in q)) { q.microstructure = null; changed = true; }
      if (!("leader_judgement" in q)) { q.leader_judgement = null; changed = true; }
      if (!("leader_name" in q)) { q.leader_name = ""; changed = true; }
      if (!("leader_date" in q)) { q.leader_date = ""; changed = true; }
      if (!("leader_signature" in q)) { q.leader_signature = null; changed = true; }
      if (!("supervisor_judgement" in q)) { q.supervisor_judgement = null; changed = true; }
      if (!("supervisor_name" in q)) { q.supervisor_name = ""; changed = true; }
      if (!("supervisor_date" in q)) { q.supervisor_date = ""; changed = true; }
      if (!("supervisor_signature" in q)) { q.supervisor_signature = null; changed = true; }
      if (!("supervisor_notes" in q)) { q.supervisor_notes = ""; changed = true; }
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
  seedData() {
    if (this.get("customers").length > 0) return;
    const S = this.STATUSES;
    const TOL = this.TEMPERATURE_DEFAULT_TOLERANCE;
    const db = this;

    const addDays = (y, m, d, days) => {
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() + days);
      return dt;
    };
    const ymd = (dt) =>
      dt.getUTCFullYear() + "-" +
      String(dt.getUTCMonth() + 1).padStart(2, "0") + "-" +
      String(dt.getUTCDate()).padStart(2, "0");
    const ts00 = (dt) => ymd(dt) + "T00:00:00Z";
    const tsTime = (dt, hh, mm) =>
      ymd(dt) + "T" + String(hh).padStart(2, "0") + ":" +
      String(mm).padStart(2, "0") + ":00";

    const PROCESS_DEFS = [
      { name: "Quenching & Tempering",       temp: 580, hardness: "58-62 HRC", hUnit: "HRC", hVal: 60 },
      { name: "Annealing",                    temp: 850, hardness: "60-64 HRC", hUnit: "HRC", hVal: 62 },
      { name: "Carburizing",                  temp: 820, hardness: "55-60 HRC", hUnit: "HRC", hVal: 58 },
      { name: "Normalizing",                  temp: 750, hardness: "40-45 HRC", hUnit: "HRC", hVal: 43 },
      { name: "Full Annealing",               temp: 870, hardness: "45-50 HRC", hUnit: "HRC", hVal: 48 },
      { name: "Stress Relief Annealing",      temp: 830, hardness: "50-55 HRC", hUnit: "HRC", hVal: 53 },
      { name: "Spheroidizing Annealing",      temp: 820, hardness: "700-750 HV", hUnit: "HV", hVal: 725 },
    ];

    const CUSTOMERS = [
      { id: 1, kode_customer: "CUST-2026-001", nama_customer: "PT Toyota Motor Manufacturing Indonesia", alamat: "Jl. Raya Jakarta-Bogor KM 42, Cibinong", pic: "Budi Santoso", phone: "021-8791234", email: "budi.santoso@toyota-indonesia.co.id", status: S.ACTIVE, created_at: "2026-01-15T00:00:00Z", updated_at: "2026-01-15T00:00:00Z" },
      { id: 2, kode_customer: "CUST-2026-002", nama_customer: "PT Astra Honda Motor", alamat: "Jl. Laksda Yos Sudarso KM 7, Sunter", pic: "Andi Wijaya", phone: "021-6534567", email: "andi.wijaya@astra-honda.co.id", status: S.ACTIVE, created_at: "2026-01-20T00:00:00Z", updated_at: "2026-01-20T00:00:00Z" },
      { id: 3, kode_customer: "CUST-2026-003", nama_customer: "PT Yamaha Motor Manufacturing Indonesia", alamat: "Jl. Siliwangi No.88, Bandung", pic: "Citra Dewi", phone: "022-7812345", email: "citra.dewi@yamaha-indonesia.co.id", status: S.ACTIVE, created_at: "2026-02-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z" },
      { id: 4, kode_customer: "CUST-2026-004", nama_customer: "PT Mitsubishi Motors Indonesia", alamat: "Jl. Gatot Subroto KM 12, Cakung", pic: "Dewi Lestari", phone: "021-4678901", email: "dewi.lestari@mitsubishi-indonesia.co.id", status: S.ACTIVE, created_at: "2026-02-10T00:00:00Z", updated_at: "2026-02-10T00:00:00Z" },
      { id: 5, kode_customer: "CUST-2026-005", nama_customer: "PT Suzuki Indomobil Motor", alamat: "Jl. Raya Serpong KM 9, Cikupa", pic: "Eka Putra", phone: "021-5987654", email: "eka.putra@suzuki-indomobil.co.id", status: S.ACTIVE, created_at: "2026-02-15T00:00:00Z", updated_at: "2026-02-15T00:00:00Z" },
      { id: 6, kode_customer: "CUST-2026-006", nama_customer: "PT Hino Motors Indonesia", alamat: "Jl. Letjen MT. Haryono Kav 50-51, Jakarta", pic: "Fajar Wibowo", phone: "021-7890123", email: "fajar.wibowo@hino-indonesia.co.id", status: S.ACTIVE, created_at: "2026-02-20T00:00:00Z", updated_at: "2026-02-20T00:00:00Z" },
      { id: 7, kode_customer: "CUST-2026-007", nama_customer: "PT Isuzu Indonesia", alamat: "Jl. Raya Poris Plawad Indah, Jakarta", pic: "Gita Sari", phone: "021-5566778", email: "gita.sari@isuzu-indonesia.co.id", status: S.ACTIVE, created_at: "2026-03-01T00:00:00Z", updated_at: "2026-03-01T00:00:00Z" },
      { id: 8, kode_customer: "CUST-2026-008", nama_customer: "PT Daihatsu Indonesia", alamat: "Jl. MH. Thamrin No. 12, Jakarta", pic: "Hari Saputra", phone: "021-3344556", email: "hari.saputra@daihatsu-indonesia.co.id", status: S.ACTIVE, created_at: "2026-03-10T00:00:00Z", updated_at: "2026-03-10T00:00:00Z" },
      { id: 9, kode_customer: "CUST-2026-009", nama_customer: "PT Nissan Indonesia", alamat: "Jl. Raya Buncit No. 88, Jakarta", pic: "Indra Wijaya", phone: "021-7788990", email: "indra.wijaya@nissan-indonesia.co.id", status: S.ACTIVE, created_at: "2026-03-15T00:00:00Z", updated_at: "2026-03-15T00:00:00Z" },
      { id: 10, kode_customer: "CUST-2026-010", nama_customer: "PT BMW Indonesia", alamat: "Jl. Jend. Sudirman Kav 74, Jakarta", pic: "Julia Murni", phone: "021-2233445", email: "julia.murni@bmw.co.id", status: S.ACTIVE, created_at: "2026-03-20T00:00:00Z", updated_at: "2026-03-20T00:00:00Z" },
    ];

    const PART_DEFS = [
      { id: 1,  customerId: 1, nomor: "HT-2026-001", nama: "Crankshaft A",       berat: 2.5, target_hardness: "58-62 HRC",  temp: 580, proc: "Quenching & Tempering",     route: { heat_treatment: true, qc_check: true, shotblast: true,  anti_rust: true  } },
      { id: 2,  customerId: 1, nomor: "HT-2026-002", nama: "Gear Housing A",     berat: 3.2, target_hardness: "60-64 HRC",  temp: 850, proc: "Annealing",                 route: { heat_treatment: true, qc_check: true, shotblast: true,  anti_rust: false } },
      { id: 3,  customerId: 2, nomor: "HT-2026-003", nama: "Gear Shaft B",       berat: 1.8, target_hardness: "55-60 HRC",  temp: 820, proc: "Carburizing",               route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: true  } },
      { id: 4,  customerId: 2, nomor: "HT-2026-004", nama: "Piston Ring B",      berat: 0.5, target_hardness: "700-750 HV", temp: 650, proc: "Annealing",                 route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false } },
      { id: 5,  customerId: 3, nomor: "HT-2026-005", nama: "Camshaft Pro",       berat: 4.0, target_hardness: "45-50 HRC",  temp: 870, proc: "Full Annealing",            route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false } },
      { id: 6,  customerId: 3, nomor: "HT-2026-006", nama: "Connecting Rod C",   berat: 2.1, target_hardness: "50-55 HRC",  temp: 830, proc: "Stress Relief Annealing",     route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false } },
      { id: 7,  customerId: 4, nomor: "HT-2026-007", nama: "Piston Rod X",       berat: 3.5, target_hardness: "58-62 HRC",  temp: 820, proc: "Carburizing",               route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false } },
      { id: 8,  customerId: 4, nomor: "HT-2026-008", nama: "Gear Component X",   berat: 2.8, target_hardness: "55-60 HRC",  temp: 820, proc: "Spheroidizing Annealing",     route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false } },
      { id: 9,  customerId: 5, nomor: "HT-2026-009", nama: "Valve Stem Z",       berat: 1.2, target_hardness: "40-45 HRC",  temp: 750, proc: "Normalizing",               route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false } },
      { id: 10, customerId: 5, nomor: "HT-2026-010", nama: "Housing Component Z",berat: 3.0, target_hardness: "50-55 HRC",  temp: 580, proc: "Quenching & Tempering",     route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false } },
    ];

    const EXTRA_PART_NAMES = [
      "Bearing Shell", "Shaft Coupling", "Gear Wheel", "Valve Guide", "Clutch Plate",
      "Flywheel Ring", "Turbocharger", "Exhaust Valve", "Injector Pump", "Fuel Line",
      "Oil Pipe", "Belt Tensioner", "Roller Bearing", "Seal Ring", "Spring Retainer",
      "Link Rod", "Bracket Mount", "Housing Cover", "Sensor Holder", "Lock Pin",
    ];
    const EXTRA_PART_WEIGHTS = [1.5, 2.0, 1.0, 0.8, 3.0, 2.2, 4.5, 2.5, 1.2, 3.5];
    for (let i = 11; i <= 30; i++) {
      const def = PROCESS_DEFS[(i - 11) % 7];
      const custId = Math.floor((i - 1) / 3) + 1;
      const nameIdx = (i - 11) % 20;
      PART_DEFS.push({
        id: i,
        customerId: custId,
        nomor: "HT-2026-" + String(i).padStart(3, "0"),
        nama: EXTRA_PART_NAMES[nameIdx],
        berat: EXTRA_PART_WEIGHTS[nameIdx % 10],
        target_hardness: def.hardness,
        temp: def.temp,
        proc: def.name,
        route: i % 3 === 0
          ? { heat_treatment: true, qc_check: true, shotblast: true,  anti_rust: true  }
          : { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false },
      });
    }

    const parts = PART_DEFS.map((p) => ({
      id: p.id,
      customer_id: p.customerId,
      nomor_part: p.nomor,
      nama_part: p.nama,
      berat_part: p.berat,
      satuan_berat: "KG",
      target_hardness: p.target_hardness,
      standard_temperature: p.temp,
      process_type: p.proc,
      standard_process_route: p.route,
      status: S.ACTIVE,
      created_at: "2026-01-15T00:00:00Z",
      updated_at: "2026-01-15T00:00:00Z",
    }));

    const OPERATORS = ["Operator Produksi 01", "Operator Produksi 02", "Operator Produksi 03", "Operator Produksi 04", "Operator Produksi 05"];
    const MACHINE_OPS = ["Operator Mesin 01", "Operator Mesin 02", "Operator Mesin 03", "Operator Mesin 04", "Operator Mesin 05"];
    const INSPECTORS = ["Inspector QC 01", "Inspector QC 02", "Inspector QC 03"];
    const LEADERS = ["Leader QC 01", "Leader QC 02", "Leader QC 03"];
    const SUPERVISORS = ["Supervisor QC 01", "Supervisor QC 02", "Supervisor QC 03"];
    const PENGIRIM = ["Operator Pengiriman 01", "Operator Pengiriman 02"];

    const partById = {};
    parts.forEach((p) => { partById[p.id] = p; });

    const materials = [];
    const productions = [];
    const qcs = [];
    const tracking = [];
    const deliveries = [];

    let pSeq = 101;
    let qSeq = 201;
    let tSeq = 301;
    let dSeq = 401;

    const dateFor = (idx) => {
      const month = ((idx - 1) % 12) + 1;
      const day = ((idx - 1) % 28) + 1;
      return addDays(2026, month, day, 0);
    };

    const mkMaterial = (idx, kode, part, route, statusProses, incomingDate) => ({
      id: idx,
      kode: kode,
      qr_code: kode,
      customer_id: part.customer_id,
      part_id: part.id,
      nomor_surat_jalan: "SJ-2026-" + String(idx).padStart(4, "0"),
      lot_no: "LOT-HT-" + String(idx).padStart(4, "0"),
      material_charge: "MC-26" + String(idx).padStart(3, "0"),
      status_part: "Masspro",
      qty: 50,
      berat_part_snapshot: part.berat_part,
      berat_total_part: part.berat_part * 50,
      tanggal_masuk: ymd(incomingDate),
      keterangan: "Material " + kode + " (" + part.process_type + ")",
      remarks: "",
      process_type: part.process_type,
      diinput_oleh: "Operator Incoming 0" + ((idx % 5) + 1),
      status_proses: statusProses,
      process_route: route,
      created_at: ts00(incomingDate),
      updated_at: ts00(incomingDate),
    });

    const mkProduction = (idx, matId, kode, part, jenis, status, result, prodDate, opts) => {
      const id = pSeq; pSeq++;
      const temp = opts.temp;
      const tv = temp !== null && temp !== undefined
        ? db.validateTemperature(temp, part.standard_temperature, TOL)
        : { min: null, max: null, deviation: null, result: null };
      const opIdx = idx % 5;
      const isWaiting = status === "WAITING";
      const isFinish = status === "FINISH" || status === "FINISH_NG";
      const isNG = result === "NG";
      return {
        id: id,
        material_id: matId,
        incoming_id: matId,
        tracking_id: 300 + matId,
        kode: kode,
        status: status,
        production_status: status,
        process_result: result,
        visual_check_result: isWaiting ? "" : "OK",
        visual_check_note: "",
        visual_check_operator: isWaiting ? "" : OPERATORS[opIdx],
        start_scan_at: isWaiting ? "" : tsTime(prodDate, 8, 0),
        start_scan_by: isWaiting ? "" : OPERATORS[opIdx],
        machine_start_at: isWaiting ? "" : tsTime(prodDate, 8, 10),
        machine_start_by: isWaiting ? "" : MACHINE_OPS[opIdx],
        finish_scan_at: isFinish ? tsTime(prodDate, 10, 30) : "",
        finish_scan_by: isFinish ? OPERATORS[opIdx] : "",
        process_ng_note: isNG ? "Suhu aktual di luar toleransi (Standar: " + part.standard_temperature + " C +/-" + TOL + ")" : "",
        machine_finish_at: isFinish ? tsTime(prodDate, 10, 35) : "",
        machine_finish_by: isFinish ? MACHINE_OPS[opIdx] : "",
        tanggal_proses: isWaiting ? "" : ymd(prodDate),
        jenis_treatment: jenis,
        remarks: isWaiting ? "Menunggu proses produksi"
          : isFinish && isNG ? "Part NG setelah proses"
          : (jenis === "Shotblast" ? "Shotblast selesai"
          : (jenis === "Anti Rust" ? "Anti-Rust selesai" : "Proses selesai normal")),
        created_at: ts00(prodDate),
        updated_at: ts00(prodDate),
        standard_temperature_snapshot: temp !== null && temp !== undefined ? part.standard_temperature : null,
        temperature_tolerance_snapshot: temp !== null && temp !== undefined ? TOL : null,
        actual_temperature: temp !== null && temp !== undefined ? temp : null,
        temperature_min: tv.min,
        temperature_max: tv.max,
        temperature_deviation: tv.deviation,
        temperature_result: tv.result,
        temperature_recorded_at: temp !== null && temp !== undefined ? tsTime(prodDate, 10, 30) : null,
        temperature_recorded_by: temp !== null && temp !== undefined ? MACHINE_OPS[opIdx] : null,
      };
    };

    const mkQc = (idx, matId, prodId, hasil, qcDate, def) => {
      const isOK = hasil === "OK";
      const opIdx = idx % 3;
      const inspIdx = idx % 3;
      const ldIdx = idx % 3;
      const svIdx = idx % 3;
      const qcDateStr = ymd(qcDate);
      const id = qSeq; qSeq++;
      return {
        id: id,
        production_id: prodId,
        material_id: matId,
        hardness: isOK ? String(def.hVal) : String(def.hVal - 20),
        satuan_hardness: def.hUnit,
        hasil: hasil,
        microstructure: isOK ? "Fine pearlite + ferrite" : null,
        remarks: isOK ? "Hasil hardness sesuai target" : "Hasil hardness di luar target",
        inspector: INSPECTORS[inspIdx],
        tanggal_inspector: qcDateStr,
        catatan: isOK ? "" : "Hardness di bawah target",
        user_id: inspIdx + 1,
        created_at: ts00(qcDate),
        updated_at: ts00(qcDate),
        leader_judgement: isOK ? "OK" : null,
        leader_name: isOK ? LEADERS[ldIdx] : null,
        leader_date: isOK ? qcDateStr : null,
        leader_signature: isOK ? "sig_leader_" + ldIdx : null,
        supervisor_judgement: isOK ? "OK" : null,
        supervisor_name: isOK ? SUPERVISORS[svIdx] : null,
        supervisor_date: isOK ? ymd(addDays(qcDate.getFullYear(), qcDate.getMonth() + 1, qcDate.getDate(), 1)) : null,
        supervisor_signature: isOK ? "sig_supervisor_" + svIdx : null,
        supervisor_notes: "",
      };
    };

    const mkTracking = (idx, matId, prodId, delId) => ({
      id: 300 + matId,
      material_id: matId,
      production_id: prodId,
      delivery_id: delId,
      remarks: "Tracking material " + (matId + "M"),
      created_at: ts00(dateFor(matId)),
      updated_at: ts00(dateFor(matId)),
    });

    /* ---- 70 HT materials (1M-70M, 10 per process type, 7 types) ---- */
    const HT_STATE_PATTERNS = [
      /* cycle A (idx 0-4 within each group of 10) */
      { label: "WAITING", sp: "WAITING", ps: "WAITING", pr: "", qc: false, qh: null, tempOff: null },
      { label: "PROCESS", sp: "PROCESS", ps: "PROCESS", pr: "", qc: false, qh: null, tempOff: null },
      { label: "FIN_OK",  sp: "FINISH",  ps: "FINISH",  pr: "OK", qc: true,  qh: "OK", tempOff: 0 },
      { label: "FIN_NG",  sp: "FINISH_NG", ps: "FINISH_NG", pr: "NG", qc: true, qh: "NG", tempOff: 100 },
      { label: "FIN_OK",  sp: "FINISH",  ps: "FINISH",  pr: "OK", qc: true, qh: "OK", tempOff: -10 },
      /* cycle B (idx 5-9) */
      { label: "WAITING", sp: "WAITING", ps: "WAITING", pr: "", qc: false, qh: null, tempOff: null },
      { label: "PROCESS", sp: "PROCESS", ps: "PROCESS", pr: "", qc: false, qh: null, tempOff: null },
      { label: "FIN_OK",  sp: "FINISH",  ps: "FINISH",  pr: "OK", qc: true, qh: "OK", tempOff: 0 },
      { label: "FIN_NG",  sp: "FINISH_NG", ps: "FINISH_NG", pr: "NG", qc: true, qh: "NG", tempOff: 100 },
      { label: "FIN_OK_QCNG", sp: "FINISH", ps: "FINISH", pr: "OK", qc: true, qh: "NG", tempOff: -5 },
    ];

    const PART_BY_TYPE = [1, 2, 3, 9, 5, 6, 8];

    for (let t = 0; t < 7; t++) {
      const def = PROCESS_DEFS[t];
      const part = partById[PART_BY_TYPE[t]];
      const stdTemp = part.standard_temperature;

      for (let s = 0; s < 10; s++) {
        const matIdx = t * 10 + s + 1;
        const kode = matIdx + "M";
        const state = HT_STATE_PATTERNS[s];
        const inDate = dateFor(matIdx);
        const prodDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 1);
        const qcDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 3);

        const material = mkMaterial(matIdx, kode, part,
          { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false },
          state.sp, inDate);
        materials.push(material);

        const actualTemp = state.tempOff !== null ? stdTemp + state.tempOff : null;
        const prod = mkProduction(matIdx, matIdx, kode, part, def.name,
          state.ps, state.pr, prodDate, { temp: actualTemp });
        productions.push(prod);

        if (state.qc) {
          const qc = mkQc(matIdx, matIdx, prod.id, state.qh, qcDate, def);
          qcs.push(qc);
        }

        tracking.push(mkTracking(matIdx, matIdx, prod.id, null));
      }
    }

    /* ---- 5 materials (71M-75M): HT done, QC PASS, ready for ShotBlast (no SB production) ---- */
    for (let i = 0; i < 5; i++) {
      const matIdx = 71 + i;
      const kode = matIdx + "M";
      const part = partById[11 + (i % 20)];
      const def = PROCESS_DEFS[PROCESS_DEFS.findIndex((p) => p.name === part.process_type)];
      const stdTemp = part.standard_temperature;
      const inDate = dateFor(matIdx);
      const prodDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 1);
      const qcDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 3);

      const material = mkMaterial(matIdx, kode, part,
        { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: false },
        "PROCESS", inDate);
      materials.push(material);

      /* HT FINISH + OK */
      const htProd = mkProduction(matIdx, matIdx, kode, part, def.name,
        "FINISH", "OK", prodDate, { temp: stdTemp });
      productions.push(htProd);

      /* QC OK with approval (no ShotBlast production yet - ready for ShotBlast) */
      const qc = mkQc(matIdx, matIdx, htProd.id, "OK", qcDate, def);
      qcs.push(qc);

      tracking.push(mkTracking(matIdx, matIdx, htProd.id, null));
    }

    /* ---- 5 ShotBlast materials (76M-80M): HT done, QC PASS, ShotBlast PROCESS ---- */
    for (let i = 0; i < 5; i++) {
      const matIdx = 76 + i;
      const kode = matIdx + "M";
      const part = partById[11 + (i % 20)];
      const def = PROCESS_DEFS[PROCESS_DEFS.findIndex((p) => p.name === part.process_type)];
      const stdTemp = part.standard_temperature;
      const inDate = dateFor(matIdx);
      const prodDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 1);
      const qcDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 3);

      const material = mkMaterial(matIdx, kode, part,
        { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: false },
        "PROCESS", inDate);
      materials.push(material);

      /* HT FINISH + OK */
      const htProd = mkProduction(matIdx, matIdx, kode, part, def.name,
        "FINISH", "OK", prodDate, { temp: stdTemp });
      productions.push(htProd);

      /* ShotBlast PROCESS */
      const sbProd = mkProduction(matIdx, matIdx, kode, part, "Shotblast",
        "PROCESS", "", prodDate, { temp: null });
      productions.push(sbProd);

      /* QC OK with approval */
      const qc = mkQc(matIdx, matIdx, htProd.id, "OK", qcDate, def);
      qcs.push(qc);

      tracking.push(mkTracking(matIdx, matIdx, sbProd.id, null));
    }

    /* ---- 10 Anti-Rust materials (81M-90M): full route, Anti-Rust PROCESS ---- */
    for (let i = 0; i < 10; i++) {
      const matIdx = 81 + i;
      const kode = matIdx + "M";
      const part = partById[21 + (i % 10)];
      const def = PROCESS_DEFS[PROCESS_DEFS.findIndex((p) => p.name === part.process_type)];
      const stdTemp = part.standard_temperature;
      const inDate = dateFor(matIdx);
      const prodDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 1);
      const sbDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 2);
      const qcDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 4);

      const material = mkMaterial(matIdx, kode, part,
        { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true },
        "PROCESS", inDate);
      materials.push(material);

      /* HT FINISH + OK */
      const htProd = mkProduction(matIdx, matIdx, kode, part, def.name,
        "FINISH", "OK", prodDate, { temp: stdTemp });
      productions.push(htProd);

      /* ShotBlast FINISH + OK */
      const sbProd = mkProduction(matIdx, matIdx, kode, part, "Shotblast",
        "FINISH", "OK", sbDate, { temp: null });
      productions.push(sbProd);

      /* Anti-Rust PROCESS */
      const arProd = mkProduction(matIdx, matIdx, kode, part, "Anti Rust",
        "PROCESS", "", sbDate, { temp: null });
      productions.push(arProd);

      /* QC OK with approval */
      const qc = mkQc(matIdx, matIdx, htProd.id, "OK", qcDate, def);
      qcs.push(qc);

      tracking.push(mkTracking(matIdx, matIdx, arProd.id, null));
    }

    /* ---- 5 Ready Delivery materials (91M-95M): all routes done, QC OK, no delivery ---- */
    for (let i = 0; i < 5; i++) {
      const matIdx = 91 + i;
      const kode = matIdx + "M";
      const part = partById[1 + (i % 10)];
      const def = PROCESS_DEFS[PROCESS_DEFS.findIndex((p) => p.name === part.process_type)];
      const stdTemp = part.standard_temperature;
      const inDate = dateFor(matIdx);
      const prodDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 1);
      const sbDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 2);
      const arDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 3);
      const qcDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 4);

      const material = mkMaterial(matIdx, kode, part,
        { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true },
        "FINISH", inDate);
      materials.push(material);

      /* HT FINISH + OK */
      const htProd = mkProduction(matIdx, matIdx, kode, part, def.name,
        "FINISH", "OK", prodDate, { temp: stdTemp });
      productions.push(htProd);

      /* ShotBlast FINISH + OK */
      const sbProd = mkProduction(matIdx, matIdx, kode, part, "Shotblast",
        "FINISH", "OK", sbDate, { temp: null });
      productions.push(sbProd);

      /* Anti-Rust FINISH + OK */
      const arProd = mkProduction(matIdx, matIdx, kode, part, "Anti Rust",
        "FINISH", "OK", arDate, { temp: null });
      productions.push(arProd);

      /* QC OK with approval */
      const qc = mkQc(matIdx, matIdx, htProd.id, "OK", qcDate, def);
      qcs.push(qc);

      tracking.push(mkTracking(matIdx, matIdx, arProd.id, null));
    }

    /* ---- 5 Delivered materials (96M-100M): full route done + delivery ---- */
    for (let i = 0; i < 5; i++) {
      const matIdx = 96 + i;
      const kode = matIdx + "M";
      const part = partById[6 + (i % 5)];
      const def = PROCESS_DEFS[PROCESS_DEFS.findIndex((p) => p.name === part.process_type)];
      const stdTemp = part.standard_temperature;
      const inDate = dateFor(matIdx);
      const prodDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 1);
      const sbDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 2);
      const arDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 3);
      const qcDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 4);
      const delDate = addDays(inDate.getFullYear(), inDate.getMonth() + 1, inDate.getDate(), 5);

      const material = mkMaterial(matIdx, kode, part,
        { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true },
        "FINISH", inDate);
      materials.push(material);

      /* HT FINISH + OK */
      const htProd = mkProduction(matIdx, matIdx, kode, part, def.name,
        "FINISH", "OK", prodDate, { temp: stdTemp });
      productions.push(htProd);

      /* ShotBlast FINISH + OK */
      const sbProd = mkProduction(matIdx, matIdx, kode, part, "Shotblast",
        "FINISH", "OK", sbDate, { temp: null });
      productions.push(sbProd);

      /* Anti-Rust FINISH + OK */
      const arProd = mkProduction(matIdx, matIdx, kode, part, "Anti Rust",
        "FINISH", "OK", arDate, { temp: null });
      productions.push(arProd);

      /* QC OK with full approval */
      const qc = mkQc(matIdx, matIdx, htProd.id, "OK", qcDate, def);
      qcs.push(qc);

      /* Delivery */
      const delivery = {
        id: dSeq,
        production_id: arProd.id,
        material_id: matIdx,
        customer_id: part.customer_id,
        tanggal_kirim: ymd(delDate),
        qty_kirim: 50,
        nama_pengirim: PENGIRIM[i % 2],
        status: "Delivered",
        catatan: "Delivery customer berhasil",
        user_id: 1,
        remarks: "",
        created_at: ts00(delDate),
        updated_at: ts00(delDate),
      };
      deliveries.push(delivery);

      tracking.push(mkTracking(matIdx, matIdx, arProd.id, dSeq));
      dSeq++;
    }

    /* ---- 12 monthly targets ---- */
    const targets = [];
    for (let m = 1; m <= 12; m++) {
      targets.push({
        id: m,
        year: 2026,
        month: m,
        target_berat_output: 5000 + m * 500,
        created_at: "2026-" + String(m).padStart(2, "0") + "-01T00:00:00Z",
        updated_at: "2026-" + String(m).padStart(2, "0") + "-01T00:00:00Z",
      });
    }

    localStorage.setItem("ht_customers", JSON.stringify(CUSTOMERS));
    localStorage.setItem("ht_parts", JSON.stringify(parts));
    localStorage.setItem("ht_materials", JSON.stringify(materials));
    localStorage.setItem("ht_productions", JSON.stringify(productions));
    localStorage.setItem("ht_qcs", JSON.stringify(qcs));
    localStorage.setItem("ht_tracking", JSON.stringify(tracking));
    localStorage.setItem("ht_deliveries", JSON.stringify(deliveries));
    localStorage.setItem("ht_targets", JSON.stringify(targets));
  },
};
